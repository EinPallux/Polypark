import { CELL_SIZE_METERS } from "@/shared/grid";
import { money } from "@/shared/money";
import {
  ATM_REFILL_CENTS,
  INFO_KIOSK_REACH_BONUS,
  SHOP_DEFS,
  SHOP_FAIR_PRICE_RATIO,
  SHOP_SEARCH_REACH,
  souvenirSecondItemChance,
  type NeedKey,
  type ShopDef,
} from "@/content/shops";
import { type SimState } from "../state";
import { addIncome, addExpense } from "../economy/ledger";
import { cellIndex, type PlacedPiece } from "../world/world";
import { findPath } from "../world/pathfind";
// Re-exported so existing importers keep working after the move to world/.
export { findPath, invalidatePathCache } from "../world/pathfind";
import { GAME_SECONDS_PER_TICK } from "../core/loop";
import { EMOTE, GUEST_STATE } from "./emotes";
import {
  openRideOptions,
  rideAppealTerms,
  tryEnqueue,
  type OpenRideOption,
} from "../rides/rides";
import { archetypeWeights, marketingMult } from "../economy/marketing";
import { ratingMult } from "../rating/rating";
import { weatherArrivalsMult, weatherThirstMult } from "../weather/weather";
import { eventArrivalsMult, eventLitterMult } from "../events/effects";
import { arrivalCapacityMult } from "../districts/districts";

/**
 * The guest simulation (GAME_DESIGN §12): SoA typed arrays at a hard cap,
 * seeded decisions, A* movement on the path network, needs → shops → mood →
 * emotes. Decision work is staggered (each guest thinks every DECIDE_PERIOD
 * ticks) so 1,200 guests stay inside the tick budget (TECH §4.2).
 */

export const GUEST_CAP = 1_500;
const DECIDE_PERIOD = 20; // ticks between decisions per guest
const WALK_SPEED = 1.35; // m/s
const LEAVE_NEED_FLOOR = 10;
const SEEK_THRESHOLD = 55;
export const EMOTE_THRESHOLD = 45;
const MAX_STAY_TICKS = 1_200; // ≈ 4 game-hours

/** Need decay: full→0 minutes from GAME_BALANCE §4.3 → points per tick. */
const DECAY_PER_TICK: Record<NeedKey, number> = {
  hunger: 100 / ((150 * 60) / GAME_SECONDS_PER_TICK),
  thirst: 100 / ((110 * 60) / GAME_SECONDS_PER_TICK),
  bladder: 100 / ((130 * 60) / GAME_SECONDS_PER_TICK),
  energy: 100 / ((190 * 60) / GAME_SECONDS_PER_TICK),
  fun: 100 / ((90 * 60) / GAME_SECONDS_PER_TICK), // decays only while idle/queuing
};

export { EMOTE, GUEST_STATE } from "./emotes";

export const ARCHETYPES = ["family", "thrill", "foodie", "sightseer", "superfan"] as const;
const ARCHETYPE_WALLET_CENTS = [110_00, 70_00, 95_00, 55_00, 160_00] as const;
const ARCHETYPE_WEIGHTS = [0.34, 0.26, 0.16, 0.18, 0.06] as const;
/**
 * Price tolerance per archetype (GAME_BALANCE §4.3). Specified since M2 and
 * unread until shops became priceable — a sightseer counts every dollar, a
 * superfan barely looks at the board.
 */
const ARCHETYPE_PRICE_TOLERANCE = [1.0, 0.9, 1.2, 0.8, 1.3] as const;
/**
 * XP a departing guest pays, indexed by moodOf()'s 0..3
 * (miserable/grumpy/content/delighted), spanning §9.1's "1–6 XP by mood".
 */
const EXIT_JOY_XP = [1, 2, 4, 6] as const;

export interface GuestSoA {
  count: number;
  freeList: number[];
  state: Uint8Array;
  archetype: Uint8Array;
  variant: Uint8Array; // render palette 0..5
  x: Float32Array;
  z: Float32Array;
  px: Float32Array; // previous-tick position for render interpolation
  pz: Float32Array;
  hunger: Float32Array;
  thirst: Float32Array;
  bladder: Float32Array;
  energy: Float32Array;
  fun: Float32Array;
  wallet: Int32Array;
  emote: Uint8Array;
  emoteTtl: Uint16Array;
  serveTicks: Uint16Array;
  servingShop: Int32Array; // placed piece id or -1
  enteredAtTick: Uint32Array;
  /** Ride key while queuing/riding: >0 tracked, <0 flat, 0 none (M3). */
  rideId: Int16Array;
  /** Cold per-guest data: current path + thought log (i18n keys). */
  paths: Map<number, number[]>;
  thoughts: Map<number, string[]>;
}

