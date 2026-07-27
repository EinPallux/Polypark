/**
 * What the park is allowed to build yet (GAME_BALANCE §9.2).
 *
 * Derived, never saved: the set follows from the park's level, which follows
 * from XP. That means retuning the track in content/ reaches every existing
 * save on load rather than stranding parks on the schedule they were built
 * under — the same rule difficulty modifiers follow.
 *
 * `unlockAll` is a real park setting, not a test backdoor. A sandbox-first
 * game (pillar P1) should be able to say "give me everything and let me
 * build", and having it be a genuine option means the tests exercise a path
 * players can actually take rather than one that only exists for them.
 */
import {
  levelForXp,
  levelOfUnlock,
  unlocksThrough,
  type UnlockId,
} from "@/content/progression";
import { districtOfPiece } from "../districts/districts";
import { type SimState } from "../state";

/** Every id this park may build right now. */
export function unlockedIds(state: SimState): ReadonlySet<UnlockId> {
  if (state.unlockAll) {
    return ALL_UNLOCKS;
  }
  return new Set(unlocksThrough(levelForXp(state.xp)));
}

const ALL_UNLOCKS: ReadonlySet<UnlockId> = new Set(unlocksThrough(Number.MAX_SAFE_INTEGER));

/**
 * Is this id buildable? Ids the track never mentions are always allowed —
 * scenery, paths and anything a future pack adds default to open rather than
 * to locked, so forgetting to author a node can never silently remove
 * something from the palette.
 */
export function isUnlocked(state: SimState, id: string): boolean {
  if (state.unlockAll) {
    return true;
  }
  // District pieces are gated by owning the plot, not by level: the plot is
  // the purchase, and buying it is what earns the palette.
  const district = districtOfPiece(id);
  if (district !== null) {
    return state.districts.owned.includes(district);
  }
  if (levelOfUnlock(id as UnlockId) === null) {
    return true;
  }
  return levelForXp(state.xp) >= (levelOfUnlock(id as UnlockId) ?? 0);
}

/** The level an id arrives at — for the palette's "Level 6" ribbon. */
export const unlockLevel = (id: string): number | null => levelOfUnlock(id as UnlockId);
