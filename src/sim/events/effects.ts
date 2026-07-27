/**
 * Deck state and its pure effect reads — the leaf half of the event system.
 *
 * Split from deck.ts for the same reason ledgerCore.ts was split from
 * ledger.ts: the *writers* need rating, rides and the ledger, while the
 * *readers* are consulted BY those systems. Keeping both in one module makes
 * a genuine runtime import cycle, which dep-cruiser rejects. Nothing here
 * imports anything but content and the state type.
 */
import {
  BREAKDOWN_STREAK_MTBF_MULT,
  INFLUENCER_ARRIVALS_MULT,
  INFLUENCER_LITTER_MULT,
  INSPECTION_INTERVAL_MONTHS,
  LITTER_WAVE_MULT,
  SPONSOR_WONDER_PENALTY,
  type EventId,
} from "@/content/events";
import { type SimState } from "../state";

export interface ActiveEffect {
  readonly card: EventId;
  /** Park day the effect stops applying. */
  readonly untilDay: number;
  /** Ride key the effect targets, or 0 for park-wide. */
  readonly rideKey: number;
}

export interface DeckState {
  /** Month number each card was last drawn, keyed by card id. */
  lastDrawnMonth: Partial<Record<EventId, number>>;
  active: ActiveEffect[];
  /** Month number of the next scheduled inspection. */
  nextInspectionMonth: number;
  /** Sponsor wrap: monthly income while live, at the cost of Wonder. */
  sponsorUntilDay: number;
}

export function createDeckState(): DeckState {
  return {
    lastDrawnMonth: {},
    active: [],
    // First inspection is a full interval out — nobody is inspected on opening
    // week, and the player can see it coming in the management window.
    nextInspectionMonth: INSPECTION_INTERVAL_MONTHS,
    sponsorUntilDay: -1,
  };
}

const hasEffect = (state: SimState, card: EventId): boolean =>
  state.deck.active.some((e) => e.card === card);

/** Multiplies arrivals while an influencer swarm is on. */
export const eventArrivalsMult = (state: SimState): number =>
  hasEffect(state, "influencer-swarm") ? INFLUENCER_ARRIVALS_MULT : 1;

/** Multiplies how fast guests drop litter. */
export function eventLitterMult(state: SimState): number {
  let mult = 1;
  if (hasEffect(state, "litter-wave")) mult *= LITTER_WAVE_MULT;
  if (hasEffect(state, "influencer-swarm")) mult *= INFLUENCER_LITTER_MULT;
  return mult;
}

/** Multiplies one ride's MTBF while a breakdown streak targets it. */
export function eventMtbfMult(state: SimState, rideKey: number): number {
  for (const e of state.deck.active) {
    if (e.card === "breakdown-streak" && e.rideKey === rideKey) {
      return BREAKDOWN_STREAK_MTBF_MULT;
    }
  }
  return 1;
}

/** Wonder points a live sponsor wrap costs the park. */
export const eventWonderPenalty = (state: SimState): number =>
  hasEffect(state, "sponsor-offer") ? SPONSOR_WONDER_PENALTY : 0;