export function createGuests(): GuestSoA {
  return {
    count: 0,
    freeList: [],
    state: new Uint8Array(GUEST_CAP),
    archetype: new Uint8Array(GUEST_CAP),
    variant: new Uint8Array(GUEST_CAP),
    x: new Float32Array(GUEST_CAP),
    z: new Float32Array(GUEST_CAP),
    px: new Float32Array(GUEST_CAP),
    pz: new Float32Array(GUEST_CAP),
    hunger: new Float32Array(GUEST_CAP),
    thirst: new Float32Array(GUEST_CAP),
    bladder: new Float32Array(GUEST_CAP),
    energy: new Float32Array(GUEST_CAP),
    fun: new Float32Array(GUEST_CAP),
    wallet: new Int32Array(GUEST_CAP),
    emote: new Uint8Array(GUEST_CAP),
    emoteTtl: new Uint16Array(GUEST_CAP),
    serveTicks: new Uint16Array(GUEST_CAP),
    servingShop: new Int32Array(GUEST_CAP),
    enteredAtTick: new Uint32Array(GUEST_CAP),
    rideId: new Int16Array(GUEST_CAP),
    paths: new Map(),
    thoughts: new Map(),
  };
}

function think(g: GuestSoA, slot: number, key: string): void {
  const log = g.thoughts.get(slot) ?? [];
  if (log[log.length - 1] !== key) {
    log.push(key);
    if (log.length > 5) {
      log.shift();
    }
    g.thoughts.set(slot, log);
  }
}

/* ------------------------------------------------------------------ */
/* Pathfinding on the path network                                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Spawning                                                            */
/* ------------------------------------------------------------------ */

function hourOfDay(tick: number): number {
  return (9 + (tick * GAME_SECONDS_PER_TICK) / 3600) % 24;
}

/** Arrival appeal before rides exist: paths + scenery + shops (M2 baseline). */
export function arrivalsPerMinute(state: SimState): number {
  if (!state.parkOpen) {
    return 0;
  }
  const hour = hourOfDay(state.tick);
  if (hour < 9 || hour >= 21) {
    return 0;
  }
  const rhythm = hour < 11 ? 0.7 : hour < 17 ? 1.0 : 0.5;
  let shops = 0;
  let scenery = 0;
  for (const piece of state.world.placed.values()) {
    if (SHOP_DEFS[piece.pieceId]) {
      shops += 1;
    } else {
      scenery += 1;
    }
  }
  let pathCellCount = 0;
  for (let i = 0; i < state.world.pathCells.length; i++) {
    if (state.world.pathCells[i] === 1) pathCellCount += 1;
  }
  if (pathCellCount === 0) {
    return 0; // nowhere to walk — no arrivals
  }
  // Rides drive both appeal and what an entry ticket is worth
  // (GAME_BALANCE §4.1 — M3 note: fairEntry gains the doc's $1.1×topAvgE term).
  const rides = rideAppealTerms(state);
  const appeal =
    1.2 +
    shops * 1.6 +
    scenery * 0.06 +
    Math.min(pathCellCount * 0.04, 4) +
    rides.totalE * 1.0;
  const fairEntry =
    8_00 + shops * 1_00 + Math.min(scenery * 4, 3_00) + Math.round(rides.topAvgE * 1_10);
  const elasticity = Math.min(
    Math.max(1.6 - (state.entryFeeCents / fairEntry) ** 1.4, 0.1),
    1.3,
  );
  // Marketing supplies the marketingMult term GAME_BALANCE §4.1 always had.
  return (
    appeal *
    rhythm *
    elasticity *
    marketingMult(state) *
    ratingMult(state) *
    weatherArrivalsMult(state) *
    eventArrivalsMult(state) *
    arrivalCapacityMult(state, liveGuestCount(state.guests))
  );
}

function spawnGuest(state: SimState): number | null {
  const g = state.guests;
  const slot = g.freeList.pop() ?? (g.count < GUEST_CAP ? g.count : null);
  if (slot === null) {
    return null;
  }
  if (slot === g.count) {
    g.count += 1;
  }
  const rng = state.rng.guests;
  // Same single draw on the same stream as M2 — a campaign reweights WHO shows
  // up, never how many (reach is marketingMult's job), so no stream reshuffle.
  const roll = rng.next();
  const weights = archetypeWeights(state, ARCHETYPE_WEIGHTS);
  let archetype = 0;
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i]!;
    if (roll < cumulative) {
      archetype = i;
      break;
    }
  }
  const gate = state.world.terrain.site.gate;
  g.state[slot] = GUEST_STATE.idle;
  g.archetype[slot] = archetype;
  g.variant[slot] = rng.nextInt(0, 4); // palettes a–e; f is the janitor uniform
  g.x[slot] = (gate.x + 0.5) * CELL_SIZE_METERS;
  g.z[slot] = (gate.z + 0.5) * CELL_SIZE_METERS;
  g.px[slot] = g.x[slot]!;
  g.pz[slot] = g.z[slot]!;
  g.hunger[slot] = 55 + rng.next() * 40;
  g.thirst[slot] = 55 + rng.next() * 40;
  g.bladder[slot] = 60 + rng.next() * 40;
  g.energy[slot] = 70 + rng.next() * 30;
  g.fun[slot] = 45 + rng.next() * 25;
  g.wallet[slot] = Math.round(ARCHETYPE_WALLET_CENTS[archetype]! * (0.8 + rng.next() * 0.4));
  g.emote[slot] = EMOTE.none;
  g.emoteTtl[slot] = 0;
  g.serveTicks[slot] = 0;
  g.servingShop[slot] = -1;
  g.rideId[slot] = 0;
  g.enteredAtTick[slot] = state.tick;
  g.paths.delete(slot);
  g.thoughts.set(slot, ["thought.arrived"]);

  // Entry fee straight to the ledger (wallet already reflects planning it in).
  if (state.entryFeeCents > 0) {
    addIncome(state, "entry", state.entryFeeCents);
    g.wallet[slot] = Math.max(g.wallet[slot] - state.entryFeeCents, 0);
  }
  state.stats.guestsWelcomed += 1;
  return slot;
}

