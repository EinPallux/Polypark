import { money, type Money } from "@/shared/money";
import { type SimPieceDef } from "@/content/costs";
import { type SiteDescriptor } from "@/content/sites/types";
import { SHOP_DEFS } from "@/content/shops";
import { type StatKey } from "@/content/goals";
import {
  createRngStreams,
  deserializeRngStreams,
  serializeRngStreams,
  type RngStreams,
  type RngStreamState,
} from "./core/rng";
import {
  cellIndex,
  createWorld,
  footprintCells,
  PATH_OCCUPANT,
  type PlacedPiece,
  type WorldState,
} from "./world/world";
import { createGuests, GUEST_CAP, type GuestSoA } from "./guests/guests";
import { createLedger, type Ledger } from "./economy/ledger";
import { type Janitor, type Litter } from "./staff/janitors";
import { createGoalsState, type GoalsState } from "./goals/goals";

/**
 * The whole mutable simulation state (v3: M2 adds the living park — guests,
 * shops economy, staff, goals, XP). Save schema (src/save/schema.ts) mirrors
 * the snapshot; both evolve in the same commit, guarded by round-trip tests.
 */

export type Stats = Record<StatKey, number> & {
  guestsDeparted: number;
  happyDepartures: number;
  litterSpawned: number;
};

export function createStats(): Stats {
  return {
    pathCellsBuilt: 0,
    sceneryPlaced: 0,
    shopsBuilt: 0,
    guestsWelcomed: 0,
    mealsServed: 0,
    drinksServed: 0,
    littersCleaned: 0,
    janitorsHired: 0,
    monthsProfit: 0,
    guestsDeparted: 0,
    happyDepartures: 0,
    litterSpawned: 0,
  };
}

export interface SimState {
  tick: number;
  seed: number;
  parkName: string;
  money: Money;
  rng: RngStreams;
  world: WorldState;
  parkOpen: boolean;
  entryFeeCents: number;
  guests: GuestSoA;
  spawnAccumulator: number;
  litter: Litter[];
  janitors: Janitor[];
  nextJanitorId: number;
  ledger: Ledger;
  monthNumber: number;
  lastMonthGuests: number;
  stats: Stats;
  goals: GoalsState;
  xp: number;
  /** Static per-pieceId monthly upkeep (derived from SHOP_DEFS at load). */
  shopUpkeep: ReadonlyMap<string, number>;
}

export interface SimStateSnapshot {
  readonly tick: number;
  readonly seed: number;
  readonly parkName: string;
  readonly money: number;
  readonly rng: readonly RngStreamState[];
  readonly world: {
    readonly siteId: string;
    readonly nextInstanceId: number;
    readonly placed: readonly PlacedPiece[];
    readonly pathCells: readonly number[];
  };
  readonly parkOpen: boolean;
  readonly entryFeeCents: number;
  readonly spawnAccumulator: number;
  readonly monthNumber: number;
  readonly lastMonthGuests: number;
  readonly xp: number;
  readonly ledger: Ledger;
  readonly stats: Stats;
  readonly goals: GoalsState;
  readonly litter: readonly Litter[];
  readonly janitors: readonly Janitor[];
  readonly guests: {
    readonly count: number;
    readonly freeList: readonly number[];
    readonly state: readonly number[];
    readonly archetype: readonly number[];
    readonly variant: readonly number[];
    readonly x: readonly number[];
    readonly z: readonly number[];
    readonly hunger: readonly number[];
    readonly thirst: readonly number[];
    readonly bladder: readonly number[];
    readonly energy: readonly number[];
    readonly fun: readonly number[];
    readonly wallet: readonly number[];
    readonly emote: readonly number[];
    readonly emoteTtl: readonly number[];
    readonly serveTicks: readonly number[];
    readonly servingShop: readonly number[];
    readonly enteredAtTick: readonly number[];
    readonly paths: readonly (readonly [number, readonly number[]])[];
    readonly thoughts: readonly (readonly [number, readonly string[]])[];
  };
}

export const STARTING_MONEY: Money = money(75_000_00); // sandbox default, GAME_BALANCE §3.1
export const DEFAULT_ENTRY_FEE_CENTS = 5_00; // M2 preset — rides raise fair value in M3 (GAME_BALANCE §3.1 note)

function buildShopUpkeep(): Map<string, number> {
  return new Map(Object.values(SHOP_DEFS).map((def) => [def.pieceId, def.upkeepCents]));
}

export function createInitialState(
  seed: number,
  parkName: string,
  site: SiteDescriptor,
  pieceDefs: readonly SimPieceDef[],
): SimState {
  return {
    tick: 0,
    seed,
    parkName,
    money: STARTING_MONEY,
    rng: createRngStreams(seed),
    world: createWorld(site, pieceDefs),
    parkOpen: false,
    entryFeeCents: DEFAULT_ENTRY_FEE_CENTS,
    guests: createGuests(),
    spawnAccumulator: 0,
    litter: [],
    janitors: [],
    nextJanitorId: 1,
    ledger: createLedger(),
    monthNumber: 0,
    lastMonthGuests: 0,
    stats: createStats(),
    goals: createGoalsState(),
    xp: 0,
    shopUpkeep: buildShopUpkeep(),
  };
}

const packArray = (array: ArrayLike<number>, count: number): number[] =>
  Array.from({ length: count }, (_, i) => array[i] ?? 0);

