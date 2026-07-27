import { describe, expect, it } from "vitest";
import {
  createFixedStepper,
  parkClock,
  MS_PER_TICK,
  PARK_DAYS_PER_MONTH,
  PARK_OPENS_MINUTE,
  TICKS_PER_GAME_MONTH,
  TICKS_PER_PARK_DAY,
} from "./loop";

describe("fixed-timestep stepper (TECH §4.1)", () => {
  it("emits ticks at exactly 10/s regardless of frame cadence", () => {
    const stepper = createFixedStepper();
    let ticks = 0;
    // Uneven frame times summing to exactly 1000 ms.
    for (const dt of [16, 33, 7, 100, 244, 350, 250]) {
      ticks += stepper.advance(dt, 1);
    }
    expect(ticks).toBe(10);
  });

  it("scales with game speed", () => {
    const stepper = createFixedStepper();
    expect(stepper.advance(1000, 2)).toBe(20);
    expect(stepper.advance(500, 4)).toBe(20);
  });

  it("pause consumes no time", () => {
    const stepper = createFixedStepper();
    expect(stepper.advance(5000, 0)).toBe(0);
    // Nothing accumulated while paused:
    expect(stepper.advance(MS_PER_TICK, 1)).toBe(1);
  });

  it("clamps runaway backlogs (stale background tab)", () => {
    const stepper = createFixedStepper(30);
    expect(stepper.advance(60_000, 4)).toBe(30);
    // Backlog dropped, not deferred:
    expect(stepper.advance(0, 1)).toBe(0);
  });

  it("reports interpolation alpha between ticks", () => {
    const stepper = createFixedStepper();
    stepper.advance(MS_PER_TICK / 2, 1);
    expect(stepper.alpha()).toBeCloseTo(0.5);
  });
});

describe("the park clock (GAME_DESIGN §16)", () => {
  it("runs four day/night cycles per game month", () => {
    // The doc's contract. Anything day-quantised (weather, night hours, hotel
    // occupancy) nests inside the month because of this exact ratio.
    expect(PARK_DAYS_PER_MONTH).toBe(4);
    expect(TICKS_PER_PARK_DAY * PARK_DAYS_PER_MONTH).toBe(TICKS_PER_GAME_MONTH);
  });

  it("opens a brand-new park at 09:00 on day 1", () => {
    const clock = parkClock(0);
    expect(clock.minuteOfDay).toBe(PARK_OPENS_MINUTE);
    expect(clock.dayNumber).toBe(1);
    expect(clock.dayIndex).toBe(0);
  });

  it("rolls the day over exactly on the day boundary", () => {
    expect(parkClock(TICKS_PER_PARK_DAY - 1).dayNumber).toBe(1);
    expect(parkClock(TICKS_PER_PARK_DAY).dayNumber).toBe(2);
    expect(parkClock(TICKS_PER_PARK_DAY).minuteOfDay).toBe(PARK_OPENS_MINUTE);
  });

  it("keeps the hands on the face for a whole game year", () => {
    for (let tick = 0; tick < TICKS_PER_GAME_MONTH * 12; tick += 7) {
      const { minuteOfDay, tickOfDay } = parkClock(tick);
      expect(minuteOfDay).toBeGreaterThanOrEqual(0);
      expect(minuteOfDay).toBeLessThan(24 * 60);
      expect(tickOfDay).toBeGreaterThanOrEqual(0);
      expect(tickOfDay).toBeLessThan(TICKS_PER_PARK_DAY);
    }
  });

  it("starts every month on a fresh morning", () => {
    // A monthly report must never land mid-afternoon, or the forecast strip and
    // the report would disagree about what day it is.
    for (let month = 0; month < 24; month++) {
      const clock = parkClock(month * TICKS_PER_GAME_MONTH);
      expect(clock.tickOfDay).toBe(0);
      expect(clock.minuteOfDay).toBe(PARK_OPENS_MINUTE);
    }
  });
});