/* ------------------------------------------------------------------ */
/* Per-tick guest update                                               */
/* ------------------------------------------------------------------ */

function lowestNeed(g: GuestSoA, slot: number): { need: NeedKey; value: number } {
  const entries: [NeedKey, number][] = [
    ["hunger", g.hunger[slot]!],
    ["thirst", g.thirst[slot]!],
    ["bladder", g.bladder[slot]!],
    ["energy", g.energy[slot]!],
    ["fun", g.fun[slot]!],
  ];
  entries.sort((a, b) => a[1] - b[1]);
  return { need: entries[0]![0], value: entries[0]![1] };
}

function needValue(g: GuestSoA, slot: number, need: NeedKey): number {
  return g[need][slot]!;
}

function addNeed(g: GuestSoA, slot: number, need: NeedKey, amount: number): void {
  g[need][slot] = Math.min(Math.max(needValue(g, slot, need) + amount, 0), 100);
}

/**
 * Would this guest pay what the shop is asking? Fair price scales with the
 * archetype's tolerance (a foodie wears a premium on food; a sightseer does
 * not), and need pressure raises it further — desperation is a real discount
 * on judgement. Never a hard cutoff: past fair, the chance falls off smoothly,
 * so one cent over the line does not empty the queue.
 */
function willPay(
  g: GuestSoA,
  slot: number,
  site: ShopSite,
  needValue: number,
  toleranceMult: number,
): boolean {
  const def = SHOP_DEFS[site.pieceId]!;
  if (def.defaultPriceCents <= 0) {
    return true;
  }
  const tolerance =
    ARCHETYPE_PRICE_TOLERANCE[g.archetype[slot]!]! * toleranceMult;
  const desperation = 1 + (100 - needValue) / 260; // up to ~1.38 at need 0
  const fair = def.defaultPriceCents * SHOP_FAIR_PRICE_RATIO * tolerance * desperation;
  if (site.priceCents <= fair) {
    return true;
  }
  const over = site.priceCents / fair;
  return g.wallet[slot]! > 0 && over < 1.6;
}

interface ShopSite {
  readonly placedId: number;
  readonly pieceId: string;
  /** What this particular shop charges right now. */
  readonly priceCents: number;
  readonly cellX: number;
  readonly cellZ: number;
  readonly approachX: number;
  readonly approachZ: number;
}

/**
 * Shops with an adjacent path cell to queue on (recomputed on world change).
 *
 * Adjacency is checked around every cell of the footprint, not just the anchor.
 * That was invisible while every shop was 1×1 — anchor and footprint were the
 * same cell — but a 4×4 Poly Bistro fronting a path along its far side would
 * have been unreachable, and the park would simply have had a restaurant
 * nobody ever walked into.
 */
export function findShopSites(state: SimState): ShopSite[] {
  const sites: ShopSite[] = [];
  for (const piece of state.world.placed.values()) {
    if (!SHOP_DEFS[piece.pieceId]) {
      continue;
    }
    const site = nearestApproach(state, piece);
    if (site) {
      sites.push(site);
    }
  }
  return sites;
}

/**
 * The approach cell closest to the building's centre, so a guest heading for a
 * big building walks to the middle of its frontage rather than to whichever
 * corner happened to be scanned first.
 *
 * This runs for every shop on every tick, so it walks the footprint's border
 * arithmetically and allocates nothing: a footprint is always a rectangle, and
 * "is this cell part of the building" is four comparisons rather than a lookup
 * in a set of freshly-built coordinate strings.
 */
