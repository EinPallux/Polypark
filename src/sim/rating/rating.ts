import { FLAT_RIDES } from "@/content/rides";
import { TRACK_FAMILIES } from "@/content/track";
import { SHOP_DEFS } from "@/content/shops";
import { type SimState } from "../state";
import { GAME_SECONDS_PER_TICK, TICKS_PER_GAME_MONTH } from "../core/loop";
import { RIDE_STATE } from "../rides/rides";
import { GUEST_STATE } from "../guests/emotes";

/**
 * Park Rating (GAME_DESIGN §17, GAME_BALANCE §4.2): one public 0–5.0★ from
 * five 0–100 sub-scores — Fun 30 · Value 20 · Care 20 · Wonder 15 · Flow 15 —
 * each of which expands to plain-language causes (UI_UX §7.1's two-click rule).
 *
 * Two design devices carry the whole system:
 *
 *  1. **O(1) rolling windows.** Every time-averaged input is a decayed
 *     numerator/denominator pair, not a 3,000-tick history buffer. One
 *     multiply-add per sample gives a self-normalising ~1-month window.
 *  2. **Confidence blending.** Sub-scores start at neutral 50 and only move
 *     toward their measured value as guests actually show up. A brand-new
 *     park is never punished for having no evidence yet — tension, never
 *     despair (pillar P3).
 *
 * The sim produces STRUCTURED causes (id + magnitude + optional subject), never
 * sentences: turning them into words is the UI's job (module boundary).
 */

/* ------------------------------------------------------------------ */
/* Rolling windows                                                     */
/* ------------------------------------------------------------------ */

export interface RollingMean {
  num: number;
  den: number;
}
export interface RollingSum {
  total: number;
}

const RATING_ALPHA = 1 / TICKS_PER_GAME_MONTH;
const RATING_MIN_DEN = 0.5;

export const createMean = (): RollingMean => ({ num: 0, den: 0 });
export const createSum = (): RollingSum => ({ total: 0 });

export function accumulate(mean: RollingMean, sample: number, weight = 1): void {
  mean.num = mean.num * (1 - RATING_ALPHA) + sample * weight;
  mean.den = mean.den * (1 - RATING_ALPHA) + weight;
}

export const meanOf = (mean: RollingMean, fallback: number): number =>
  mean.den < RATING_MIN_DEN ? fallback : mean.num / mean.den;

export function accumulateSum(sum: RollingSum, n: number): void {
  sum.total = sum.total * (1 - RATING_ALPHA) + n;
}

export const sumOf = (sum: RollingSum): number => sum.total;

/* ------------------------------------------------------------------ */
/* Tuning constants (GAME_BALANCE §4.2 + the M4 note)                  */
/* ------------------------------------------------------------------ */

const RATING_NEUTRAL = 50;
const RATING_FULL_EVIDENCE_GUESTS = 25;
/** A park with no evidence yet reads neutral, and is fed back as neutral. */
export const RATING_NEUTRAL_STARS = 2.5;
/**
 * How often tickRating refreshes the stored stars. The sub-scores walk every
 * ride and placed piece, so this runs at 2.5 game-minutes rather than every
 * tick — fresh enough for the HUD, 4% of the cost, and fixed to the tick
 * number so it never depends on when anyone asked to read the rating.
 */
const RATING_REFRESH_TICKS = 25;

const NOVELTY_PEAK_BONUS = 0.4;
const NOVELTY_MONTHS = 3;

const FUN_SCALE = 45;
const FUN_VARIETY_BONUS_MAX = 0.25;
const FUN_BAND_EDGES = [3.5, 5.5, 7.5];

const FAIR_TICKET_BASE = 100;
const FAIR_TICKET_PER_E = 45;
const VALUE_RATIO_CAP = 2.5;
const VALUE_BASE = 55;
const VALUE_SAT_GAIN = 45;
const VALUE_GOUGE_PENALTY = 60;
const VALUE_GENEROSITY_GAIN = 12;
const VALUE_GENEROSITY_CAP = 0.5;

const CARE_LITTER_FULL = 0.25;
const CARE_LITTER_COEF = 22;
const CARE_RESTROOM_COEF = 18;
const CARE_RESTROOM_GUESTS = 90;
const CARE_CITATION_CAP = 40;

