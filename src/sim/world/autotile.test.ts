import { describe, expect, it } from "vitest";
import { createSim, type SimFacade } from "../api";
import { findOpenFlat, TEST_PIECES, TEST_SITE } from "../testing/fixture";

function makeSim(): SimFacade {
  return createSim({ seed: 3, site: TEST_SITE, pieceDefs: TEST_PIECES });
}

function tileAt(sim: SimFacade, x: number, z: number) {
  return sim.pathTiles().find((tile) => tile.x === x && tile.z === z);
}

describe("path auto-tiling (ground_path* family)", () => {
  it("resolves an L-run into ends, straights and a bend", () => {
    const sim = makeSim();
    const o = findOpenFlat(sim.terrain());
    // Vertical leg (z, z+1, z+2) then east leg (x+1, x+2 at z+2).
    sim.dispatch({
      type: "build/paintPath",
      cells: [
        { x: o.x, z: o.z },
        { x: o.x, z: o.z + 1 },
        { x: o.x, z: o.z + 2 },
        { x: o.x + 1, z: o.z + 2 },
        { x: o.x + 2, z: o.z + 2 },
      ],
    });
    expect(tileAt(sim, o.x, o.z)?.kind).toBe("path-end");
    expect(tileAt(sim, o.x, o.z + 1)?.kind).toBe("path-straight");
    expect(tileAt(sim, o.x, o.z + 1)?.rot).toBe(0); // N–S
    const corner = tileAt(sim, o.x, o.z + 2);
    expect(corner?.kind).toBe("path-bend");
    expect(tileAt(sim, o.x + 1, o.z + 2)?.rot).toBe(1); // E–W straight
    expect(tileAt(sim, o.x + 2, o.z + 2)?.kind).toBe("path-end");
  });

  it("resolves T-junctions and crossings", () => {
    const sim = makeSim();
    const o = findOpenFlat(sim.terrain());
    const c = { x: o.x + 1, z: o.z + 1 };
    sim.dispatch({
      type: "build/paintPath",
      cells: [
        c,
        { x: c.x, z: c.z - 1 },
        { x: c.x + 1, z: c.z },
        { x: c.x, z: c.z + 1 },
      ],
    });
    expect(tileAt(sim, c.x, c.z)?.kind).toBe("path-split"); // N+E+S, missing W → rot 0
    expect(tileAt(sim, c.x, c.z)?.rot).toBe(0);
    sim.dispatch({ type: "build/paintPath", cells: [{ x: c.x - 1, z: c.z }] });
    expect(tileAt(sim, c.x, c.z)?.kind).toBe("path-cross");
  });

  it("fills plazas with interior tiles once diagonals close", () => {
    const sim = makeSim();
    const o = findOpenFlat(sim.terrain());
    const cells: { x: number; z: number }[] = [];
    for (let dz = 0; dz < 3; dz++) {
      for (let dx = 0; dx < 3; dx++) {
        cells.push({ x: o.x + dx, z: o.z + dz });
      }
    }
    const result = sim.dispatch({ type: "build/paintPath", cells });
    expect(result.ok).toBe(true);
    expect(tileAt(sim, o.x + 1, o.z + 1)?.kind).toBe("path-tile"); // plaza interior
    expect(tileAt(sim, o.x, o.z)?.kind).toBe("path-bend"); // plaza corner
  });

  it("erasing recomputes neighbors", () => {
    const sim = makeSim();
    const o = findOpenFlat(sim.terrain());
    sim.dispatch({
      type: "build/paintPath",
      cells: [
        { x: o.x, z: o.z },
        { x: o.x, z: o.z + 1 },
        { x: o.x, z: o.z + 2 },
      ],
    });
    sim.dispatch({ type: "build/erasePath", cells: [{ x: o.x, z: o.z + 2 }] });
    expect(tileAt(sim, o.x, o.z + 1)?.kind).toBe("path-end");
    expect(sim.pathTiles()).toHaveLength(2);
  });
});
