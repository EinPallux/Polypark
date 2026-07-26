import { CELL_SIZE_METERS } from "@/shared/grid";
import { money } from "@/shared/money";
import { SHOP_DEFS, type NeedKey } from "@/content/shops";
import { type SimState } from "../state";
import { addIncome, addExpense } from "../economy/ledger";
import { cellIndex } from "../world/world";
import { GAME_SECONDS_PER_TICK } from "../core/loop";

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

export const GUEST_STATE = {
  off: 0,
  walking: 1,
  idle: 2,
  serving: 3,
  leaving: 4,
} as const;

export const EMOTE = {
  none: 0,
  happy: 1,
  hungry: 2,
  thirsty: 3,
  needToilet: 4,
  tired: 5,
  angry: 6,
  broke: 7,
  heart: 8,
} as const;

export const ARCHETYPES = ["family", "thrill", "foodie", "sightseer", "superfan"] as const;
const ARCHETYPE_WALLET_CENTS = [110_00, 70_00, 95_00, 55_00, 160_00] as const;
const ARCHETYPE_WEIGHTS = [0.34, 0.26, 0.16, 0.18, 0.06] as const;

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

const pathCache = new Map<number, number[] | null>();

function isWalkable(state: SimState, x: number, z: number): boolean {
  if (!state.world.terrain.inBounds(x, z)) {
    return false;
  }
  const index = cellIndex(state.world, x, z);
  if (state.world.pathCells[index] === 1) {
    return true;
  }
  // The gate forecourt (small lawn apron) is walkable so paths built NEAR the
  // gate connect — the visible gate build lands in M3 (design note in CHANGELOG).
  const gate = state.world.terrain.site.gate;
  return (
    Math.abs(x - gate.x) <= 4 &&
    Math.abs(z - gate.z) <= 4 &&
    !state.world.terrain.isWater(x, z) &&
    state.world.terrain.slopeClassAt(x, z) !== "steep"
  );
}

/** A* over path cells; returns cell indices from start (exclusive) to goal, or null. */
export function findPath(
  state: SimState,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): number[] | null {
  const w = state.world.terrain.site.cells.w;
  const key = (fromZ * w + fromX) * 65_536 + (toZ * w + toX);
  const cached = pathCache.get(key);
  if (cached !== undefined) {
    return cached ? [...cached] : null;
  }

  const start = fromZ * w + fromX;
  const goal = toZ * w + toX;
  const open: number[] = [start];
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>([[start, 0]]);
  const fScore = new Map<number, number>([
    [start, Math.abs(toX - fromX) + Math.abs(toZ - fromZ)],
  ]);

  let found = false;
  let iterations = 0;
  while (open.length > 0 && iterations < 4_000) {
    iterations += 1;
    let bestIndex = 0;
    for (let i = 1; i < open.length; i++) {
      if ((fScore.get(open[i]!) ?? Infinity) < (fScore.get(open[bestIndex]!) ?? Infinity)) {
        bestIndex = i;
      }
    }
    const current = open.splice(bestIndex, 1)[0]!;
    if (current === goal) {
      found = true;
      break;
    }
    const cx = current % w;
    const cz = Math.floor(current / w);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!isWalkable(state, nx, nz)) {
        continue;
      }
      const neighbor = nz * w + nx;
      const tentative = (gScore.get(current) ?? Infinity) + 1;
      if (tentative < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentative);
        fScore.set(neighbor, tentative + Math.abs(toX - nx) + Math.abs(toZ - nz));
        if (!open.includes(neighbor)) {
          open.push(neighbor);
        }
      }
    }
  }

  let result: number[] | null = null;
  if (found) {
    const chain: number[] = [];
    let node = goal;
    while (node !== start) {
      chain.push(node);
      node = cameFrom.get(node)!;
    }
    chain.reverse();
    result = chain;
  }
  if (pathCache.size > 600) {
    pathCache.clear();
  }
  pathCache.set(key, result ? [...result] : null);
  return result;
}