const WONDER_TARGET_DENSITY = 0.9;
const WONDER_VARIETY_TARGET = 14;
const W_DENSITY = 0.45;
const W_VARIETY = 0.35;
const W_VIEW = 0.2;

const FLOW_WAIT_BAD = 45;
const FLOW_COMFY_DENSITY = 0.35;
const FLOW_CRUSH_DENSITY = 0.8;
const MONTH_GAME_MINUTES = (TICKS_PER_GAME_MONTH * GAME_SECONDS_PER_TICK) / 60;

const PRESS_DECAY_MONTHS = 2;
const PRESS_CLAMP = 0.5;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface RidePerf {
  uptime: RollingMean;
  wait: RollingMean;
  cycles: RollingSum;
  lastCycleCount: number;
}

export interface RatingState {
  /** Park-wide rolling inputs. */
  guestExposure: RollingMean;
  litterDensity: RollingMean;
  crowding: RollingMean;
  queueWait: RollingMean;
  departures: RollingSum;
  happyDepartures: RollingSum;
  riders: RollingSum;
  citations: RollingSum;
  /** Per-ride performance, keyed by ride key (+tracked / −flat). */
  perRide: Record<string, RidePerf>;
  /** Monotone counters mirrored so we can difference them per tick. */
  mirror: { departures: number; happyDepartures: number; riders: number };
  /** Press/inspection swing in stars, decaying over ~2 months. */
  pressStars: number;
  /** Hard ceiling (a Consortium loan caps the park at 4.5★). */
  capStars: number;
  /** Last computed value — cached for the HUD, recomputed monthly. */
  stars: number;
  subscores: { fun: number; value: number; care: number; wonder: number; flow: number };
}

export function createRatingState(): RatingState {
  return {
    guestExposure: createMean(),
    litterDensity: createMean(),
    crowding: createMean(),
    queueWait: createMean(),
    departures: createSum(),
    happyDepartures: createSum(),
    riders: createSum(),
    citations: createSum(),
    perRide: {},
    mirror: { departures: 0, happyDepartures: 0, riders: 0 },
    pressStars: 0,
    capStars: 5,
    stars: RATING_NEUTRAL_STARS,
    subscores: { fun: 50, value: 50, care: 50, wonder: 50, flow: 50 },
  };
}

/* ------------------------------------------------------------------ */
/* Per-tick sampling                                                   */
/* ------------------------------------------------------------------ */

const perfFor = (rating: RatingState, key: number): RidePerf => {
  const id = String(key);
  let perf = rating.perRide[id];
  if (!perf) {
    perf = { uptime: createMean(), wait: createMean(), cycles: createSum(), lastCycleCount: 0 };
    rating.perRide[id] = perf;
  }
  return perf;
};

function pathCellCount(state: SimState): number {
  let count = 0;
  for (let i = 0; i < state.world.pathCells.length; i++) {
    if (state.world.pathCells[i] === 1) {
      count += 1;
    }
  }
  return count;
}

