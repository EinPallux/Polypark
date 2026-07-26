import { describe, expect, it } from "vitest";
import { createFixedStepper, MS_PER_TICK } from "./loop";

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