export function snapshotState(state: SimState): SimStateSnapshot {
  const g = state.guests;
  const n = g.count;
  return {
    tick: state.tick,
    seed: state.seed,
    parkName: state.parkName,
    money: state.money,
    rng: serializeRngStreams(state.rng),
    world: {
      siteId: state.world.siteId,
      nextInstanceId: state.world.nextInstanceId,
      placed: [...state.world.placed.values()].sort((a, b) => a.id - b.id),
      pathCells: [...state.world.pathCells],
    },
    parkOpen: state.parkOpen,
    entryFeeCents: state.entryFeeCents,
    spawnAccumulator: state.spawnAccumulator,
    monthNumber: state.monthNumber,
    lastMonthGuests: state.lastMonthGuests,
    xp: state.xp,
    ledger: structuredClone(state.ledger),
    stats: { ...state.stats },
    goals: structuredClone(state.goals),
    litter: state.litter.map((l) => ({ ...l })),
    janitors: state.janitors.map((j) => ({ ...j, path: [...j.path] })),
    guests: {
      count: n,
      freeList: [...g.freeList],
      state: packArray(g.state, n),
      archetype: packArray(g.archetype, n),
      variant: packArray(g.variant, n),
      x: packArray(g.x, n),
      z: packArray(g.z, n),
      hunger: packArray(g.hunger, n),
      thirst: packArray(g.thirst, n),
      bladder: packArray(g.bladder, n),
      energy: packArray(g.energy, n),
      fun: packArray(g.fun, n),
      wallet: packArray(g.wallet, n),
      emote: packArray(g.emote, n),
      emoteTtl: packArray(g.emoteTtl, n),
      serveTicks: packArray(g.serveTicks, n),
      servingShop: packArray(g.servingShop, n),
      enteredAtTick: packArray(g.enteredAtTick, n),
      paths: [...g.paths.entries()].map(([slot, path]) => [slot, [...path]] as const),
      thoughts: [...g.thoughts.entries()].map(([slot, log]) => [slot, [...log]] as const),
    },
  };
}

export function restoreState(
  snapshot: SimStateSnapshot,
  site: SiteDescriptor,
  pieceDefs: readonly SimPieceDef[],
): SimState {
  if (snapshot.world.siteId !== site.id) {
    throw new Error(`Save is for site "${snapshot.world.siteId}", got "${site.id}"`);
  }
  const world = createWorld(site, pieceDefs);
  world.nextInstanceId = snapshot.world.nextInstanceId;
  const copyLength = Math.min(world.pathCells.length, snapshot.world.pathCells.length);
  for (let i = 0; i < copyLength; i++) {
    const value = snapshot.world.pathCells[i] ?? 0;
    world.pathCells[i] = value;
    if (value === 1) {
      world.occupancy[i] = PATH_OCCUPANT;
    }
  }
  for (const piece of snapshot.world.placed) {
    world.placed.set(piece.id, piece);
    const def = world.pieces.get(piece.pieceId);
    if (def) {
      for (const cell of footprintCells(def, piece.x, piece.z, piece.rot)) {
        world.occupancy[cellIndex(world, cell.x, cell.z)] = piece.id;
      }
    }
  }

  const guests = createGuests();
  const s = snapshot.guests;
  guests.count = Math.min(s.count, GUEST_CAP);
  guests.freeList = [...s.freeList];
  for (let i = 0; i < guests.count; i++) {
    guests.state[i] = s.state[i] ?? 0;
    guests.archetype[i] = s.archetype[i] ?? 0;
    guests.variant[i] = s.variant[i] ?? 0;
    guests.x[i] = s.x[i] ?? 0;
    guests.z[i] = s.z[i] ?? 0;
    guests.px[i] = s.x[i] ?? 0;
    guests.pz[i] = s.z[i] ?? 0;
    guests.hunger[i] = s.hunger[i] ?? 0;
    guests.thirst[i] = s.thirst[i] ?? 0;
    guests.bladder[i] = s.bladder[i] ?? 0;
    guests.energy[i] = s.energy[i] ?? 0;
    guests.fun[i] = s.fun[i] ?? 0;
    guests.wallet[i] = s.wallet[i] ?? 0;
    guests.emote[i] = s.emote[i] ?? 0;
    guests.emoteTtl[i] = s.emoteTtl[i] ?? 0;
    guests.serveTicks[i] = s.serveTicks[i] ?? 0;
    guests.servingShop[i] = s.servingShop[i] ?? -1;
    guests.enteredAtTick[i] = s.enteredAtTick[i] ?? 0;
  }
  for (const [slot, path] of s.paths) {
    guests.paths.set(slot, [...path]);
  }
  for (const [slot, log] of s.thoughts) {
    guests.thoughts.set(slot, [...log]);
  }

  return {
    tick: snapshot.tick,
    seed: snapshot.seed,
    parkName: snapshot.parkName,
    money: money(snapshot.money),
    rng: deserializeRngStreams(snapshot.rng),
    world,
    parkOpen: snapshot.parkOpen,
    entryFeeCents: snapshot.entryFeeCents,
    guests,
    spawnAccumulator: snapshot.spawnAccumulator,
    litter: snapshot.litter.map((l) => ({ ...l })),
    janitors: snapshot.janitors.map((j) => ({ ...j, path: [...j.path] })),
    nextJanitorId: Math.max(0, ...snapshot.janitors.map((j) => j.id)) + 1,
    ledger: structuredClone(snapshot.ledger),
    monthNumber: snapshot.monthNumber,
    lastMonthGuests: snapshot.lastMonthGuests,
    stats: { ...snapshot.stats },
    goals: structuredClone(snapshot.goals),
    xp: snapshot.xp,
    shopUpkeep: buildShopUpkeep(),
  };
}
