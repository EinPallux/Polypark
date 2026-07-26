/**
 * Goal Deck card pool (GAME_DESIGN §18, GAME_BALANCE §9.4). Cards are pure
 * data over the sim's stat counters — the engine has NO concept of a required
 * card (invariant #11): every card is dismissible, dealing never blocks play.
 */
export type StatKey =
  | "pathCellsBuilt"
  | "sceneryPlaced"
  | "shopsBuilt"
  | "guestsWelcomed"
  | "mealsServed"
  | "drinksServed"
  | "littersCleaned"
  | "janitorsHired"
  | "monthsProfit";

export type GoalTier = "guidance" | "growth" | "mastery";

export interface GoalCardDef {
  readonly id: string;
  readonly tier: GoalTier;
  readonly stat: StatKey;
  /** Progress needed on top of the value when the card is dealt. */
  readonly target: number;
  readonly rewardXp: number;
  /** Stat prerequisite before the card becomes eligible (gentle sequencing). */
  readonly requiresStat?: { readonly stat: StatKey; readonly atLeast: number };
}

export const GOAL_CARDS: readonly GoalCardDef[] = [
  // Guidance — the soft opening chain (GAME_DESIGN §20: invite, never force)
  { id: "lay-first-paths", tier: "guidance", stat: "pathCellsBuilt", target: 10, rewardXp: 80 },
  { id: "plant-the-meadow", tier: "guidance", stat: "sceneryPlaced", target: 6, rewardXp: 80 },
  { id: "open-first-shop", tier: "guidance", stat: "shopsBuilt", target: 1, rewardXp: 120 },
  { id: "welcome-guests", tier: "guidance", stat: "guestsWelcomed", target: 25, rewardXp: 150, requiresStat: { stat: "pathCellsBuilt", atLeast: 5 } },
  // Growth
  { id: "serve-snacks", tier: "growth", stat: "mealsServed", target: 20, rewardXp: 150, requiresStat: { stat: "shopsBuilt", atLeast: 1 } },
  { id: "pour-drinks", tier: "growth", stat: "drinksServed", target: 20, rewardXp: 150, requiresStat: { stat: "shopsBuilt", atLeast: 1 } },
  { id: "hire-janitor", tier: "growth", stat: "janitorsHired", target: 1, rewardXp: 100, requiresStat: { stat: "guestsWelcomed", atLeast: 20 } },
  { id: "hundred-guests", tier: "growth", stat: "guestsWelcomed", target: 100, rewardXp: 300, requiresStat: { stat: "guestsWelcomed", atLeast: 25 } },
  { id: "tidy-park", tier: "growth", stat: "littersCleaned", target: 10, rewardXp: 150, requiresStat: { stat: "janitorsHired", atLeast: 1 } },
  { id: "green-boulevard", tier: "growth", stat: "sceneryPlaced", target: 30, rewardXp: 200, requiresStat: { stat: "sceneryPlaced", atLeast: 6 } },
  // Mastery
  { id: "profitable-month", tier: "mastery", stat: "monthsProfit", target: 1, rewardXp: 400, requiresStat: { stat: "guestsWelcomed", atLeast: 50 } },
  { id: "path-network", tier: "mastery", stat: "pathCellsBuilt", target: 80, rewardXp: 300, requiresStat: { stat: "pathCellsBuilt", atLeast: 20 } },
];

export const ACTIVE_GOAL_SLOTS = 3;
/** Dismissed themes cool down before re-entering the deal pool (2 months). */
export const DISMISS_COOLDOWN_TICKS = 6_000;
