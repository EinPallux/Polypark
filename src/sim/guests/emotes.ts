/**
 * Guest state + emote constants in a leaf module: both the guest brain and
 * the ride system need these as VALUES, and rides ↔ guests may only share
 * type-only cycles (depcruise no-circular). guests.ts re-exports for callers.
 */

export const GUEST_STATE = {
  off: 0,
  walking: 1,
  idle: 2,
  serving: 3,
  leaving: 4,
  /** Waiting in a ride's boarding queue. */
  queuing: 5,
  /** On board a ride (hidden from the crowd renderer). */
  riding: 6,
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
  /** Post-ride wooziness (high N rides — GAME_BALANCE §5.3). */
  dizzy: 9,
} as const;