/** Call when the path network changes (build commands bump worldVersion). */
export function invalidatePathCache(): void {
  pathCache.clear();
}

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
  const appeal = 1.2 + shops * 1.6 + scenery * 0.06 + Math.min(pathCellCount * 0.04, 4);
  const fairEntry = 8_00 + shops * 1_00 + Math.min(scenery * 4, 3_00);
  const elasticity = Math.min(
    Math.max(1.6 - (state.entryFeeCents / fairEntry) ** 1.4, 0.1),
    1.3,
  );
  return appeal * rhythm * elasticity;
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
  const roll = rng.next();
  let archetype = 0;
  let cumulative = 0;
  for (let i = 0; i < ARCHETYPE_WEIGHTS.length; i++) {
    cumulative += ARCHETYPE_WEIGHTS[i]!;
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

interface ShopSite {
  readonly placedId: number;
  readonly pieceId: string;
  readonly cellX: number;
  readonly cellZ: number;
  readonly approachX: number;
  readonly approachZ: number;
}

/** Shops with an adjacent path cell to queue on (recomputed on world change). */
export function findShopSites(state: SimState): ShopSite[] {
  const sites: ShopSite[] = [];
  for (const piece of state.world.placed.values()) {
    if (!SHOP_DEFS[piece.pieceId]) {
      continue;
    }
    for (const [dx, dz] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ] as const) {
      const ax = piece.x + dx;
      const az = piece.z + dz;
      if (
        state.world.terrain.inBounds(ax, az) &&
        state.world.pathCells[cellIndex(state.world, ax, az)] === 1
      ) {
        sites.push({
          placedId: piece.id,
          pieceId: piece.pieceId,
          cellX: piece.x,
          cellZ: piece.z,
          approachX: ax,
          approachZ: az,
        });
        break;
      }
    }
  }
  return sites;
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

function decide(state: SimState, slot: number, shopSites: ShopSite[]): void {
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
    setEmote(g, slot, EMOTE.angry);
    beginLeaving(state, slot, "thought.fedUp");
    return;
  }
  if (lowest.value < SEEK_THRESHOLD && lowest.need !== "fun" && lowest.need !== "energy") {
    // Find the nearest reachable shop satisfying the need.
    const candidates = shopSites.filter(
      (site) => SHOP_DEFS[site.pieceId]!.satisfies === lowest.need,
    );
    const here = guestCell(state, slot);
    candidates.sort(
      (a, b) =>
        Math.abs(a.approachX - here.x) +
        Math.abs(a.approachZ - here.z) -
        (Math.abs(b.approachX - here.x) + Math.abs(b.approachZ - here.z)),
    );
    for (const site of candidates) {
      const def = SHOP_DEFS[site.pieceId]!;
      if (g.wallet[slot]! < def.defaultPriceCents) {
        continue;
      }
      if (routeTo(state, slot, site.approachX, site.approachZ)) {
        g.servingShop[slot] = site.placedId;
        return;
      }
    }
    // Nothing satisfies the need — grump about it and wander on.
    if (candidates.length === 0) {
      think(g, slot, `thought.no.${lowest.need}`);
    } else if (
      candidates.every((site) => g.wallet[slot]! < SHOP_DEFS[site.pieceId]!.defaultPriceCents)
    ) {
      setEmote(g, slot, EMOTE.broke);
      think(g, slot, "thought.broke");
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
    despawn(state, slot);
    return;
  }
  const shopId = g.servingShop[slot]!;
  if (shopId >= 0) {
    const piece = state.world.placed.get(shopId);
    const def = piece ? SHOP_DEFS[piece.pieceId] : undefined;
    if (piece && def) {
      g.state[slot] = GUEST_STATE.serving;
      g.serveTicks[slot] = def.serveTicks;
      return;
    }
    g.servingShop[slot] = -1; // shop was bulldozed mid-walk
  }
  g.state[slot] = GUEST_STATE.idle;
}

function finishServing(state: SimState, slot: number): void {
  const g = state.guests;
  const piece = state.world.placed.get(g.servingShop[slot]!);
  g.servingShop[slot] = -1;
  g.state[slot] = GUEST_STATE.idle;
  if (!piece) {
    return;
  }
  const def = SHOP_DEFS[piece.pieceId];
  if (!def) {
    return;
  }
  if (def.defaultPriceCents > 0) {
    if (g.wallet[slot]! < def.defaultPriceCents) {
      think(g, slot, "thought.broke");
      return;
    }
    g.wallet[slot] = g.wallet[slot]! - def.defaultPriceCents;
    addIncome(state, def.ledgerCategory, def.defaultPriceCents);
  }
  addExpense(state, "goods", def.unitCostCents);
  addNeed(g, slot, def.satisfies, def.amount);
  setEmote(g, slot, EMOTE.happy);
  if (def.satisfies === "hunger") {
    state.stats.mealsServed += 1;
    think(g, slot, "thought.ate");
  } else if (def.satisfies === "thirst") {
    state.stats.drinksServed += 1;
    think(g, slot, "thought.drank");
  } else {
    think(g, slot, "thought.relieved");
  }
  // Litter happens a few steps later, on a path cell near the shop.
  if (def.litterChance > 0 && state.rng.guests.chance(def.litterChance)) {
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
  // M2 tuning baseline; the full appeal model lands with rides (GAME_BALANCE §4.1).
  state.spawnAccumulator += arrivalsPerMinute(state) / 50;
  while (state.spawnAccumulator >= 1) {
    state.spawnAccumulator -= 1;
    spawnGuest(state);
  }

  const shopSites = findShopSites(state);

  for (let slot = 0; slot < g.count; slot++) {
    const guestState = g.state[slot]!;
    if (guestState === GUEST_STATE.off) {
      continue;
    }
    g.px[slot] = g.x[slot]!;
    g.pz[slot] = g.z[slot]!;

    // Needs decay (fun only while idle — strolling is its own reward).
    addNeed(g, slot, "hunger", -DECAY_PER_TICK.hunger);
    addNeed(g, slot, "thirst", -DECAY_PER_TICK.thirst);
    addNeed(g, slot, "bladder", -DECAY_PER_TICK.bladder);
    addNeed(g, slot, "energy", -DECAY_PER_TICK.energy);
    if (guestState === GUEST_STATE.idle || guestState === GUEST_STATE.serving) {
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

    // idle: staggered decisions
    if ((state.tick + slot) % DECIDE_PERIOD === 0) {
      decide(state, slot, shopSites);
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
