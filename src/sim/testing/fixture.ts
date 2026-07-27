import { money } from "@/shared/money";
import { composedBuilding } from "@/content/buildings";
import { SHOP_DEFS } from "@/content/shops";
import { type SimPieceDef } from "@/content/costs";
import { type SiteDescriptor } from "@/content/sites/types";
import { type Terrain } from "../world/terrain";

/**
 * Deterministic test site: mostly-flat 16×16 meadow with a sharp hill in the
 * NE (guaranteed steep cells) and a basin pond in the SW (guaranteed water).
 */
export const TEST_SITE: SiteDescriptor = {
  id: "test-site",
  name: "Test Site",
  cells: { w: 16, d: 16 },
  surroundCells: 4,
  seed: 1234,
  landforms: [
    { kind: "hill", x: 13, z: 3, radius: 4, height: 2.4 },
    { kind: "basin", x: 3, z: 13, radius: 3.4, height: 1.8 },
  ],
  noise: { amplitude: 0.05, scale: 10 },
  waterLevel: -0.6,
  gate: { x: 8, z: 15 },
  scatter: [],
};

export const TEST_PIECES: SimPieceDef[] = [
  { id: "test/flower", category: "scenery", footprint: { w: 1, d: 1 }, cost: money(25_00) },
  { id: "test/bench", category: "prop", footprint: { w: 1, d: 1 }, cost: money(80_00) },
  { id: "test/house", category: "building", footprint: { w: 2, d: 1 }, cost: money(400_00) },
];

/**
 * Every shop in the roster as a placeable piece, carrying its REAL footprint.
 *
 * Tests used to hand-roll these as 1×1, which was harmless while every shop was
 * a stall but would quietly let a 4×4 Poly Bistro be placed in one cell — and a
 * test that places a building the game cannot place proves nothing.
 */
export const SHOP_PIECES: SimPieceDef[] = Object.keys(SHOP_DEFS).map((id) => ({
  id,
  category: "building" as const,
  footprint: composedBuilding(id)?.footprint ?? { w: 1, d: 1 },
  cost: SHOP_DEFS[id]!.buildCost,
}));

export function findCell(
  terrain: Terrain,
  predicate: (x: number, z: number) => boolean,
): { x: number; z: number } {
  for (let z = 0; z < terrain.site.cells.d; z++) {
    for (let x = 0; x < terrain.site.cells.w; x++) {
      if (predicate(x, z)) {
        return { x, z };
      }
    }
  }
  throw new Error("fixture: no cell satisfies predicate");
}

/** A dry flat cell whose 1-ring is also dry and flat (safe for 2×1 pieces too). */
export function findOpenFlat(terrain: Terrain): { x: number; z: number } {
  return findCell(terrain, (x, z) => {
    for (let dz = 0; dz <= 1; dz++) {
      for (let dx = 0; dx <= 1; dx++) {
        if (
          !terrain.inBounds(x + dx, z + dz) ||
          terrain.slopeClassAt(x + dx, z + dz) !== "flat" ||
          terrain.isWater(x + dx, z + dz)
        ) {
          return false;
        }
      }
    }
    return true;
  });
}