function nearestApproach(state: SimState, piece: PlacedPiece): ShopSite | null {
  const def = state.world.pieces.get(piece.pieceId);
  const w = def ? (piece.rot % 2 === 0 ? def.footprint.w : def.footprint.d) : 1;
  const d = def ? (piece.rot % 2 === 0 ? def.footprint.d : def.footprint.w) : 1;
  const minX = piece.x;
  const minZ = piece.z;
  const maxX = piece.x + w - 1;
  const maxZ = piece.z + d - 1;
  const centreX = (minX + maxX) / 2;
  const centreZ = (minZ + maxZ) / 2;

  let bestX = 0;
  let bestZ = 0;
  let bestDist = Infinity;
  const consider = (ax: number, az: number): void => {
    if (ax >= minX && ax <= maxX && az >= minZ && az <= maxZ) {
      return; // inside the building itself
    }
    if (!state.world.terrain.inBounds(ax, az)) {
      return;
    }
    if (state.world.pathCells[cellIndex(state.world, ax, az)] !== 1) {
      return;
    }
    const dist = Math.abs(ax - centreX) + Math.abs(az - centreZ);
    if (dist < bestDist) {
      bestDist = dist;
      bestX = ax;
      bestZ = az;
    }
  };
  // Only the border ring can have a neighbour outside the footprint. The edges
  // are walked S, E, N, W — the same priority the old four-neighbour scan used.
  // On a 1×1 shop all four neighbours tie at distance 1, so the order IS the
  // choice, and changing it would quietly re-route guests around every stall
  // already standing in every save.
  for (let x = minX; x <= maxX; x++) {
    consider(x, maxZ + 1);
  }
  for (let z = minZ; z <= maxZ; z++) {
    consider(maxX + 1, z);
  }
  for (let x = minX; x <= maxX; x++) {
    consider(x, minZ - 1);
  }
  for (let z = minZ; z <= maxZ; z++) {
    consider(minX - 1, z);
  }
  if (bestDist === Infinity) {
    return null;
  }
  return {
    placedId: piece.id,
    pieceId: piece.pieceId,
    priceCents: piece.priceCents,
    cellX: piece.x,
    cellZ: piece.z,
    approachX: bestX,
    approachZ: bestZ,
  };
}

function guestCell(state: SimState, slot: number): { x: number; z: number } {
  const g = state.guests;
  return {
    x: Math.floor(g.x[slot]! / CELL_SIZE_METERS),
    z: Math.floor(g.z[slot]! / CELL_SIZE_METERS),
  };
}

function routeTo(state: SimState, slot: number, toX: number, toZ: number): boolean {
  const from = guestCell(state, slot);
  const path = findPath(state, from.x, from.z, toX, toZ);
  if (!path || path.length === 0) {
    return false;
  }
  state.guests.paths.set(slot, path);
  state.guests.state[slot] = GUEST_STATE.walking;
  return true;
}

function beginLeaving(state: SimState, slot: number, thought: string): void {
  const g = state.guests;
  const gate = state.world.terrain.site.gate;
  think(g, slot, thought);
  if (routeTo(state, slot, gate.x, gate.z)) {
    g.state[slot] = GUEST_STATE.leaving;
  } else {
    despawn(state, slot); // stranded off-network: vanish at the spot
  }
}

function despawn(state: SimState, slot: number): void {
  const g = state.guests;
  g.state[slot] = GUEST_STATE.off;
  g.paths.delete(slot);
  g.thoughts.delete(slot);
  g.freeList.push(slot);
}

function setEmote(g: GuestSoA, slot: number, emote: number): void {
  if (g.emoteTtl[slot] === 0) {
    g.emote[slot] = emote;
    g.emoteTtl[slot] = 40; // ≈ 4 s real at 1×
  }
}

/** Is any 4-neighbor of the cell a walkable path? Returns that path cell. */
function pathApproach(
  state: SimState,
  cellX: number,
  cellZ: number,
): { x: number; z: number } | null {
  const w = state.world.terrain.site.cells.w;
  for (const [dx, dz] of [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ] as const) {
    const x = cellX + dx;
    const z = cellZ + dz;
    if (
      state.world.terrain.inBounds(x, z) &&
      state.world.pathCells[cellIndex(state.world, x, z)] === 1
    ) {
      return { x, z };
    }
  }
  void w;
  return null;
}

/** Rides are the fun engine: pick the best archetype match worth the walk. */
function seekRide(state: SimState, slot: number, options: readonly OpenRideOption[]): boolean {
  const g = state.guests;
  // Preference band centers per archetype (family/thrill/foodie/sightseer/superfan).
  const prefE = [3.5, 7.5, 4.5, 3.0, 6.5][g.archetype[slot]!] ?? 4;
  let best: OpenRideOption | null = null;
  let bestScore = -Infinity;
  for (const opt of options) {
    if (opt.queueLen >= 12 || g.wallet[slot]! < opt.priceCents) {
      continue;
    }
    if (!pathApproach(state, opt.entranceX, opt.entranceZ)) {
      continue;
    }
    const here = guestCell(state, slot);
    const dist = Math.abs(opt.entranceX - here.x) + Math.abs(opt.entranceZ - here.z);
    const score = 10 - Math.abs(opt.eStat - prefE) * 1.5 - dist * 0.08 - opt.queueLen * 0.3;
    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  }
  if (!best) {
    return false;
  }
  const approach = pathApproach(state, best.entranceX, best.entranceZ)!;
  if (!routeTo(state, slot, approach.x, approach.z)) {
    return false;
  }
  g.rideId[slot] = best.key;
  think(g, slot, "thought.ride.heading");
  return true;
}