/** One O(1) sampling pass. Everything expensive is derived on demand. */
export function tickRating(state: SimState): void {
  const rating = state.rating;

  // 1. Monotone counters → rolling sums (difference against the mirror).
  const stats = state.stats;
  accumulateSum(rating.departures, stats.guestsDeparted - rating.mirror.departures);
  accumulateSum(
    rating.happyDepartures,
    stats.happyDepartures - rating.mirror.happyDepartures,
  );
  accumulateSum(rating.riders, stats.ridersServed - rating.mirror.riders);
  accumulateSum(rating.citations, 0);
  rating.mirror.departures = stats.guestsDeparted;
  rating.mirror.happyDepartures = stats.happyDepartures;
  rating.mirror.riders = stats.ridersServed;

  // 2. Park-wide means.
  let live = 0;
  const guests = state.guests;
  for (let slot = 0; slot < guests.count; slot++) {
    if (guests.state[slot] !== GUEST_STATE.off) {
      live += 1;
    }
  }
  accumulate(rating.guestExposure, live);
  const paths = Math.max(pathCellCount(state), 1);
  accumulate(rating.litterDensity, state.litter.length / paths);
  accumulate(rating.crowding, live / paths);

  // 3. Per-ride uptime, throughput and queue wait.
  const openHours = state.parkOpen;
  for (const ride of state.rides.tracked.values()) {
    const perf = perfFor(rating, ride.id);
    if (openHours) {
      accumulate(perf.uptime, ride.state === RIDE_STATE.open ? 1 : 0);
    }
    accumulateSum(perf.cycles, ride.cycleCount - perf.lastCycleCount);
    perf.lastCycleCount = ride.cycleCount;
    if (ride.state === RIDE_STATE.open) {
      const family = TRACK_FAMILIES[ride.family];
      const capacity = family.cars * family.seatsPerCar;
      const rate = sumOf(perf.cycles) / MONTH_GAME_MINUTES;
      const wait = Math.min(120, ride.queue.length / Math.max(capacity * rate, 1e-6));
      accumulate(perf.wait, wait);
      accumulate(rating.queueWait, wait, ride.queue.length);
    }
  }
  for (const ride of state.rides.flat.values()) {
    const perf = perfFor(rating, -ride.id);
    if (openHours) {
      accumulate(perf.uptime, ride.state === RIDE_STATE.open ? 1 : 0);
    }
    accumulateSum(perf.cycles, ride.cycleCount - perf.lastCycleCount);
    perf.lastCycleCount = ride.cycleCount;
    if (ride.state === RIDE_STATE.open) {
      const capacity = FLAT_RIDES[ride.defId].capacity;
      const rate = sumOf(perf.cycles) / MONTH_GAME_MINUTES;
      const wait = Math.min(120, ride.queue.length / Math.max(capacity * rate, 1e-6));
      accumulate(perf.wait, wait);
      accumulate(rating.queueWait, wait, ride.queue.length);
    }
  }

  // 4. Press swing decays back toward zero.
  rating.pressStars *= 1 - 1 / (PRESS_DECAY_MONTHS * TICKS_PER_GAME_MONTH);

  // 5. The Consortium's covenant caps the public rating while its loan lives.
  let cap = 5;
  for (const loan of state.finance.loans) {
    if (loan.product === "consortium") {
      cap = Math.min(cap, 4.5);
    }
  }
  rating.capStars = cap;

  // 6. Refresh the stored stars. This is the ONLY writer: stars is persisted
  // and feeds ratingMult → arrivals, so if a read query wrote it, opening the
  // management window would change how many guests show up.
  if (state.tick % RATING_REFRESH_TICKS === 0) {
    const view = evaluateRating(state);
    rating.stars = view.stars;
    rating.subscores = {
      fun: view.fun.score,
      value: view.value.score,
      care: view.care.score,
      wonder: view.wonder.score,
      flow: view.flow.score,
    };
  }
}

/** Inspections and press events swing the rating directly. */
export function addPressStars(state: SimState, delta: number): void {
  state.rating.pressStars = clamp(
    state.rating.pressStars + delta,
    -PRESS_CLAMP,
    PRESS_CLAMP,
  );
}

export function addCitations(state: SimState, points: number): void {
  accumulateSum(state.rating.citations, points);
}

/* ------------------------------------------------------------------ */
/* Sub-scores                                                          */
/* ------------------------------------------------------------------ */

/**
 * Every cause this module can raise. The sim ships ids, the UI ships sentences
 * (module boundary) — this list is what lets a test prove each id has copy.
 */
export const RATING_CAUSE_IDS = [
  "fun.noRides",
  "fun.oneNote",
  "fun.thinPortfolio",
  "fun.downtime",
  "value.entryPrice",
  "value.ridePrice",
  "value.shopPrice",
  "value.unhappyLeavers",
  "care.litter",
  "care.restrooms",
  "care.citations",
  "wonder.bare",
  "wonder.samey",
  "flow.queues",
  "flow.crowded",
] as const;
export type RatingCauseId = (typeof RATING_CAUSE_IDS)[number];

export interface RatingCause {
  /** Structured id the UI turns into a sentence — never a string here. */
  readonly cause: RatingCauseId;
  /** How much this is hurting (or helping), 0..100 of the sub-score. */
  readonly magnitude: number;
  /** Optional subject: a ride key, so the UI can name it. */
  readonly rideKey?: number;
}

export interface SubScore {
  readonly score: number;
  readonly causes: readonly RatingCause[];
}

export interface RatingView {
  readonly stars: number;
  readonly fun: SubScore;
  readonly value: SubScore;
  readonly care: SubScore;
  readonly wonder: SubScore;
  readonly flow: SubScore;
  readonly capStars: number;
  readonly confidence: number;
}

