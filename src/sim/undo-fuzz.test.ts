import { describe, expect, it } from "vitest";
import { RngStream } from "@/shared/rng";
import { createSim, type SimStateSnapshot } from "./api";
import { TEST_PIECES, TEST_SITE } from "./testing/fixture";

/**
 * ROADMAP M1 acceptance: 100-step undo/redo fuzz. Undo-all must return to the
 * initial buildable state; redo-all must reproduce the exact final state.
 * nextInstanceId is monotonic by design (ids are never reused), so the
 * undo-all comparison strips it; the redo-all comparison is exact.
 */
function stripCounters(snapshot: SimStateSnapshot): unknown {
  return { ...snapshot, world: { ...snapshot.world, nextInstanceId: 0 } };
}

describe("undo/redo fuzz", () => {
  it("survives 100 random build ops, undo-all, redo-all", () => {
    const sim = createSim({ seed: 99, site: TEST_SITE, pieceDefs: TEST_PIECES });
    const initial = stripCounters(sim.snapshot());
    const rng = new RngStream("fuzz", 424242);
    let applied = 0;

    while (applied < 100) {
      const roll = rng.next();
      if (roll < 0.45) {
        const result = sim.dispatch({
          type: "build/place",
          pieceId: TEST_PIECES[rng.nextInt(0, TEST_PIECES.length - 1)]!.id,
          x: rng.nextInt(0, TEST_SITE.cells.w - 2),
          z: rng.nextInt(0, TEST_SITE.cells.d - 2),
          rot: rng.nextInt(0, 3) as 0 | 1 | 2 | 3,
        });
        if (result.ok) applied += 1;
      } else if (roll < 0.7) {
        const cells = Array.from({ length: rng.nextInt(1, 6) }, () => ({
          x: rng.nextInt(0, TEST_SITE.cells.w - 1),
          z: rng.nextInt(0, TEST_SITE.cells.d - 1),
        }));
        if (sim.dispatch({ type: "build/paintPath", cells }).ok) applied += 1;
      } else if (roll < 0.85) {
        const placed = sim.placedPieces();
        if (placed.length > 0) {
          const target = placed[rng.nextInt(0, placed.length - 1)]!;
          if (sim.dispatch({ type: "build/remove", id: target.id, refund: "bulldoze" }).ok) {
            applied += 1;
          }
        }
      } else {
        const cells = Array.from({ length: rng.nextInt(1, 4) }, () => ({
          x: rng.nextInt(0, TEST_SITE.cells.w - 1),
          z: rng.nextInt(0, TEST_SITE.cells.d - 1),
        }));
        if (sim.dispatch({ type: "build/erasePath", cells }).ok) applied += 1;
      }
    }

    const final = sim.snapshot();
    expect(final.world.placed.length + final.world.pathCells.filter((c) => c === 1).length,
    ).toBeGreaterThan(0);

    let undos = 0;
    while (sim.undo()) undos += 1;
    expect(undos).toBe(100);
    expect(stripCounters(sim.snapshot())).toEqual(initial);

    let redos = 0;
    while (sim.redo()) redos += 1;
    expect(redos).toBe(100);
    expect(sim.snapshot()).toEqual(final);
  });
});
