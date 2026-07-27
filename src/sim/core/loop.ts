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
export const TICKS_PER_GAME_MONTH = 3_000; // one report cycle ≈ 10 real minutes at 1×

/**
 * Polypark runs two clocks, and they deliberately disagree.
 *
 * The **duration clock** (GAME_SECONDS_PER_TICK) is the literal one: needs
 * decay, ride cycles and repair times are quoted in game-minutes and derive
 * from it.
 *
 * The **park clock** is a rhythm dial. GAME_DESIGN §16 asks for four day/night
 * cycles per month, so a park day is 750 ticks and the displayed hands sweep a
 * full 24 h across it — about 9.6× faster than the duration clock. Deriving the
 * hands literally instead gives a 7,200-tick day, i.e. longer than the month,
 * and the monthly report fires twice before lunch. (That contradiction shipped
 * as a dead `TICKS_PER_GAME_DAY` constant nothing ever read.)
 *
 * The stylisation pays for itself: a guest who stays open-to-close lives ~75
 * duration-minutes of need decay — most of one Fun cycle — so "a guest spends
 * the day at the park" reads true even though the hands are fast.
 */
export const TICKS_PER_PARK_DAY = 750;
export const PARK_DAYS_PER_MONTH = TICKS_PER_GAME_MONTH / TICKS_PER_PARK_DAY; // 4

/** Park hours (GAME_DESIGN §16). Night running unlocks later — ROADMAP M5. */
export const PARK_OPENS_MINUTE = 9 * 60;
export const PARK_CLOSES_MINUTE = 21 * 60;

export interface ParkClock {
  /** 0..1439 — where the hands sit on the park's stylised 24 h face. */
  readonly minuteOfDay: number;
  /** 1-based day counter since the park was founded. */
  readonly dayNumber: number;
  /** 0..TICKS_PER_PARK_DAY-1 — position within the day. */
  readonly tickOfDay: number;
  /** Whole days elapsed — the sampling key for anything day-quantised. */
  readonly dayIndex: number;
}

/** Where the park clock stands on a given tick. Pure, total, no state. */
export function parkClock(tick: number): ParkClock {
  const dayIndex = Math.floor(tick / TICKS_PER_PARK_DAY);
  const tickOfDay = tick - dayIndex * TICKS_PER_PARK_DAY;
  // Tick 0 is opening time, not midnight — a new park starts its first morning.
  const swept = PARK_OPENS_MINUTE + (tickOfDay * (24 * 60)) / TICKS_PER_PARK_DAY;
  return {
    minuteOfDay: Math.floor(swept) % (24 * 60),
    dayNumber: dayIndex + 1,
    tickOfDay,
    dayIndex,
  };
}

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
