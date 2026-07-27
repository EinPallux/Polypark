/**
 * The event deck and safety inspections (GAME_BALANCE §8.1).
 *
 * Cards are drawn at month close from the `events` RNG stream — declared since
 * M0 and unused until now, so no other system's rolls shift. Draws respect
 * per-card cooldowns and simple prerequisites, and the rate comes from
 * difficulty (`eventsPerMonth`).
 *
 * Two rules keep the deck inside ADR-15 ("guided, never forced; no hard end"):
 * nothing here can end a save, and every penalty either decays (citations) or
 * expires (timed effects). A run of bad luck makes a bad month, never a
 * spiral — which is also why Care penalties go through `addCitations`, whose
 * rolling window forgets, instead of a stacking counter.
 */
import {
  COASTER_OF_MONTH_MIN_E,
  COASTER_OF_MONTH_STARS,
  EVENT_CARD_LIST,
  INSPECTION_FAIL_CITATIONS,
  INSPECTION_FINE_CENTS,
  INSPECTION_INTERVAL_MONTHS,
  INSPECTION_JITTER_MONTHS,
  INSPECTION_PASS_SCORE,
  INSPECTION_PASS_STARS,
  SPONSOR_MONTHLY_CENTS,
  TAX_AUDIT_FEE_CENTS,
  TAX_AUDIT_FINE_CENTS,
  VIP_CRITIC_PASS_STARS,
  VIP_CRITIC_STARS,
  type EventCardDef,
  type EventId,
} from "@/content/events";
import { money } from "@/shared/money";
import { FIRST_AID_GUESTS_PER_POST, SHOP_DEFS } from "@/content/shops";
import { parkClock, TICKS_PER_PARK_DAY } from "../core/loop";
import { addExpense, addIncome } from "../economy/ledgerCore";
import { addCitations, addPressStars } from "../rating/rating";
import { RIDE_STATE } from "../rides/rides";
import { type ActiveEffect } from "./effects";
import { type SimState } from "../state";

export {
  createDeckState,
  eventArrivalsMult,
  eventLitterMult,
  eventMtbfMult,
  eventWonderPenalty,
  type ActiveEffect,
  type DeckState,
} from "./effects";

