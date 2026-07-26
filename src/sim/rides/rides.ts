import { FLAT_RIDES, type FlatRideId } from "@/content/rides";
import { TRACK_FAMILIES, type TrackFamilyId } from "@/content/track";
import { type SimState } from "../state";
import { EMOTE, GUEST_STATE } from "../guests/emotes";
import { addIncome } from "../economy/ledger";
import { cellIndex } from "../world/world";
import {
  evaluateTrack,
  pieceCells,
  pieceEntryPoses,
  type TrackEvaluation,
  type TrackPieceState,
  type TrackPose,
} from "./trackGraph";

/**
 * Rides: tracked coasters + flat rides, their FSMs, trains, boarding queues
 * and breakdowns (TECH §4.6, GAME_DESIGN §9). Queues in M3 are virtual FIFO
 * lines at the ride entrance — painted queue-path pieces are an M4 deferral
 * (ROADMAP M3 notes).
 */

export const RIDE_STATE = {
  closed: 0,
  testing: 1,
  open: 2,
  broken: 3,
} as const;
export type RideStateId = (typeof RIDE_STATE)[keyof typeof RIDE_STATE];

export interface TrackedRide {
  readonly id: number;
  readonly family: TrackFamilyId;
  /** Station entry pose in world meters (1 m lattice) + ground height. */
  readonly anchor: TrackPose;
  baseHeight: number;
  pieces: TrackPieceState[];
  state: RideStateId;
  priceCents: number;
  /** Cached evaluation — recomputed on every edit and on load. */
  evaln: TrackEvaluation;
  /** Set once a test circuit has completed since the last edit. */
  tested: boolean;
  /** Train playback: arc offset from the station start, meters. */
  trainArc: number;
  trainPrevArc: number;
  /** dwell = boarding at the station · run = out on the circuit. */
  trainPhase: "dwell" | "run";
  dwellTicks: number;
  riders: number[];
  queue: number[];
  cycleCount: number;
  totalSpentCents: number;
  /** Entrance cell guests walk to (beside the station platform). */
  entranceX: number;
  entranceZ: number;
  breakdownTicks: number;
  mechanicId: number;
  everOpened: boolean;
  createdAtTick: number;
}

export interface FlatRide {
  readonly id: number;
  readonly defId: FlatRideId;
  readonly x: number;
  readonly z: number;
  readonly rot: 0 | 1 | 2 | 3;
  state: RideStateId;
  priceCents: number;
  /** Ticks remaining in the current phase. */
  phaseTicks: number;
  phase: "loading" | "running";
  riders: number[];
  queue: number[];
  cycleCount: number;
  tested: boolean;
  breakdownTicks: number;
  mechanicId: number;
  entranceX: number;
  entranceZ: number;
  placedAtTick: number;
  everOpened: boolean;
}

export interface Mechanic {
  readonly id: number;
  x: number;
  z: number;
  /** >0 tracked ride id · <0 flat ride id (negated) · 0 idle. */
  targetRide: number;
  repairTicks: number;
}

export const MECHANIC_WAGE_CENTS = 950_00;
export const MECHANIC_HIRE_FEE_CENTS = 300_00;
const DWELL_TICKS = 40; // station stop: unload + board (~4 s real at 1×)
const FLAT_LOAD_TICKS = 25;
const TEST_CIRCUITS = 1;
const QUEUE_CAP = 14;
const REPAIR_TICKS_MIN = 100; // 20 game-min (GAME_BALANCE §5.4)
const REPAIR_TICKS_SPAN = 200; // up to 60 game-min

export const MAX_TRACK_PIECES = 80;

/* ------------------------------------------------------------------ */
/* Derived geometry                                                    */
/* ------------------------------------------------------------------ */

