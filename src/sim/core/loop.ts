/**
 * Fixed-timestep accumulator (TECHNICAL_ARCHITECTURE §4.1).
 *
 * The sim advances in whole ticks only; the render layer interpolates between
 * snapshots. Game speed multiplies simulated time, not tick size.
 */

export const TICKS_PER_SECOND = 10;
export const MS_PER_TICK = 1000 / TICKS_PER_SECOND;

/** 1 real second = 2 game minutes at 1× (GAME_DESIGN §16) ⇒ one tick = 12 game-seconds. */
export const GAME_SECONDS_PER_TICK = 12;
export const TICKS_PER_GAME_DAY = (24 * 60 * 60) / GAME_SECONDS_PER_TICK; // 7 200
export const TICKS_PER_GAME_MONTH = 3_000; // one report cycle ≈ 10 real minutes at 1×

export type GameSpeed = 0 | 1 | 2 | 4;

export interface FixedStepper {
  /**
   * Feed elapsed real milliseconds; returns how many ticks to simulate now.
   * Carries the remainder. Clamps runaway frames so a background tab never
   * fast-forwards more than `maxTicksPerAdvance` at once.
   */
  advance(elapsedMs: number, speed: GameSpeed): number;
  /** Fraction [0,1) of the way to the next tick — for render interpolation. */
  alpha(): number;
  reset(): void;
}

export function createFixedStepper(maxTicksPerAdvance = 30): FixedStepper {
  let accumulatorMs = 0;

  return {
    advance(elapsedMs: number, speed: GameSpeed): number {
      if (speed === 0 || elapsedMs <= 0) {
        return 0;
      }
      accumulatorMs += elapsedMs * speed;
      let ticks = Math.floor(accumulatorMs / MS_PER_TICK);
      if (ticks > maxTicksPerAdvance) {
        ticks = maxTicksPerAdvance;
        accumulatorMs = 0; // drop the backlog — never marathon-sim a stale tab
      } else {
        accumulatorMs -= ticks * MS_PER_TICK;
      }
      return ticks;
    },
    alpha(): number {
      return accumulatorMs / MS_PER_TICK;
    },
    reset(): void {
      accumulatorMs = 0;
    },
  };
}