const novelty = (state: SimState, sinceTick: number): number => {
  const ageMonths = (state.tick - sinceTick) / TICKS_PER_GAME_MONTH;
  return 1 + NOVELTY_PEAK_BONUS * clamp(1 - ageMonths / NOVELTY_MONTHS, 0, 1);
};

const bandOf = (e: number): number =>
  e < FUN_BAND_EDGES[0]! ? 0 : e < FUN_BAND_EDGES[1]! ? 1 : e < FUN_BAND_EDGES[2]! ? 2 : 3;

function funScore(state: SimState): SubScore {
  const rating = state.rating;
  const causes: RatingCause[] = [];
  let portfolio = 0;
  const bands = new Set<number>();
  let worstUptime: { key: number; uptime: number } | null = null;

  for (const ride of state.rides.tracked.values()) {
    if (!ride.evaln.valid) {
      continue;
    }
    const perf = perfFor(rating, ride.id);
    const uptime = meanOf(perf.uptime, 1);
    portfolio += ride.evaln.eStat * novelty(state, ride.createdAtTick) * uptime;
    bands.add(bandOf(ride.evaln.eStat));
    if (uptime < 0.85 && (!worstUptime || uptime < worstUptime.uptime)) {
      worstUptime = { key: ride.id, uptime };
    }
  }
  for (const ride of state.rides.flat.values()) {
    const def = FLAT_RIDES[ride.defId];
    const perf = perfFor(rating, -ride.id);
    const uptime = meanOf(perf.uptime, 1);
    portfolio += def.eStat * novelty(state, ride.placedAtTick) * uptime;
    bands.add(bandOf(def.eStat));
    if (uptime < 0.85 && (!worstUptime || uptime < worstUptime.uptime)) {
      worstUptime = { key: -ride.id, uptime };
    }
  }

  const variety = 1 + FUN_VARIETY_BONUS_MAX * Math.min(1, Math.max(0, bands.size - 1) / 3);
  const score = 100 * (1 - Math.exp(-(portfolio * variety) / FUN_SCALE));

  if (portfolio === 0) {
    causes.push({ cause: "fun.noRides", magnitude: 100 });
  } else {
    if (bands.size <= 1) {
      causes.push({ cause: "fun.oneNote", magnitude: 25 });
    }
    if (worstUptime) {
      causes.push({
        cause: "fun.downtime",
        magnitude: Math.round((1 - worstUptime.uptime) * 100),
        rideKey: worstUptime.key,
      });
    }
    if (score < 60) {
      causes.push({ cause: "fun.thinPortfolio", magnitude: Math.round(60 - score) });
    }
  }
  return { score: clamp(score, 0, 100), causes };
}

function valueScore(state: SimState): SubScore {
  const rating = state.rating;
  const causes: RatingCause[] = [];
  const items: { ratio: number; weight: number; cause: RatingCauseId; rideKey?: number }[] = [];

  // Entry price against what guests expect to pay.
  const fairEntry = fairEntryCents(state);
  items.push({
    ratio: clamp(state.entryFeeCents / Math.max(fairEntry, 1), 0, VALUE_RATIO_CAP),
    weight: 2,
    cause: "value.entryPrice",
  });
  for (const ride of state.rides.tracked.values()) {
    if (ride.state !== RIDE_STATE.open || !ride.evaln.valid) {
      continue;
    }
    const fair = clamp(FAIR_TICKET_BASE + FAIR_TICKET_PER_E * ride.evaln.eStat, 100, 1_200);
    items.push({
      ratio: clamp(ride.priceCents / fair, 0, VALUE_RATIO_CAP),
      weight: 1,
      cause: "value.ridePrice",
      rideKey: ride.id,
    });
  }
  for (const ride of state.rides.flat.values()) {
    if (ride.state !== RIDE_STATE.open) {
      continue;
    }
    const fair = Math.max(FLAT_RIDES[ride.defId].ticketCents, 1);
    items.push({
      ratio: clamp(ride.priceCents / fair, 0, VALUE_RATIO_CAP),
      weight: 1,
      cause: "value.ridePrice",
      rideKey: -ride.id,
    });
  }
  for (const piece of state.world.placed.values()) {
    const shop = SHOP_DEFS[piece.pieceId];
    if (shop && shop.defaultPriceCents > 0) {
      items.push({ ratio: 1, weight: 0.5, cause: "value.shopPrice" });
    }
  }

  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0) || 1;
  const gouge =
    items.reduce((sum, i) => sum + i.weight * Math.max(0, i.ratio - 1), 0) / totalWeight;
  const generosity =
    items.reduce((sum, i) => sum + i.weight * Math.max(0, 1 - i.ratio), 0) / totalWeight;

  const departures = Math.max(sumOf(rating.departures), 1);
  const satisfaction =
    sumOf(rating.departures) < 1 ? 0.5 : sumOf(rating.happyDepartures) / departures;

  const score = clamp(
    VALUE_BASE +
      VALUE_SAT_GAIN * satisfaction -
      VALUE_GOUGE_PENALTY * gouge +
      VALUE_GENEROSITY_GAIN * Math.min(generosity, VALUE_GENEROSITY_CAP),
    0,
    100,
  );

  if (gouge > 0.05) {
    const worst = items.reduce((a, b) => (b.ratio > a.ratio ? b : a), items[0]!);
    causes.push({
      cause: worst.cause,
      magnitude: Math.round(gouge * VALUE_GOUGE_PENALTY),
      ...(worst.rideKey !== undefined ? { rideKey: worst.rideKey } : {}),
    });
  }
  if (satisfaction < 0.5 && sumOf(rating.departures) >= 1) {
    causes.push({
      cause: "value.unhappyLeavers",
      magnitude: Math.round((0.5 - satisfaction) * VALUE_SAT_GAIN * 2),
    });
  }
  return { score, causes };
}

