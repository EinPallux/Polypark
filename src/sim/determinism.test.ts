import { describe, expect, it } from "vitest";
import { createSim, type SimFacade } from "./api";
import { findOpenFlat, TEST_PIECES, TEST_SITE } from "./testing/fixture";

function makeSim(seed: number): SimFacade {
  return createSim({ seed, parkName: "Meadowbrook", site: TEST_SITE, pieceDefs: TEST_PIECES });
}

describe("golden-seed determinism (TECH §11.1)", () => {
  it("same seed + same command log ⇒ identical state hash", () => {
    const run = () => {
      const sim = makeSim(20260726);
      const spot = findOpenFlat(sim.terrain());
      sim.advance(500);
      sim.dispatch({ type: "park/rename", name: "Sunny Meadows" });
      sim.dispatch({ type: "build/place", pieceId: "test/flower", ...spot, rot: 2 });
      sim.dispatch({
        type: "build/paintPath",
        cells: [
          { x: spot.x + 1, z: spot.z },
          { x: spot.x + 2, z: spot.z },
        ],
      });
      sim.advance(2500);
      sim.dispatch({ type: "debug/noop" });
      sim.advance(30);
      return sim.hash();
    };
    expect(run()).toBe(run());
  });

  it("different seeds ⇒ different hashes", () => {
    const a = makeSim(1);
    const b = makeSim(2);
    a.advance(10);
    b.advance(10);
    expect(a.hash()).not.toBe(b.hash());
  });

  it("resuming from a snapshot continues the exact same timeline", () => {
    const straight = makeSim(777);
    const spot = findOpenFlat(straight.terrain());
    straight.dispatch({ type: "build/place", pieceId: "test/bench", ...spot, rot: 0 });
    straight.advance(100);

    const first = makeSim(777);
    first.dispatch({ type: "build/place", pieceId: "test/bench", ...spot, rot: 0 });
    first.advance(40);
    const resumed = createSim({
      seed: 777,
      site: TEST_SITE,
      pieceDefs: TEST_PIECES,
      resumeFrom: first.snapshot(),
    });
    resumed.advance(60);

    expect(resumed.hash()).toBe(straight.hash());
  });

  it("rejects invalid commands without touching state", () => {
    const sim = makeSim(5);
    const before = sim.hash();
    expect(sim.dispatch({ type: "park/rename", name: "   " }).ok).toBe(false);
    expect(sim.dispatch({ type: "build/place", pieceId: "nope", x: 0, z: 0, rot: 0 }).ok).toBe(false);
    expect(sim.hash()).toBe(before);
  });

  it("emits events for the shell to drain", () => {
    const sim = makeSim(9);
    sim.dispatch({ type: "park/rename", name: "Riverbend" });
    const events = sim.drainEvents();
    expect(events).toContainEqual({ type: "sim/started", seed: 9 });
    expect(events).toContainEqual({ type: "park/renamed", name: "Riverbend" });
    expect(sim.drainEvents()).toEqual([]);
  });

  it("worldVersion bumps only on successful world mutations", () => {
    const sim = makeSim(11);
    const v0 = sim.worldVersion();
    sim.dispatch({ type: "debug/noop" });
    sim.dispatch({ type: "build/place", pieceId: "nope", x: 0, z: 0, rot: 0 });
    expect(sim.worldVersion()).toBe(v0);
    const spot = findOpenFlat(sim.terrain());
    sim.dispatch({ type: "build/place", pieceId: "test/flower", ...spot, rot: 0 });
    expect(sim.worldVersion()).toBe(v0 + 1);
    sim.undo();
    expect(sim.worldVersion()).toBe(v0 + 2);
  });
});