export interface DeckEvent {
  readonly kind: "event/drawn" | "inspection/passed" | "inspection/failed";
  readonly card?: EventId;
  readonly detail: number;
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

function isEligible(state: SimState, def: EventCardDef): boolean {
  const last = state.deck.lastDrawnMonth[def.id];
  if (last !== undefined && state.monthNumber - last < def.cooldownMonths) {
    return false;
  }
  if (def.minMonthlyGuests > 0 && state.lastMonthGuests < def.minMonthlyGuests) {
    return false;
  }
  if (def.minOpenRides > 0 && openRideCount(state) < def.minOpenRides) {
    return false;
  }
  return true;
}

function openRideCount(state: SimState): number {
  let n = 0;
  for (const ride of state.rides.tracked.values()) {
    if (ride.state === RIDE_STATE.open) n += 1;
  }
  for (const ride of state.rides.flat.values()) {
    if (ride.state === RIDE_STATE.open) n += 1;
  }
  return n;
}

/** Weighted pick among eligible cards, or null when the deck has nothing to say. */
function drawCard(state: SimState): EventCardDef | null {
  const eligible = EVENT_CARD_LIST.filter((def) => isEligible(state, def));
  if (eligible.length === 0) {
    return null;
  }
  const total = eligible.reduce((sum, def) => sum + def.weight, 0);
  let roll = state.rng.events.next() * total;
  for (const def of eligible) {
    roll -= def.weight;
    if (roll < 0) {
      return def;
    }
  }
  return eligible[eligible.length - 1]!;
}

/**
 * How many cards this month. `eventsPerMonth` is an expectation, not a count:
 * the whole part always fires, the fraction is a coin flip. That keeps the
 * long-run average exactly on the difficulty table's number.
 */
function drawCount(state: SimState): number {
  const rate = state.difficultyMods.eventsPerMonth;
  const whole = Math.floor(rate);
  return whole + (state.rng.events.next() < rate - whole ? 1 : 0);
}

/* ------------------------------------------------------------------ */
/* Month close                                                         */
/* ------------------------------------------------------------------ */

/** Draw this month's cards and run any scheduled inspection. */
export function deckMonthClose(state: SimState): DeckEvent[] {
  const events: DeckEvent[] = [];
  const today = parkClock(state.tick).dayIndex;

  // Expire finished effects first, so a card can be redrawn the month its
  // predecessor lapses rather than a month later.
  state.deck.active = state.deck.active.filter((e: ActiveEffect) => e.untilDay > today);

  // Receivership is a rescue, not a pile-on: the deck goes quiet while the
  // administrator is in (ADR-15 — the recovery chain must be winnable).
  if (!state.finance.receivership.active) {
    const n = drawCount(state);
    for (let i = 0; i < n; i++) {
      const def = drawCard(state);
      if (!def) break;
      state.deck.lastDrawnMonth[def.id] = state.monthNumber;
      applyCard(state, def, today);
      events.push({ kind: "event/drawn", card: def.id, detail: 0 });
    }
  }

  if (state.monthNumber >= state.deck.nextInspectionMonth) {
    events.push(runInspection(state));
    // Reschedule, jittered by whole months — see INSPECTION_JITTER_MONTHS for
    // why the doc's "±2 weeks" cannot be expressed at this granularity.
    const jitter = state.rng.events.nextInt(-INSPECTION_JITTER_MONTHS, INSPECTION_JITTER_MONTHS);
    state.deck.nextInspectionMonth =
      state.monthNumber + INSPECTION_INTERVAL_MONTHS + jitter;
  }

  // Sponsor money arrives while the wrap is up.
  if (state.deck.sponsorUntilDay > today) {
    addIncome(state, "sponsor", money(SPONSOR_MONTHLY_CENTS));
  }
  return events;
}

function applyCard(state: SimState, def: EventCardDef, today: number): void {
  const until = today + def.durationDays;
  switch (def.id) {
    case "vip-critic": {
      // A secret audit: the park is judged on what it is, not what it promises.
      const good = state.rating.stars >= VIP_CRITIC_PASS_STARS;
      addPressStars(state, good ? VIP_CRITIC_STARS : -VIP_CRITIC_STARS);
      break;
    }
    case "influencer-swarm":
    case "litter-wave":
    case "breakdown-streak": {
      const rideKey = def.id === "breakdown-streak" ? worstRideKey(state) : 0;
      state.deck.active.push({ card: def.id, untilDay: until, rideKey });
      break;
    }
    case "sponsor-offer": {
      state.deck.sponsorUntilDay = until;
      state.deck.active.push({ card: def.id, untilDay: until, rideKey: 0 });
      break;
    }
    case "tax-audit": {
      // Books in order → a fee. Behind on payments → a fine. Never both.
      const behind = state.finance.loans.some((l) => l.arrearsCents > 0);
      addExpense(
        state,
        "admin",
        money(behind ? TAX_AUDIT_FINE_CENTS : TAX_AUDIT_FEE_CENTS),
      );
      break;
    }
    case "coaster-of-month": {
      let best = 0;
      for (const ride of state.rides.tracked.values()) {
        best = Math.max(best, ride.evaln.eStat);
      }
      if (best >= COASTER_OF_MONTH_MIN_E) {
        addPressStars(state, COASTER_OF_MONTH_STARS);
      }
      break;
    }
  }
}

/** The ride most likely to be noticed breaking: the busiest open one. */
function worstRideKey(state: SimState): number {
  let key = 0;
  let bestCycles = -1;
  for (const ride of state.rides.tracked.values()) {
    if (ride.state === RIDE_STATE.open && ride.cycleCount > bestCycles) {
      bestCycles = ride.cycleCount;
      key = ride.id;
    }
  }
  return key;
}

/* ------------------------------------------------------------------ */
/* Inspections                                                         */
/* ------------------------------------------------------------------ */

/**
 * Score = reliability 40% + first-aid coverage 20% + crowding 20% +
 * citation history 20% (§8.1).
 *
 * The first-aid term used to be scored from mechanic coverage, because First
 * Aid did not exist — a stated proxy, swapped out now that the building ships.
 * Coverage is one post per 400 guests a month, so a growing park has to keep
 * up rather than build one and forget it.
 */
export function inspectionScore(state: SimState): number {
  const rides = [...state.rides.tracked.values(), ...state.rides.flat.values()];
  const broken = rides.filter((r) => r.state === RIDE_STATE.broken).length;
  const reliability = rides.length === 0 ? 1 : 1 - broken / rides.length;

  let posts = 0;
  for (const piece of state.world.placed.values()) {
    if (SHOP_DEFS[piece.pieceId]?.effect === "firstAid") {
      posts += 1;
    }
  }
  const postsWanted = Math.max(1, state.lastMonthGuests / FIRST_AID_GUESTS_PER_POST);
  const coverage = Math.min(1, posts / postsWanted);

  const guests = state.lastMonthGuests;
  const crowding = guests <= 0 ? 1 : Math.max(0, 1 - guests / 4_000);

  const citations = Math.max(0, 1 - state.rating.citations.total / 40);

  return Math.round(
    100 * (0.4 * reliability + 0.2 * coverage + 0.2 * crowding + 0.2 * citations),
  );
}

function runInspection(state: SimState): DeckEvent {
  const score = inspectionScore(state);
  if (score >= INSPECTION_PASS_SCORE) {
    addPressStars(state, INSPECTION_PASS_STARS);
    return { kind: "inspection/passed", detail: score };
  }
  addExpense(state, "admin", money(INSPECTION_FINE_CENTS));
  addCitations(state, INSPECTION_FAIL_CITATIONS);
  // §8.1 closes the worst ride until repaired. The nearest honest reading with
  // the shipped FSM: shut the busiest ride, which the player reopens when
  // ready. It is never destroyed and never permanently locked.
  const key = worstRideKey(state);
  const ride = state.rides.tracked.get(key);
  if (ride && ride.state === RIDE_STATE.open) {
    ride.state = RIDE_STATE.closed;
  }
  return { kind: "inspection/failed", detail: score };
}

/** Ticks until the next inspection, for the management window. */
export const ticksToInspection = (state: SimState): number =>
  Math.max(0, (state.deck.nextInspectionMonth - state.monthNumber) * TICKS_PER_PARK_DAY * 4);
