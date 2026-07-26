import { describe, expect, it } from "vitest";
import { MEADOWBROOK } from "@/content/sites/meadowbrook";
import { TEST_SITE } from "../testing/fixture";
import { createTerrain } from "./terrain";

describe("terrain from site descriptors (ADR-19)", () => {
  it("is deterministic: same descriptor ⇒ identical heights", () => {
    const a = createTerrain(MEADOWBROOK);
    const b = createTerrain(MEADOWBROOK);
    for (const [wx, wz] of [
      [0, 0],
      [13.7, 42.1],
      [95.9, 95.9],
      [48, 3.3],
    ] as const) {
      expect(a.heightAt(wx, wz)).toBe(b.heightAt(wx, wz));
    }
  });

  it("classifies the authored landforms as designed", () => {
    const terrain = createTerrain(TEST_SITE);
    const classes = new Set<string>();
    let waterCells = 0;
    for (let z = 0; z < TEST_SITE.cells.d; z++) {
      for (let x = 0; x < TEST_SITE.cells.w; x++) {
        classes.add(terrain.slopeClassAt(x, z));
        if (terrain.isWater(x, z)) {
          waterCells += 1;
        }
      }
    }
    expect(classes.has("flat")).toBe(true); // the meadow
    expect(classes.has("steep")).toBe(true); // the NE hill flank
    expect(waterCells).toBeGreaterThan(0); // the SW pond
  });

  it("keeps Meadowbrook mostly buildable (authored-site quality bar)", () => {
    const terrain = createTerrain(MEADOWBROOK);
    let buildable = 0;
    const total = MEADOWBROOK.cells.w * MEADOWBROOK.cells.d;
    for (let z = 0; z < MEADOWBROOK.cells.d; z++) {
      for (let x = 0; x < MEADOWBROOK.cells.w; x++) {
        if (!terrain.isWater(x, z) && terrain.slopeClassAt(x, z) !== "steep") {
          buildable += 1;
        }
      }
    }
    expect(buildable / total).toBeGreaterThan(0.75);
    expect(terrain.isWater(MEADOWBROOK.gate.x, MEADOWBROOK.gate.z)).toBe(false);
    expect(terrain.slopeClassAt(MEADOWBROOK.gate.x, MEADOWBROOK.gate.z)).not.toBe("steep");
  });

  it("bounds checks", () => {
    const terrain = createTerrain(TEST_SITE);
    expect(terrain.inBounds(0, 0)).toBe(true);
    expect(terrain.inBounds(15, 15)).toBe(true);
    expect(terrain.inBounds(16, 0)).toBe(false);
    expect(terrain.inBounds(-1, 0)).toBe(false);
  });
});
