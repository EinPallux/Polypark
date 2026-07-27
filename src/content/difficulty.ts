/**
 * Difficulty presets (GAME_BALANCE §2). Chosen at park creation and immutable
 * for the life of the park — it scales starting cash, so changing it mid-game
 * would be incoherent. Only the id is saved; the resolved modifiers are rebuilt
 * on load, so retuning these numbers reaches every existing park.
 */

export const DIFFICULTY_IDS = ["relaxed", "standard", "tycoon"] as const;
export type DifficultyId = (typeof DIFFICULTY_IDS)[number];

export interface DifficultyMods {
  /** Multiplies the park's base starting cash. */
  readonly startingCashMult: number;
  /** Added to every quoted loan APR, in basis points (−200 / 0 / +300). */
  readonly loanAprOffsetBps: number;
  /** Multiplies every guest need's per-tick decay. */
  readonly needDecayMult: number;
  /** Multiplies each archetype's price tolerance band. */
  readonly priceToleranceMult: number;
  /** Multiplies ride MTBF in cycles (higher = more reliable). */
  readonly breakdownMtbfMult: number;
  /** Expected event-deck draws per game month. */
  readonly eventsPerMonth: number;
  /** Extra inspection spot-check probability per month. */
  readonly inspectionChancePerMonth: number;
  /** Multiplies Star Ticket payouts. */
  readonly starTicketMult: number;
  /** Consecutive insolvent months before Receivership opens. */
  readonly receivershipEntryMonths: number;
}

export const DIFFICULTY_MODS: Readonly<Record<DifficultyId, DifficultyMods>> = {
  relaxed: {
    startingCashMult: 1.5,
    loanAprOffsetBps: -200,
    needDecayMult: 0.85,
    priceToleranceMult: 1.2,
    breakdownMtbfMult: 2.0,
    eventsPerMonth: 0.75,
    inspectionChancePerMonth: 0.05,
    starTicketMult: 0.75,
    receivershipEntryMonths: 3,
  },
  standard: {
    startingCashMult: 1.0,
    loanAprOffsetBps: 0,
    needDecayMult: 1.0,
    priceToleranceMult: 1.0,
    breakdownMtbfMult: 1.0,
    eventsPerMonth: 1.25,
    inspectionChancePerMonth: 0.1,
    starTicketMult: 1.0,
    receivershipEntryMonths: 2,
  },
  tycoon: {
    startingCashMult: 0.75,
    loanAprOffsetBps: 300,
    needDecayMult: 1.15,
    priceToleranceMult: 0.85,
    breakdownMtbfMult: 0.67,
    eventsPerMonth: 1.75,
    inspectionChancePerMonth: 0.18,
    starTicketMult: 1.25,
    receivershipEntryMonths: 1,
  },
};

export const DEFAULT_DIFFICULTY: DifficultyId = "standard";