/** The cell guests queue at: beside the station piece, platform side (+x local). */
export function stationEntranceCell(anchor: TrackPose): { x: number; z: number } {
  // Station runs 4 m from the anchor; the platform sits on the local +x side.
  const midMx = anchor.mx + (anchor.heading === 1 ? 1 : anchor.heading === 3 ? -1 : 0) * 0 +
    (anchor.heading === 0 ? 0 : anchor.heading === 2 ? 0 : anchor.heading === 1 ? 2 : -2);
  const midMz = anchor.mz + (anchor.heading === 0 ? 2 : anchor.heading === 2 ? -2 : 0);
  const rightX = [1, 0, -1, 0][anchor.heading]!;
  const rightZ = [0, -1, 0, 1][anchor.heading]!;
  return {
    x: Math.floor((midMx + rightX * 2.5) / 2),
    z: Math.floor((midMz + rightZ * 2.5) / 2),
  };
}

export function flatRideEntranceCell(ride: {
  x: number;
  z: number;
  rot: 0 | 1 | 2 | 3;
  defId: FlatRideId;
}): { x: number; z: number } {
  const def = FLAT_RIDES[ride.defId];
  const w = ride.rot % 2 === 0 ? def.footprint.w : def.footprint.d;
  const d = ride.rot % 2 === 0 ? def.footprint.d : def.footprint.w;
  // Front-center cell of the footprint's south edge.
  return { x: ride.x + Math.floor(w / 2), z: ride.z + d - 1 };
}

/** All world cells a tracked ride occupies, with rail heights (collision). */
export function trackedRideCells(
  ride: Pick<TrackedRide, "anchor" | "pieces">,
): { cellX: number; cellZ: number; railLo: number; railHi: number }[] {
  const cells: { cellX: number; cellZ: number; railLo: number; railHi: number }[] = [];
  const poses = pieceEntryPoses(ride.anchor, ride.pieces);
  for (let i = 0; i < ride.pieces.length; i++) {
    cells.push(...pieceCells(poses[i]!, ride.pieces[i]!));
  }
  return cells;
}

/* ------------------------------------------------------------------ */
/* Ticking                                                             */
/* ------------------------------------------------------------------ */

function archetypeFunGain(eStat: number, iStat: number, archetype: number): number {
  // Preference bands per archetype (GAME_BALANCE §5.3 appeal note):
  // family, thrill, foodie, sightseer, superfan.
  const prefE = [3.5, 7.5, 4.5, 3.0, 6.5][archetype] ?? 4;
  const match = Math.max(0, 1 - Math.abs(eStat - prefE) / 6);
  return Math.round(20 + match * 40 + iStat * 1.5);
}

function unloadRiders(state: SimState, riders: number[], eStat: number, iStat: number, nStat: number, exitX: number, exitZ: number): void {
  const g = state.guests;
  for (const slot of riders) {
    if (g.state[slot] === GUEST_STATE.off) {
      continue; // departed mid-ride (save edge) — skip
    }
    g.state[slot] = GUEST_STATE.idle; // they re-decide next tick
    g.x[slot] = (exitX + 0.5) * 2;
    g.z[slot] = (exitZ + 0.5) * 2;
    g.px[slot] = g.x[slot]!;
    g.pz[slot] = g.z[slot]!;
    const gain = archetypeFunGain(eStat, iStat, g.archetype[slot]!);
    g.fun[slot] = Math.min(100, g.fun[slot]! + gain);
    g.rideId[slot] = 0;
    if (nStat > 7 && (g.archetype[slot] === 0 || g.archetype[slot] === 2)) {
      g.thoughts.get(slot)?.push("thought.dizzy");
      g.emote[slot] = EMOTE.dizzy;
      g.emoteTtl[slot] = 40;
    } else {
      g.emote[slot] = EMOTE.heart;
      g.emoteTtl[slot] = 30;
      g.thoughts.get(slot)?.push("thought.ride.loved");
    }
    state.stats.ridersServed += 1;
  }
  riders.length = 0;
}