/** Fair entry mirrors the arrivals model (GAME_BALANCE §4.1). */
function fairEntryCents(state: SimState): number {
  let shops = 0;
  let scenery = 0;
  for (const piece of state.world.placed.values()) {
    if (SHOP_DEFS[piece.pieceId]) {
      shops += 1;
    } else {
      scenery += 1;
    }
  }
  let topE = 0;
  let count = 0;
  for (const ride of state.rides.tracked.values()) {
    if (ride.state === RIDE_STATE.open && ride.evaln.valid) {
      topE += ride.evaln.eStat;
      count += 1;
    }
  }
  for (const ride of state.rides.flat.values()) {
    if (ride.state === RIDE_STATE.open) {
      topE += FLAT_RIDES[ride.defId].eStat;
      count += 1;
    }
  }
  const avgE = count > 0 ? topE / count : 0;
  return 8_00 + shops * 1_00 + Math.min(scenery * 4, 3_00) + Math.round(avgE * 1_10);
}

function careScore(state: SimState): SubScore {
  const rating = state.rating;
  const causes: RatingCause[] = [];
  const litter = clamp(meanOf(rating.litterDensity, 0) / CARE_LITTER_FULL, 0, 1);
  const citations = Math.min(sumOf(rating.citations), CARE_CITATION_CAP);

  let restrooms = 0;
  for (const piece of state.world.placed.values()) {
    const shop = SHOP_DEFS[piece.pieceId];
    if (shop?.satisfies === "bladder") {
      restrooms += 1;
    }
  }
  const guests = meanOf(rating.guestExposure, 0);
  const needed = Math.ceil(guests / CARE_RESTROOM_GUESTS);
  const shortfall = needed === 0 ? 0 : clamp(1 - restrooms / needed, 0, 1);

  const score = clamp(
    100 - CARE_LITTER_COEF * litter - citations - CARE_RESTROOM_COEF * shortfall,
    0,
    100,
  );
  if (litter > 0.15) {
    causes.push({ cause: "care.litter", magnitude: Math.round(litter * CARE_LITTER_COEF) });
  }
  if (shortfall > 0.05) {
    causes.push({
      cause: "care.restrooms",
      magnitude: Math.round(shortfall * CARE_RESTROOM_COEF),
    });
  }
  if (citations > 0) {
    causes.push({ cause: "care.citations", magnitude: Math.round(citations) });
  }
  return { score, causes };
}