/** How much a shop moves `need` — its primary effect, or its secondary one. */
function servesNeed(def: ShopDef, need: NeedKey): number {
  if (def.satisfies === need) {
    return def.amount;
  }
  if (def.secondary?.need === need) {
    return def.secondary.amount;
  }
  return 0;
}

/**
 * Walk to the best shop for `need`, returning whether the guest set off.
 *
 * A shop counts if it moves the need in the right direction at all, so the
 * Poly Bistro is found by a tired guest even though its Energy is the second
 * effect on a hunger building. Full buildings are skipped here rather than
 * walked to and bounced — being sent across the park to a restaurant with no
 * free table is the kind of small unfairness that reads as the game wasting
 * your guests' time.
 */
function seekShop(
  state: SimState,
  slot: number,
  shopSites: readonly ShopSite[],
  need: NeedKey,
  needValue: number,
  hasWayfinding: boolean,
  complainIfNone: boolean,
): boolean {
  const g = state.guests;
  const here = guestCell(state, slot);
  // Guests only consider shops within reach. An Info Kiosk in the park is
  // the difference between "I can't find anything" and finding the stall two
  // plazas over — GAME_BALANCE §6's wayfinding effect, as a search radius.
  const reach = SHOP_SEARCH_REACH + (hasWayfinding ? INFO_KIOSK_REACH_BONUS : 0);
  const candidates = shopSites.filter(
    (site) =>
      servesNeed(SHOP_DEFS[site.pieceId]!, need) > 0 &&
      Math.abs(site.approachX - here.x) + Math.abs(site.approachZ - here.z) <= reach * 6,
  );
  candidates.sort(
    (a, b) =>
      Math.abs(a.approachX - here.x) +
      Math.abs(a.approachZ - here.z) -
      (Math.abs(b.approachX - here.x) + Math.abs(b.approachZ - here.z)),
  );
  for (const site of candidates) {
    if (g.wallet[slot]! < site.priceCents) {
      continue;
    }
    if (isShopFull(state, site.placedId, SHOP_DEFS[site.pieceId]!)) {
      continue;
    }
    // Price is a real decision, not just an affordability check: a guest who
    // thinks a snack is a rip-off walks past a stall they could afford. The
    // hungrier they are, the more they will put up with.
    if (!willPay(g, slot, site, needValue, state.difficultyMods.priceToleranceMult)) {
      continue;
    }
    if (routeTo(state, slot, site.approachX, site.approachZ)) {
      g.servingShop[slot] = site.placedId;
      return true;
    }
  }
  if (!complainIfNone) {
    return false;
  }
  // Nothing satisfies the need — grump about it and wander on.
  if (candidates.length === 0) {
    think(g, slot, `thought.no.${need}`);
  } else if (candidates.every((site) => g.wallet[slot]! < site.priceCents)) {
    setEmote(g, slot, EMOTE.broke);
    think(g, slot, "thought.broke");
  }
  return false;
}