function boardFromQueue(
  state: SimState,
  queue: number[],
  riders: number[],
  capacity: number,
  priceCents: number,
  rideKey: number,
): void {
  const g = state.guests;
  while (riders.length < capacity && queue.length > 0) {
    const slot = queue.shift()!;
    if (g.state[slot] !== GUEST_STATE.queuing || g.rideId[slot] !== rideKey) {
      continue; // left the queue (angry, departed…)
    }
    if (priceCents > 0) {
      if (g.wallet[slot]! < priceCents) {
        g.state[slot] = GUEST_STATE.idle;
        g.rideId[slot] = 0;
        g.emote[slot] = EMOTE.broke;
        g.emoteTtl[slot] = 30;
        continue;
      }
      g.wallet[slot] = g.wallet[slot]! - priceCents;
      addIncome(state, "ride", priceCents);
    }
    g.state[slot] = GUEST_STATE.riding;
    riders.push(slot);
  }
}

function rollBreakdown(state: SimState, mtbf: number, cycleCount: number): boolean {
  const age = 1 + cycleCount / 600;
  const mechanics = state.mechanics.length;
  const ridesTotal = state.rides.tracked.size + state.rides.flat.size;
  const coverage = ridesTotal === 0 ? 1 : Math.min(1, mechanics / Math.max(1, ridesTotal / 3));
  const p = (1 / mtbf) * Math.pow(age, 1.3) * (2 - coverage);
  return state.rng.rides.next() < p;
}

function breakRide(state: SimState, key: number, queue: number[], entranceX: number, entranceZ: number): void {
  const g = state.guests;
  for (const slot of queue) {
    if (g.state[slot] === GUEST_STATE.queuing && g.rideId[slot] === key) {
      g.state[slot] = GUEST_STATE.idle;
      g.rideId[slot] = 0;
      g.emote[slot] = EMOTE.angry;
      g.emoteTtl[slot] = 40;
      g.thoughts.get(slot)?.push("thought.ride.broken");
    }
  }
  queue.length = 0;
  void entranceX;
  void entranceZ;
}

export interface RideEvent {
  readonly kind: "broke" | "repaired" | "testPassed";
  readonly rideKey: number;
}

export function tickRides(state: SimState, events: RideEvent[]): void {
  for (const ride of state.rides.tracked.values()) {
    tickTrackedRide(state, ride, events);
  }
  for (const ride of state.rides.flat.values()) {
    tickFlatRide(state, ride, events);
  }
}

function tickTrackedRide(state: SimState, ride: TrackedRide, events: RideEvent[]): void {
  if (ride.state === RIDE_STATE.closed || ride.state === RIDE_STATE.broken) {
    return;
  }
  if (!ride.evaln.valid) {
    return;
  }
  const family = TRACK_FAMILIES[ride.family];
  ride.trainPrevArc = ride.trainArc;
  if (ride.trainPhase === "dwell") {
    ride.dwellTicks -= 1;
    if (ride.state === RIDE_STATE.open) {
      boardFromQueue(
        state,
        ride.queue,
        ride.riders,
        family.cars * family.seatsPerCar,
        ride.priceCents,
        ride.id,
      );
    }
    if (ride.dwellTicks <= 0) {
      ride.trainPhase = "run";
      ride.trainArc = 0;
      ride.trainPrevArc = 0;
    }
    return;
  }
  // Playback along the measured speed profile (deterministic, no physics).
  const runs = ride.evaln.runs;
  let v = family.cars > 0 ? 4 : 4;
  let acc = 0;
  for (const run of runs) {
    if (ride.trainArc <= acc + run.arcLen) {
      const t = run.arcLen === 0 ? 0 : (ride.trainArc - acc) / run.arcLen;
      v = run.vIn + (run.vOut - run.vIn) * t;
      break;
    }
    acc += run.arcLen;
  }
  ride.trainArc += v * 0.1;
  if (ride.trainArc >= ride.evaln.totalArc) {
    // Circuit complete: back at the station.
    ride.trainArc = 0;
    ride.trainPrevArc = 0;
    ride.trainPhase = "dwell";
    ride.dwellTicks = DWELL_TICKS;
    ride.cycleCount += 1;
    const exit = stationEntranceCell(ride.anchor);
    unloadRiders(state, ride.riders, ride.evaln.eStat, ride.evaln.iStat, ride.evaln.nStat, exit.x, exit.z);
    if (ride.state === RIDE_STATE.testing) {
      if (ride.cycleCount >= TEST_CIRCUITS) {
        ride.tested = true;
        ride.state = RIDE_STATE.closed;
        state.stats.ridesTested += 1;
        events.push({ kind: "testPassed", rideKey: ride.id });
      }
      return;
    }
    if (rollBreakdown(state, family.breakdownMtbfCycles, ride.cycleCount)) {
      ride.state = RIDE_STATE.broken;
      ride.breakdownTicks = 0;
      state.stats.breakdowns += 1;
      breakRide(state, ride.id, ride.queue, ride.entranceX, ride.entranceZ);
      events.push({ kind: "broke", rideKey: ride.id });
    }
  }
}

