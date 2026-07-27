/**
 * The Park Level track (GAME_DESIGN §19, GAME_BALANCE §9.2).
 *
 * Levels 1–30, with unlocks hung off the levels that have something to give.
 * Two rules shape the table:
 *
 * 1. **Level 1 is a playable park, not a tutorial cage.** Paths, the whole
 *    scenery palette and the first two shops are there from the start, because
 *    a sandbox-first game (pillar P1) must never open with an empty toolbox.
 *    What the track gates is *escalation* — rides, coasters, the expensive
 *    toys — so the park has somewhere to go.
 *
 * 2. **Nothing here is a wall.** Every unlock arrives from ordinary play, and
 *    no level gates a system the player already depends on. Locking is a
 *    "not yet", never a "you failed to" (ADR-15).
 *
 * The track is deliberately sparse above L12: the remaining ride families and
 * districts are M5/M6 content, and authoring nodes for things that do not
 * exist would promise the player something the game cannot deliver. Levels
 * without unlocks still pay XP and still hit their milestone tickets.
 */

/** Anything the track can hand over. Ids match the thing they unlock. */
export type UnlockId =
  // Shops (placed-piece ids)
  | "coasterkit/stall-food"
  | "coasterkit/stall-drinks"
  | "coasterkit/stall-toilets"
  // Flat rides (FlatRideId)
  | "teacups"
  | "carousel"
  | "galleon"
  | "rocket"
  | "drop"
  // Coaster families (TrackFamilyId)
  | "mouse"
  | "steel";

export interface LevelNode {
  readonly level: number;
  readonly unlocks: readonly UnlockId[];
  /** Star Tickets paid on reaching this level (§9.2: every 5th is a milestone). */
  readonly starTickets: number;
  readonly isMilestone: boolean;
}

/** Levels that hand something over. Everything else is filled in below. */
const UNLOCKS_BY_LEVEL: Readonly<Record<number, readonly UnlockId[]>> = {
  1: ["coasterkit/stall-food", "coasterkit/stall-drinks"],
  2: ["coasterkit/stall-toilets"],
  3: ["teacups"],
  4: ["carousel"],
  6: ["mouse"],
  8: ["galleon"],
  10: ["rocket"],
  12: ["steel"],
  14: ["drop"],
};

export const MAX_LEVEL = 30;

/**
 * §9.2: `XP(next) = 400 × level^1.35`. Lives here with the track it drives —
 * it is a balance curve, not goal-deck logic, and unlocks read it too.
 */
export function levelForXp(xp: number): number {
  let level = 1;
  let cumulative = 0;
  while (level < MAX_LEVEL) {
    cumulative += 400 * Math.pow(level, 1.35);
    if (xp < cumulative) {
      return level;
    }
    level += 1;
  }
  return MAX_LEVEL;
}

/** Cumulative XP needed to reach a level — for the track screen's progress bar. */
export function xpForLevel(level: number): number {
  let cumulative = 0;
  for (let l = 1; l < level; l++) {
    cumulative += 400 * Math.pow(l, 1.35);
  }
  return cumulative;
}

/** §9.2: "Every 5th level = Milestone node (fireworks + 🎟1)." */
export const MILESTONE_EVERY = 5;
export const MILESTONE_TICKETS = 1;

export const LEVEL_TRACK: readonly LevelNode[] = Array.from(
  { length: MAX_LEVEL },
  (_, i): LevelNode => {
    const level = i + 1;
    const isMilestone = level % MILESTONE_EVERY === 0;
    return {
      level,
      unlocks: UNLOCKS_BY_LEVEL[level] ?? [],
      starTickets: isMilestone ? MILESTONE_TICKETS : 0,
      isMilestone,
    };
  },
);

/** Everything unlocked by the time a park reaches `level`. */
export function unlocksThrough(level: number): UnlockId[] {
  const ids: UnlockId[] = [];
  for (const node of LEVEL_TRACK) {
    if (node.level > level) {
      break;
    }
    ids.push(...node.unlocks);
  }
  return ids;
}

/** The level an id arrives at, or null if the track never grants it. */
export function levelOfUnlock(id: UnlockId): number | null {
  for (const node of LEVEL_TRACK) {
    if (node.unlocks.includes(id)) {
      return node.level;
    }
  }
  return null;
}

/**
 * Categories that are never gated. Scenery is the creative palette and paths
 * are how a park exists at all — locking either would turn "build your park"
 * into "unlock your park", which is the opposite of the pitch (GAME_DESIGN §2).
 */
export const UNGATED_CATEGORIES = ["scenery", "path", "prop", "ride-part"] as const;

/** Monthly XP bonus per star of Park Rating (GAME_BALANCE §9.1). */
export const RATING_XP_PER_STAR = 60;