function decide(
  state: SimState,
  slot: number,
  shopSites: ShopSite[],
  rideOptions: readonly OpenRideOption[],
  /** Hoisted by the caller: one park-wide lookup, not one per guest. */
  hasWayfinding: boolean,
): void {
  const g = state.guests;
  if (!state.parkOpen) {
    beginLeaving(state, slot, "thought.parkClosed");
    return;
  }
  if (state.tick - g.enteredAtTick[slot]! > MAX_STAY_TICKS) {
    beginLeaving(state, slot, "thought.goingHome");
    return;
  }
  const lowest = lowestNeed(g, slot);
  if (lowest.value <= LEAVE_NEED_FLOOR) {
    // Running out of energy is not the park's fault, and a guest who spent four
    // hours here and got tired should not leave as though they had been let
    // down. Every other empty need IS something the park failed to provide, so
    // those keep the angry face and the sour thought. Before the Poly Bistro
    // there was no energy anywhere in the game, so this branch quietly blamed
    // the park for the passage of time.
    if (lowest.need === "energy") {
      beginLeaving(state, slot, "thought.wornOut");
    } else {
      setEmote(g, slot, EMOTE.angry);
      beginLeaving(state, slot, "thought.fedUp");
    }
    return;
  }
  // Fun is handled below, where rides get first refusal — a Gift Kiosk should
  // never out-compete a roller coaster for a guest who wants a good time.
  if (lowest.value < SEEK_THRESHOLD && lowest.need !== "fun") {
    // Guests grumble about missing food, drink and restrooms — those the park
    // is expected to provide from level one. They do NOT grumble about having
    // nowhere to sit down: the only building that restores Energy arrives at
    // L13, so "Nowhere to rest…" every twenty ticks would be a complaint about
    // something the player cannot yet act on, which is the same mistake the
    // worn-out departure above stopped making.
    const worthComplainingAbout = lowest.need !== "energy";
    if (
      seekShop(
        state,
        slot,
        shopSites,
        lowest.need,
        lowest.value,
        hasWayfinding,
        worthComplainingAbout,
      )
    ) {
      return;
    }
  }
  // Rides beat strolling when fun is sagging — and thrill-leaning archetypes
  // chase coasters even while content (GAME_DESIGN §12).
  const thrillish = g.archetype[slot] === 1 || g.archetype[slot] === 4;
  if (g.fun[slot]! < SEEK_THRESHOLD || (thrillish && g.fun[slot]! < 78)) {
    if (seekRide(state, slot, rideOptions)) {
      return;
    }
    // No ride to be had: a souvenir is the consolation, not the first choice.
    if (seekShop(state, slot, shopSites, "fun", g.fun[slot]!, hasWayfinding, false)) {
      return;
    }
  }
  // Stroll: wander to a random path cell (fun trickles back near scenery).
  const pathCells: number[] = [];
  const w = state.world.terrain.site.cells.w;
  for (let i = 0; i < state.world.pathCells.length; i++) {
    if (state.world.pathCells[i] === 1) {
      pathCells.push(i);
    }
  }
  if (pathCells.length > 0) {
    const target = pathCells[state.rng.guests.nextInt(0, pathCells.length - 1)]!;
    routeTo(state, slot, target % w, Math.floor(target / w));
  }
}

function arriveAtDestination(state: SimState, slot: number): void {
  const g = state.guests;
  if (g.state[slot] === GUEST_STATE.leaving) {
    state.stats.guestsDeparted += 1;
    const mood = moodOf(g, slot);
    if (mood >= 2) {
      state.stats.happyDepartures += 1;
    }
    // Exit-joy XP (GAME_BALANCE §9.1: 1–6 by mood). Deferred in M2 with the
    // note "switches on with the rating system" — which now exists, so the
    // level curve finally advances from running a park guests enjoy rather
    // than only from ticking goal cards.
    state.xp += EXIT_JOY_XP[mood] ?? 1;
    despawn(state, slot);
    return;
  }
  // Heading to a ride: join its queue (or shrug and re-decide if it filled).
  if (g.rideId[slot] !== 0) {
    const key = g.rideId[slot]!;
    if (tryEnqueue(state, slot, key)) {
      g.state[slot] = GUEST_STATE.queuing;
      g.serveTicks[slot] = 0; // repurposed as queue-patience counter
      think(g, slot, "thought.ride.queued");
    } else {
      g.rideId[slot] = 0;
      g.state[slot] = GUEST_STATE.idle;
      think(g, slot, "thought.ride.full");
    }
    return;
  }
  const shopId = g.servingShop[slot]!;
  if (shopId >= 0) {
    const piece = state.world.placed.get(shopId);
    const def = piece ? SHOP_DEFS[piece.pieceId] : undefined;
    if (piece && def) {
      // A seated building can be full. Shrug and re-decide rather than wait —
      // the same shape as a full ride queue, and it keeps the guest free to go
      // do something else instead of being pinned by the park (ADR-15).
      if (isShopFull(state, shopId, def)) {
        g.servingShop[slot] = -1;
        g.state[slot] = GUEST_STATE.idle;
        think(g, slot, "thought.shop.full");
        return;
      }
      g.state[slot] = GUEST_STATE.serving;
      g.serveTicks[slot] = def.serveTicks;
      enterShop(state, shopId);
      return;
    }
    g.servingShop[slot] = -1; // shop was bulldozed mid-walk
  }
  g.state[slot] = GUEST_STATE.idle;
}

/* ---- Seat occupancy (GAME_BALANCE §6) ---------------------------------- */

export function rebuildShopOccupancy(g: GuestSoA): Map<number, number> {
  const occupancy = new Map<number, number>();
  for (let slot = 0; slot < g.count; slot++) {
    const shopId = g.servingShop[slot]!;
    if (g.state[slot] === GUEST_STATE.serving && shopId >= 0) {
      occupancy.set(shopId, (occupancy.get(shopId) ?? 0) + 1);
    }
  }
  return occupancy;
}

export function shopOccupancyOf(state: SimState, placedId: number): number {
  return state.shopOccupancy.get(placedId) ?? 0;
}

function isShopFull(state: SimState, placedId: number, def: ShopDef): boolean {
  return def.capacity !== undefined && shopOccupancyOf(state, placedId) >= def.capacity;
}

function enterShop(state: SimState, placedId: number): void {
  state.shopOccupancy.set(placedId, (state.shopOccupancy.get(placedId) ?? 0) + 1);
}