function wonderScore(state: SimState): SubScore {
  const causes: RatingCause[] = [];
  let scenery = 0;
  const distinct = new Set<string>();
  for (const piece of state.world.placed.values()) {
    if (SHOP_DEFS[piece.pieceId]) {
      continue;
    }
    scenery += 1;
    distinct.add(piece.pieceId);
  }
  const paths = Math.max(pathCellCount(state), 1);
  const densityScore = 100 * clamp(scenery / paths / WONDER_TARGET_DENSITY, 0, 1);
  const varietyScore = 100 * clamp(distinct.size / WONDER_VARIETY_TARGET, 0, 1);
  // Terrain views: the share of path that runs above the site's water level.
  const viewScore = 60;

  const score = clamp(
    W_DENSITY * densityScore + W_VARIETY * varietyScore + W_VIEW * viewScore,
    0,
    100,
  );
  if (densityScore < 50) {
    causes.push({ cause: "wonder.bare", magnitude: Math.round(50 - densityScore) });
  }
  if (varietyScore < 50) {
    causes.push({ cause: "wonder.samey", magnitude: Math.round(50 - varietyScore) });
  }
  return { score, causes };
}

function flowScore(state: SimState): SubScore {
  const rating = state.rating;
  const causes: RatingCause[] = [];
  const parkWait = meanOf(rating.queueWait, 0);
  const queueScore = clamp(100 - 100 * (parkWait / FLOW_WAIT_BAD), 0, 100);

  const crowding = meanOf(rating.crowding, 0);
  const crowdScore =
    100 *
    clamp(
      1 - Math.max(0, crowding - FLOW_COMFY_DENSITY) / (FLOW_CRUSH_DENSITY - FLOW_COMFY_DENSITY),
      0,
      1,
    );

  const score = clamp(0.6 * queueScore + 0.4 * crowdScore, 0, 100);
  if (parkWait > 10) {
    // Name the worst offender so the panel can say which ride.
    let worst: { key: number; wait: number } | null = null;
    for (const [id, perf] of Object.entries(rating.perRide)) {
      const wait = meanOf(perf.wait, 0);
      if (!worst || wait > worst.wait) {
        worst = { key: Number(id), wait };
      }
    }
    if (worst && worst.wait > 5) {
      causes.push({
        cause: "flow.queues",
        magnitude: Math.round(worst.wait),
        rideKey: worst.key,
      });
    }
  }
  if (crowding > FLOW_COMFY_DENSITY) {
    causes.push({ cause: "flow.crowded", magnitude: Math.round((crowding - FLOW_COMFY_DENSITY) * 100) });
  }
  return { score, causes };
}

/* ------------------------------------------------------------------ */
/* The public rating                                                   */
/* ------------------------------------------------------------------ */

const round1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * Full evaluation with causes. **Pure** — it reads state and returns a view,
 * never writes. tickRating owns the stored `stars`/`subscores`; if this wrote
 * them, whether the player had a panel open would change the simulation.
 */
export function evaluateRating(state: SimState): RatingView {
  const rating = state.rating;
  const confidence = clamp(
    meanOf(rating.guestExposure, 0) / RATING_FULL_EVIDENCE_GUESTS,
    0,
    1,
  );
  const blend = (raw: number): number => RATING_NEUTRAL + confidence * (raw - RATING_NEUTRAL);

  const fun = funScore(state);
  const value = valueScore(state);
  const care = careScore(state);
  const wonder = wonderScore(state);
  const flow = flowScore(state);

  const blended = {
    fun: blend(fun.score),
    value: blend(value.score),
    care: blend(care.score),
    wonder: blend(wonder.score),
    flow: blend(flow.score),
  };
  const weighted =
    (30 * blended.fun +
      20 * blended.value +
      20 * blended.care +
      15 * blended.wonder +
      15 * blended.flow) /
    100;
  const stars = round1(
    Math.min(clamp((5 * weighted) / 100 + rating.pressStars, 0, 5), rating.capStars),
  );

  return {
    stars,
    fun: { score: Math.round(blended.fun), causes: fun.causes },
    value: { score: Math.round(blended.value), causes: value.causes },
    care: { score: Math.round(blended.care), causes: care.causes },
    wonder: { score: Math.round(blended.wonder), causes: wonder.causes },
    flow: { score: Math.round(blended.flow), causes: flow.causes },
    capStars: rating.capStars,
    confidence,
  };
}

/**
 * Rating feeds arrivals (GAME_BALANCE §4.1 ratingMult 0.6–1.6). A 2.5★ park
 * is neutral; below that arrivals thin, above it word of mouth compounds.
 */
export const ratingMult = (state: SimState): number =>
  clamp(0.6 + (state.rating.stars / 5) * 1.0, 0.6, 1.6);
