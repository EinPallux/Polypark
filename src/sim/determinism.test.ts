import { describe, expect, it } from "vitest";
import { createSim } from "./api";

describe("golden-seed determinism (TECH §11.1)", () => {
  it("same seed + same command log ⇒ identical state hash", () => {
    const run = () => {
      const sim = createSim({ seed: 20260726, parkName: "Meadowbrook" });
      sim.advance(500);
      sim.dispatch({ type: "park/rename", name: "Sunny Meadows" });
      sim.advance(2500);
      sim.dispatch({ type: "debug/noop" });
      sim.advance(30);
      return sim.hash();
    };
    expect(run()).toBe(run());
  });

  it("different seeds ⇒ different hashes", () => {
    const a = createSim({ seed: 1 });
    const b = createSim({ seed: 2 });
    a.advance(10);
    b.advance(10);
    expect(a.hash()).not.toBe(b.hash());
  });

  it("resuming from a snapshot continues the exact same timeline", () => {
    const straight = createSim({ seed: 777 });
    straight.advance(100);

    const first = createSim({ seed: 777 });
    first.advance(40);
    const resumed = createSim({ seed: 777, resumeFrom: first.snapshot() });
    resumed.advance(60);

    expect(resumed.hash()).toBe(straight.hash());
  });

  it("rejects invalid commands without touching state", () => {
    const sim = createSim({ seed: 5 });
    const before = sim.hash();
    const result = sim.dispatch({ type: "park/rename", name: "   " });
    expect(result.ok).toBe(false);
    expect(sim.hash()).toBe(before);
  });

  it("emits events for the shell to drain", () => {
    const sim = createSim({ seed: 9 });
    sim.dispatch({ type: "park/rename", name: "Riverbend" });
    const events = sim.drainEvents();
    expect(events).toContainEqual({ type: "sim/started", seed: 9 });
    expect(events).toContainEqual({ type: "park/renamed", name: "Riverbend" });
    expect(sim.drainEvents()).toEqual([]); // drained means drained
  });
});