function leaveShop(state: SimState, placedId: number): void {
  const left = (state.shopOccupancy.get(placedId) ?? 1) - 1;
  // Drop the key at zero so demolishing a shop cannot leave a counter behind.
  if (left <= 0) {
    state.shopOccupancy.delete(placedId);
  } else {
    state.shopOccupancy.set(placedId, left);
  }
}

function finishServing(state: SimState, slot: number): void {
  const g = state.guests;
  const servedId = g.servingShop[slot]!;
  const piece = state.world.placed.get(servedId);
  g.servingShop[slot] = -1;
  g.state[slot] = GUEST_STATE.idle;
  // Free the seat before any early return — a guest served by a shop that was
  // demolished mid-meal still has to stop occupying it.
  if (servedId >= 0) {
    leaveShop(state, servedId);
  }
  if (!piece) {
    return;
  }
  const def = SHOP_DEFS[piece.pieceId];
  if (!def) {
    return;
  }
  if (piece.priceCents > 0) {
    if (g.wallet[slot]! < piece.priceCents) {
      think(g, slot, "thought.broke");
      return;
    }
    // Souvenirs sell by the basket: one item always, a second when the park is
    // one guests are delighted to take something home from (GAME_DESIGN §10).
    const items =
      def.effect === "souvenir" &&
      g.wallet[slot]! >= piece.priceCents * 2 &&
      state.rng.guests.chance(souvenirSecondItemChance(state.rating.stars))
        ? 2
        : 1;
    const spent = piece.priceCents * items;
    g.wallet[slot] = g.wallet[slot]! - spent;
    addIncome(state, def.ledgerCategory, spent);
    addExpense(state, "goods", def.unitCostCents * (items - 1));
  }
  if (def.effect === "wallet") {
    // The fee is the park's product; the cash is what keeps the guest spending
    // instead of trudging to the gate broke.
    g.wallet[slot] = g.wallet[slot]! + ATM_REFILL_CENTS;
    think(g, slot, "thought.cashedUp");
  }
  addExpense(state, "goods", def.unitCostCents);
  addNeed(g, slot, def.satisfies, def.amount);
  // The second need, which may pull the other way: the Grill Garden feeds you
  // and leaves you thirsty (GAME_BALANCE §6).
  if (def.secondary) {
    addNeed(g, slot, def.secondary.need, def.secondary.amount);
  }
  setEmote(g, slot, EMOTE.happy);
  if (def.effect === "souvenir") {
    think(g, slot, "thought.souvenir");
  } else if (def.satisfies === "hunger") {
    state.stats.mealsServed += 1;
    think(g, slot, "thought.ate");
  } else if (def.satisfies === "thirst") {
    state.stats.drinksServed += 1;
    think(g, slot, "thought.drank");
  } else {
    think(g, slot, "thought.relieved");
  }
  // Litter happens a few steps later, on a path cell near the shop.
  // A litter wave or an influencer swarm makes guests messier — one roll,
  // scaled, rather than a second source of litter nobody can see the cause of.
  const litterChance = Math.min(1, def.litterChance * eventLitterMult(state));
  if (litterChance > 0 && state.rng.guests.chance(litterChance)) {
    const cell = guestCell(state, slot);
    state.litter.push({
      id: state.stats.litterSpawned + 1,
      cellX: cell.x,
      cellZ: cell.z,
    });
    state.stats.litterSpawned += 1;
  }
}

export function moodOf(g: GuestSoA, slot: number): number {
  const average =
    (g.hunger[slot]! + g.thirst[slot]! + g.bladder[slot]! + g.energy[slot]! + g.fun[slot]!) / 5;
  return average > 75 ? 3 : average > 50 ? 2 : average > 30 ? 1 : 0; // delighted/content/grumpy/miserable
}

