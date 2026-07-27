/**
 * The event deck (GAME_BALANCE §8.1). Cards are drawn at each month close at a
 * rate set by difficulty, respecting per-card cooldowns.
 *
 * Rain / Storm / Heatwave are NOT here — weather owns them as a day-quantised
 * chain (§8.1a), because a three-day forecast cannot promise something a card
 * might spring on you.
 *
 * Four §8.1 cards are deliberately absent because they would need systems that
 * do not exist yet, and a card that fires with no visible effect is worse than
 * no card at all. Each is named in ROADMAP M5 with what it is waiting on:
 *   · Vandal night   — needs damaged-prop model variants
 *   · Hygiene scare  — needs per-shop cleanliness
 *   · Lost kid       — needs the camera-ping interaction
 *   · Refurb subsidy — needs `ride/refurbish`
 */

export const EVENT_IDS = [
  "vip-critic",
  "influencer-swarm",
  "breakdown-streak",
  "litter-wave",
  "sponsor-offer",
  "tax-audit",
  "coaster-of-month",
] as const;
export type EventId = (typeof EVENT_IDS)[number];

export interface EventCardDef {
  readonly id: EventId;
  readonly nameKey: string;
  readonly blurbKey: string;
  /** Relative draw weight (GAME_BALANCE §8.1). */
  readonly weight: number;
  /** Game months before this card may be drawn again. */
  readonly cooldownMonths: number;
  /** Days the card's effect stays live; 0 = it resolves instantly. */
  readonly durationDays: number;
  /** Skip the card unless the park has at least this many open rides. */
  readonly minOpenRides: number;
  /** Skip unless the park has at least this many guests in the last month. */
  readonly minMonthlyGuests: number;
}

export const EVENT_CARDS: Readonly<Record<EventId, EventCardDef>> = {
  "vip-critic": {
    id: "vip-critic",
    nameKey: "event.vip-critic.name",
    blurbKey: "event.vip-critic.blurb",
    weight: 7,
    cooldownMonths: 3,
    durationDays: 0,
    minOpenRides: 1,
    minMonthlyGuests: 40,
  },
  "influencer-swarm": {
    id: "influencer-swarm",
    nameKey: "event.influencer-swarm.name",
    blurbKey: "event.influencer-swarm.blurb",
    weight: 7,
    cooldownMonths: 2,
    durationDays: 2,
    minOpenRides: 1,
    minMonthlyGuests: 25,
  },
  "breakdown-streak": {
    id: "breakdown-streak",
    nameKey: "event.breakdown-streak.name",
    blurbKey: "event.breakdown-streak.blurb",
    weight: 8,
    cooldownMonths: 2,
    // §8.1 says "for a week"; a park week is 7 days on the park clock.
    durationDays: 7,
    minOpenRides: 1,
    minMonthlyGuests: 0,
  },
  "litter-wave": {
    id: "litter-wave",
    nameKey: "event.litter-wave.name",
    blurbKey: "event.litter-wave.blurb",
    weight: 8,
    cooldownMonths: 1,
    durationDays: 2,
    minOpenRides: 0,
    minMonthlyGuests: 25,
  },
  "sponsor-offer": {
    id: "sponsor-offer",
    nameKey: "event.sponsor-offer.name",
    blurbKey: "event.sponsor-offer.blurb",
    weight: 6,
    cooldownMonths: 3,
    // Sponsorships run a season; the Wonder cost is live the whole time.
    durationDays: 12,
    minOpenRides: 1,
    minMonthlyGuests: 60,
  },
  "tax-audit": {
    id: "tax-audit",
    nameKey: "event.tax-audit.name",
    blurbKey: "event.tax-audit.blurb",
    weight: 4,
    cooldownMonths: 6,
    durationDays: 0,
    minOpenRides: 0,
    minMonthlyGuests: 0,
  },
  "coaster-of-month": {
    id: "coaster-of-month",
    nameKey: "event.coaster-of-month.name",
    blurbKey: "event.coaster-of-month.blurb",
    weight: 4,
    cooldownMonths: 6,
    durationDays: 0,
    minOpenRides: 1,
    minMonthlyGuests: 0,
  },
};

export const EVENT_CARD_LIST: readonly EventCardDef[] = Object.values(EVENT_CARDS);

/* ---- Effect magnitudes (GAME_BALANCE §8.1) ---- */

export const VIP_CRITIC_STARS = 0.3;
/** Rating the critic wants to see before writing a kind review. */
export const VIP_CRITIC_PASS_STARS = 3;
export const INFLUENCER_ARRIVALS_MULT = 1.4;
export const INFLUENCER_LITTER_MULT = 1.3;
export const BREAKDOWN_STREAK_MTBF_MULT = 0.4;
export const LITTER_WAVE_MULT = 2;
export const SPONSOR_MONTHLY_CENTS = 1_800_00;
export const SPONSOR_WONDER_PENALTY = 4;
export const TAX_AUDIT_FEE_CENTS = 1_200_00;
export const TAX_AUDIT_FINE_CENTS = 4_500_00;
export const COASTER_OF_MONTH_MIN_E = 6.5;
export const COASTER_OF_MONTH_STARS = 0.2;

/* ---- Safety inspections (GAME_BALANCE §8.1) ---- */

/**
 * Scheduled every 3 months, jittered so the player cannot set a watch by it.
 *
 * §8.1 says "±2 weeks". Inspections resolve at month close, and the month is
 * the smallest unit that boundary can address, so ±half a month rounds away to
 * exactly nothing — the schedule becomes perfectly predictable, which is the
 * one thing the jitter exists to prevent. ±1 whole month is the nearest
 * expressible reading: inspections land every 2–4 months.
 */
export const INSPECTION_INTERVAL_MONTHS = 3;
export const INSPECTION_JITTER_MONTHS = 1;
export const INSPECTION_PASS_SCORE = 70;
export const INSPECTION_FINE_CENTS = 2_500_00;
export const INSPECTION_PASS_STARS = 0.1;
/** Care citation points on a failure — decays over ~a month, never stacks. */
export const INSPECTION_FAIL_CITATIONS = 10;