function tickFlatRide(state: SimState, ride: FlatRide, events: RideEvent[]): void {
  if (ride.state === RIDE_STATE.closed || ride.state === RIDE_STATE.broken) {
    return;
  }
  const def = FLAT_RIDES[ride.defId];
  ride.phaseTicks -= 1;
  if (ride.phase === "loading") {
    if (ride.state === RIDE_STATE.open) {
      boardFromQueue(state, ride.queue, ride.riders, def.capacity, ride.priceCents, -ride.id);
    }
    if (ride.phaseTicks <= 0) {
      ride.phase = "running";
      ride.phaseTicks = def.cycleTicks;
    }
    return;
  }
  if (ride.phaseTicks <= 0) {
    ride.phase = "loading";
    ride.phaseTicks = FLAT_LOAD_TICKS;
    ride.cycleCount += 1;
    unloadRiders(state, ride.riders, def.eStat, def.iStat, def.nStat, ride.entranceX, ride.entranceZ);
    if (ride.state === RIDE_STATE.testing) {
      ride.tested = true;
      ride.state = RIDE_STATE.closed;
      state.stats.ridesTested += 1;
      events.push({ kind: "testPassed", rideKey: -ride.id });
      return;
    }
    if (rollBreakdown(state, def.mtbfCycles, ride.cycleCount)) {
      ride.state = RIDE_STATE.broken;
      ride.breakdownTicks = 0;
      state.stats.breakdowns += 1;
      breakRide(state, -ride.id, ride.queue, ride.entranceX, ride.entranceZ);
      events.push({ kind: "broke", rideKey: -ride.id });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Mechanics                                                           */
/* ------------------------------------------------------------------ */

function brokenRides(state: SimState): { key: number; x: number; z: number }[] {
  const out: { key: number; x: number; z: number }[] = [];
  for (const ride of state.rides.tracked.values()) {
    if (ride.state === RIDE_STATE.broken && ride.mechanicId === 0) {
      out.push({ key: ride.id, x: ride.entranceX, z: ride.entranceZ });
    }
  }
  for (const ride of state.rides.flat.values()) {
    if (ride.state === RIDE_STATE.broken && ride.mechanicId === 0) {
      out.push({ key: -ride.id, x: ride.entranceX, z: ride.entranceZ });
    }
  }
  return out;
}

function rideByKey(state: SimState, key: number): TrackedRide | FlatRide | undefined {
  return key > 0 ? state.rides.tracked.get(key) : state.rides.flat.get(-key);
}

export function tickMechanics(state: SimState, events: RideEvent[]): void {
  const MECHANIC_SPEED = 0.16; // cells per tick, a brisk trot
  for (const mech of state.mechanics) {
    if (mech.targetRide === 0) {
      const jobs = brokenRides(state);
      if (jobs.length > 0) {
        let best = jobs[0]!;
        let bestDist = Infinity;
        for (const job of jobs) {
          const d = Math.abs(job.x - mech.x) + Math.abs(job.z - mech.z);
          if (d < bestDist) {
            bestDist = d;
            best = job;
          }
        }
        const ride = rideByKey(state, best.key);
        if (ride) {
          ride.mechanicId = mech.id;
          mech.targetRide = best.key;
          mech.repairTicks =
            REPAIR_TICKS_MIN + Math.floor(state.rng.rides.next() * REPAIR_TICKS_SPAN);
        }
      }
      continue;
    }
    const ride = rideByKey(state, mech.targetRide);
    if (!ride || ride.state !== RIDE_STATE.broken) {
      mech.targetRide = 0;
      continue;
    }
    const dx = ride.entranceX - mech.x;
    const dz = ride.entranceZ - mech.z;
    const dist = Math.abs(dx) + Math.abs(dz);
    if (dist > 0.3) {
      // Walk straight toward the ride (mechanics may cross grass — trade
      // realism for never getting stuck; staff paths polish is M4).
      const len = Math.max(Math.hypot(dx, dz), 1e-6);
      mech.x += (dx / len) * MECHANIC_SPEED;
      mech.z += (dz / len) * MECHANIC_SPEED;
      continue;
    }
    mech.repairTicks -= 1;
    if (mech.repairTicks <= 0) {
      ride.state = RIDE_STATE.open;
      if ("trainPhase" in ride) {
        ride.trainPhase = "dwell";
        ride.trainArc = 0;
        ride.trainPrevArc = 0;
        ride.dwellTicks = DWELL_TICKS;
      } else {
        ride.phase = "loading";
        ride.phaseTicks = FLAT_LOAD_TICKS;
      }
      ride.mechanicId = 0;
      const repairedKey = mech.targetRide;
      mech.targetRide = 0;
      state.stats.repairsDone += 1;
      events.push({ kind: "repaired", rideKey: repairedKey });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Guest-facing queries                                                */
/* ------------------------------------------------------------------ */

export interface OpenRideOption {
  readonly key: number; // >0 tracked, <0 flat
  readonly eStat: number;
  readonly iStat: number;
  readonly priceCents: number;
  readonly entranceX: number;
  readonly entranceZ: number;
  readonly queueLen: number;
}

export function openRideOptions(state: SimState): OpenRideOption[] {
  const out: OpenRideOption[] = [];
  for (const ride of state.rides.tracked.values()) {
    if (ride.state === RIDE_STATE.open && ride.evaln.valid) {
      out.push({
        key: ride.id,
        eStat: ride.evaln.eStat,
        iStat: ride.evaln.iStat,
        priceCents: ride.priceCents,
        entranceX: ride.entranceX,
        entranceZ: ride.entranceZ,
        queueLen: ride.queue.length,
      });
    }
  }
  for (const ride of state.rides.flat.values()) {
    if (ride.state === RIDE_STATE.open) {
      const def = FLAT_RIDES[ride.defId];
      out.push({
        key: -ride.id,
        eStat: def.eStat,
        iStat: def.iStat,
        priceCents: ride.priceCents,
        entranceX: ride.entranceX,
        entranceZ: ride.entranceZ,
        queueLen: ride.queue.length,
      });
    }
  }
  return out;
}

/** A guest arrived at a ride entrance — join the queue if there's room. */
export function tryEnqueue(state: SimState, slot: number, rideKey: number): boolean {
  const ride = rideByKey(state, rideKey);
  if (!ride || ride.state !== RIDE_STATE.open) {
    return false;
  }
  if (ride.queue.length >= QUEUE_CAP) {
    return false;
  }
  ride.queue.push(slot);
  return true;
}

/** Sum of open-ride excitement for appeal/fair-entry (GAME_BALANCE §4.1). */
export function rideAppealTerms(state: SimState): { totalE: number; topAvgE: number; count: number } {
  const es: number[] = [];
  for (const opt of openRideOptions(state)) {
    es.push(opt.eStat);
  }
  es.sort((a, b) => b - a);
  const top = es.slice(0, 8);
  return {
    totalE: es.reduce((a, b) => a + b, 0),
    topAvgE: top.length === 0 ? 0 : top.reduce((a, b) => a + b, 0) / top.length,
    count: es.length,
  };
}

export function createMechanic(state: SimState): Mechanic {
  const gate = state.world.terrain.site.gate;
  const mech: Mechanic = {
    id: state.nextMechanicId,
    x: gate.x,
    z: gate.z,
    targetRide: 0,
    repairTicks: 0,
  };
  state.nextMechanicId += 1;
  return mech;
}

export { evaluateTrack, cellIndex };
