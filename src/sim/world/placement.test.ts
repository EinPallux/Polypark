import { describe, expect, it } from "vitest";
import { createSim, type SimFacade } from "../api";
import { findCell, findOpenFlat, TEST_PIECES, TEST_SITE } from "../testing/fixture";

function makeSim(): SimFacade {
  return createSim({ seed: 7, site: TEST_SITE, pieceDefs: TEST_PIECES });
}

describe("placement rules per slope class (M1 golden tests)", () => {
  it("places scenery on flat, blocks double-occupancy, frees on remove", () => {
    const sim = makeSim();
    const spot = findOpenFlat(sim.terrain());
    expect(sim.dispatch({ type: "build/place", pieceId: "test/flower", ...spot, rot: 0 }).ok).toBe(true);
    const denied = sim.dispatch({ type: "build/place", pieceId: "test/bench", ...spot, rot: 0 });
    expect(denied).toEqual({ ok: false, reason: "occupied" });
    const placedId = sim.placedPieces()[0]!.id;
    expect(sim.dispatch({ type: "build/remove", id: placedId, refund: "bulldoze" }).ok).toBe(true);
    expect(sim.dispatch({ type: "build/place", pieceId: "test/bench", ...spot, rot: 0 }).ok).toBe(true);
  });

  it("gentle slopes take scenery and paths but not buildings", () => {
    const sim = makeSim();
    const terrain = sim.terrain();
    const gentle = findCell(
      terrain,
      (x, z) => terrain.slopeClassAt(x, z) === "gentle" && !terrain.isWater(x, z),
    );
    expect(sim.dispatch({ type: "build/place", pieceId: "test/flower", ...gentle, rot: 0 }).ok).toBe(true);
    sim.undo();
    expect(sim.checkPaintPath(gentle.x, gentle.z).ok).toBe(true);
    const house = sim.checkPlace("test/house", gentle.x, gentle.z, 0);
    expect(house).toEqual({ ok: false, reason: "too-steep" });
  });

  it("steep and water cells reject everything", () => {
    const sim = makeSim();
    const terrain = sim.terrain();
    const steep = findCell(terrain, (x, z) => terrain.slopeClassAt(x, z) === "steep");
    const water = findCell(terrain, (x, z) => terrain.isWater(x, z));
    expect(sim.checkPlace("test/flower", steep.x, steep.z, 0).ok).toBe(false);
    expect(sim.checkPlace("test/flower", water.x, water.z, 0)).toEqual({ ok: false, reason: "water" });
    expect(sim.checkPaintPath(water.x, water.z)).toEqual({ ok: false, reason: "water" });
  });

  it("respects footprint rotation for multi-cell pieces", () => {
    const sim = makeSim();
    const spot = findOpenFlat(sim.terrain());
    // 2×1 house at rot 1 occupies (x, z) and (x, z+1).
    expect(sim.dispatch({ type: "build/place", pieceId: "test/house", ...spot, rot: 1 }).ok).toBe(true);
    expect(sim.checkPlace("test/flower", spot.x, spot.z + 1, 0)).toEqual({
      ok: false,
      reason: "occupied",
    });
    expect(sim.checkPlace("test/flower", spot.x + 1, spot.z, 0).ok).toBe(true);
  });

  it("charges list price, refunds fully within grace and 70% after", () => {
    const sim = makeSim();
    const spot = findOpenFlat(sim.terrain());
    const start = sim.snapshot().money;
    sim.dispatch({ type: "build/place", pieceId: "test/bench", ...spot, rot: 0 });
    expect(sim.snapshot().money).toBe(start - 80_00);
    // Immediate bulldoze: full refund (grace window).
    sim.dispatch({ type: "build/remove", id: sim.placedPieces()[0]!.id, refund: "bulldoze" });
    expect(sim.snapshot().money).toBe(start);
    // Re-place, age past the 300-tick grace, bulldoze → 70%.
    sim.dispatch({ type: "build/place", pieceId: "test/bench", ...spot, rot: 0 });
    sim.advance(301);
    sim.dispatch({ type: "build/remove", id: sim.placedPieces()[0]!.id, refund: "bulldoze" });
    expect(sim.snapshot().money).toBe(start - 80_00 + 56_00);
  });

  it("denies placement money cannot cover", () => {
    const sim = makeSim();
    const spot = findOpenFlat(sim.terrain());
    // Burn the wallet with an absurd number of paint cells? Cheaper: spend via places.
    let denied = false;
    for (let i = 0; i < 2000; i++) {
      const result = sim.dispatch({
        type: "build/place",
        pieceId: "test/house",
        x: spot.x,
        z: spot.z,
        rot: 0,
      });
      if (result.ok) {
        sim.advance(400); // age past the grace window…
        sim.dispatch({ type: "build/remove", id: sim.placedPieces()[0]!.id, refund: "bulldoze" });
        // …so each place/bulldoze cycle bleeds 30% of the price.
      } else if (!result.ok && result.reason === "not-enough-money") {
        denied = true;
        break;
      }
    }
    expect(denied).toBe(true);
  });
});