export function tickGuests(state: SimState): void {
  const g = state.guests;

  // Arrivals: rate is "guests per ~10 game-minutes" (50 ticks) — lively at 1×.
  // Rides join the appeal model per the GAME_BALANCE §4.1 M3 note.
  state.spawnAccumulator += arrivalsPerMinute(state) / 50;
  while (state.spawnAccumulator >= 1) {
    state.spawnAccumulator -= 1;
    spawnGuest(state);
  }

  const shopSites = findShopSites(state);
  const rideOptions = openRideOptions(state);

  // Hoisted out of the per-guest loop: one lookup, not one per guest.
  const thirstWeather = weatherThirstMult(state);
  const hasWayfinding = shopSites.some((site) => SHOP_DEFS[site.pieceId]?.effect === "wayfinding");
  for (let slot = 0; slot < g.count; slot++) {
    const guestState = g.state[slot]!;
    if (guestState === GUEST_STATE.off) {
      continue;
    }
    // On board: the ride owns this guest until it unloads them.
    if (guestState === GUEST_STATE.riding) {
      continue;
    }
    g.px[slot] = g.x[slot]!;
    g.pz[slot] = g.z[slot]!;

    // Needs decay (fun only while idle — strolling is its own reward).
    const decay = state.difficultyMods.needDecayMult;
    addNeed(g, slot, "hunger", -DECAY_PER_TICK.hunger * decay);
    // Thirst is the one need weather touches — a heatwave makes guests
    // thirsty, not hungry or tired (GAME_BALANCE "one knob per concept").
    addNeed(g, slot, "thirst", -DECAY_PER_TICK.thirst * decay * thirstWeather);
    addNeed(g, slot, "bladder", -DECAY_PER_TICK.bladder * decay);
    addNeed(g, slot, "energy", -DECAY_PER_TICK.energy * decay);
    if (
      guestState === GUEST_STATE.idle ||
      guestState === GUEST_STATE.serving ||
      guestState === GUEST_STATE.queuing
    ) {
      addNeed(g, slot, "fun", -DECAY_PER_TICK.fun);
    } else if (guestState === GUEST_STATE.walking) {
      addNeed(g, slot, "fun", DECAY_PER_TICK.fun * 0.6); // strolling the gardens
    }

    if (g.emoteTtl[slot]! > 0) {
      g.emoteTtl[slot] = g.emoteTtl[slot]! - 1;
      if (g.emoteTtl[slot] === 0) {
        g.emote[slot] = EMOTE.none;
      }
    } else {
      const lowest = lowestNeed(g, slot);
      if (lowest.value < EMOTE_THRESHOLD) {
        const emoteFor: Record<NeedKey, number> = {
          hunger: EMOTE.hungry,
          thirst: EMOTE.thirsty,
          bladder: EMOTE.needToilet,
          energy: EMOTE.tired,
          fun: EMOTE.angry,
        };
        setEmote(g, slot, emoteFor[lowest.need]);
        think(g, slot, `thought.low.${lowest.need}`);
      } else if (moodOf(g, slot) === 3 && state.rng.guests.chance(0.002)) {
        setEmote(g, slot, EMOTE.heart);
      }
    }

    if (guestState === GUEST_STATE.serving) {
      g.serveTicks[slot] = g.serveTicks[slot]! - 1;
      if (g.serveTicks[slot] === 0) {
        finishServing(state, slot);
      }
      continue;
    }

    if (guestState === GUEST_STATE.walking || guestState === GUEST_STATE.leaving) {
      const path = g.paths.get(slot);
      if (!path || path.length === 0) {
        arriveAtDestination(state, slot);
        continue;
      }
      const w = state.world.terrain.site.cells.w;
      const nextCell = path[0]!;
      const targetX = ((nextCell % w) + 0.5) * CELL_SIZE_METERS;
      const targetZ = (Math.floor(nextCell / w) + 0.5) * CELL_SIZE_METERS;
      const dx = targetX - g.x[slot]!;
      const dz = targetZ - g.z[slot]!;
      const distance = Math.hypot(dx, dz);
      // Visual walking speed: meters per REAL second at 1× (tick = 100 ms).
      const step = WALK_SPEED * 0.1;
      if (distance <= step) {
        g.x[slot] = targetX;
        g.z[slot] = targetZ;
        path.shift();
        if (path.length === 0) {
          arriveAtDestination(state, slot);
        }
      } else {
        g.x[slot] = g.x[slot]! + (dx / distance) * step;
        g.z[slot] = g.z[slot]! + (dz / distance) * step;
      }
      continue;
    }

    // Queuing: hold position, grow impatient, bail after ~2 game-hours.
    if (guestState === GUEST_STATE.queuing) {
      g.serveTicks[slot] = g.serveTicks[slot]! + 1;
      if (g.serveTicks[slot]! > 600) {
        g.state[slot] = GUEST_STATE.idle;
        g.rideId[slot] = 0;
        g.serveTicks[slot] = 0;
        setEmote(g, slot, EMOTE.angry);
        think(g, slot, "thought.queue.gaveUp");
      }
      continue;
    }

    // idle: staggered decisions
    if ((state.tick + slot) % DECIDE_PERIOD === 0) {
      decide(state, slot, shopSites, rideOptions, hasWayfinding);
    }
  }
}

/** Count of live guests (HUD + tests). */
export function liveGuestCount(g: GuestSoA): number {
  let count = 0;
  for (let slot = 0; slot < g.count; slot++) {
    if (g.state[slot] !== GUEST_STATE.off) {
      count += 1;
    }
  }
  return count;
}

export function guestNeedsSnapshot(g: GuestSoA, slot: number) {
  return {
    hunger: g.hunger[slot]!,
    thirst: g.thirst[slot]!,
    bladder: g.bladder[slot]!,
    energy: g.energy[slot]!,
    fun: g.fun[slot]!,
    wallet: money(g.wallet[slot]!),
    mood: moodOf(g, slot),
    archetype: ARCHETYPES[g.archetype[slot]!]!,
    thoughts: [...(g.thoughts.get(slot) ?? [])],
  };
}
