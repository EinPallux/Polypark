import {
  ACTIVE_GOAL_SLOTS,
  DISMISS_COOLDOWN_TICKS,
  GOAL_CARDS,
  type GoalCardDef,
  type StatKey,
} from "@/content/goals";
import { type SimState } from "../state";

/**
 * The Goal Deck engine (GAME_DESIGN §18, GAME_BALANCE §9.4): deals up to 3
 * OPTIONAL cards over the stat counters. There is deliberately no "required"
 * concept anywhere in this module — every active card can be dismissed and
 * play never blocks on one (invariant #11 asserts this shape).
 */
export interface ActiveGoal {
  cardId: string;
  /** Stat value when dealt — progress counts from here. */
  baseValue: number;
}

export interface GoalsState {
  active: ActiveGoal[];
  completed: string[];
  /** cardId → tick after which it may be dealt again. */
  cooldowns: Record<string, number>;
}

export function createGoalsState(): GoalsState {
  return { active: [], completed: [], cooldowns: {} };
}

function statValue(state: SimState, stat: StatKey): number {
  return state.stats[stat];
}

function isEligible(state: SimState, card: GoalCardDef): boolean {
  const goals = state.goals;
  if (goals.active.some((active) => active.cardId === card.id)) {
    return false;
  }
  if (goals.completed.includes(card.id)) {
    return false;
  }
  if ((goals.cooldowns[card.id] ?? 0) > state.tick) {
    return false;
  }
  if (card.requiresStat && statValue(state, card.requiresStat.stat) < card.requiresStat.atLeast) {
    return false;
  }
  // Recovery cards deal in on Receivership entry and stop being dealt on exit.
  // Cards already in hand are never yanked mid-progress — a card vanishing
  // would read as a punishment, and nothing here punishes (ADR-15).
  if ((card.requiresReceivership ?? false) !== state.finance.receivership.active) {
    return false;
  }
  return true;
}

const TIER_ORDER = { recovery: 0, guidance: 1, growth: 2, mastery: 3 } as const;

function deal(state: SimState): void {
  while (state.goals.active.length < ACTIVE_GOAL_SLOTS) {
    const eligible = GOAL_CARDS.filter((card) => isEligible(state, card)).sort(
      (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier],
    );
    const next = eligible[0];
    if (!next) {
      return; // pool exhausted — the deck simply idles (never an error)
    }
    state.goals.active.push({ cardId: next.id, baseValue: statValue(state, next.stat) });
  }
}

export interface GoalProgress {
  readonly cardId: string;
  readonly stat: StatKey;
  readonly progress: number;
  readonly target: number;
  readonly rewardXp: number;
  readonly tier: GoalCardDef["tier"];
}

export function goalProgress(state: SimState): GoalProgress[] {
  return state.goals.active.flatMap((active) => {
    const card = GOAL_CARDS.find((candidate) => candidate.id === active.cardId);
    if (!card) {
      return [];
    }
    return [
      {
        cardId: card.id,
        stat: card.stat,
        progress: Math.max(
          Math.min(statValue(state, card.stat) - active.baseValue, card.target),
          0,
        ),
        target: card.target,
        rewardXp: card.rewardXp,
        tier: card.tier,
      },
    ];
  });
}

export interface CompletedGoal {
  readonly cardId: string;
  readonly rewardXp: number;
}

/** Advance the deck; returns any cards completed this tick. */
/**
 * Receivership deals its recovery chain immediately: the administrator
 * refocuses the park, so non-recovery cards go back to the pool (no cooldown,
 * no penalty — they return later untouched). Without this the chain could
 * never appear, because three slots are already full when trouble hits.
 */
export function refocusForReceivership(state: SimState): void {
  state.goals.active = state.goals.active.filter((active) => {
    const card = GOAL_CARDS.find((c) => c.id === active.cardId);
    return card?.tier === "recovery";
  });
}

export function tickGoals(state: SimState): CompletedGoal[] {
  if (state.goals.active.length < ACTIVE_GOAL_SLOTS) {
    deal(state);
  }
  const completed: CompletedGoal[] = [];
  state.goals.active = state.goals.active.filter((active) => {
    const card = GOAL_CARDS.find((candidate) => candidate.id === active.cardId);
    if (!card) {
      return false;
    }
    if (statValue(state, card.stat) - active.baseValue >= card.target) {
      state.goals.completed.push(card.id);
      completed.push({ cardId: card.id, rewardXp: card.rewardXp });
      return false;
    }
    return true;
  });
  if (completed.length > 0) {
    deal(state);
  }
  return completed;
}

/** Player dismissed a card — free of charge, cooldown before it returns. */
export function dismissGoal(state: SimState, cardId: string): boolean {
  const index = state.goals.active.findIndex((active) => active.cardId === cardId);
  if (index < 0) {
    return false;
  }
  state.goals.active.splice(index, 1);
  state.goals.cooldowns[cardId] = state.tick + DISMISS_COOLDOWN_TICKS;
  deal(state);
  return true;
}

/** XP → level via the GAME_BALANCE §9.2 curve. */
export function levelForXp(xp: number): number {
  let level = 1;
  let cumulative = 0;
  while (level < 30) {
    cumulative += 400 * Math.pow(level, 1.35);
    if (xp < cumulative) {
      return level;
    }
    level += 1;
  }
  return 30;
}
