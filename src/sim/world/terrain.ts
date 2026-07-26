import { CELL_SIZE_METERS, type SlopeClass } from "@/shared/grid";
import { RngStream, fnv1a } from "@/shared/rng";
import { type SiteDescriptor } from "@/content/sites/types";

/**
 * Deterministic terrain evaluation from a site descriptor (ADR-19, TECH §4.7).
 * The continuous height function feeds both the sim's per-cell grids (heights,
 * slope classes, water) and the render heightfield — one source of truth, zero
 * per-tick cost (everything is precomputed here at load).
 */

/** Slope thresholds from GAME_DESIGN §5: flat ≤3°, gentle ≤8° (rise over one 2 m cell). */
const FLAT_MAX_RISE = Math.tan((3 * Math.PI) / 180) * CELL_SIZE_METERS;
const GENTLE_MAX_RISE = Math.tan((8 * Math.PI) / 180) * CELL_SIZE_METERS;

export const SLOPE_ORDER: readonly SlopeClass[] = ["flat", "gentle", "steep"];

export interface Terrain {
  readonly site: SiteDescriptor;
  /** Continuous height in meters at world coordinates (cell (0,0) corner = origin). */
  heightAt(wx: number, wz: number): number;
  /** Height at a cell center. */
  cellHeight(x: number, z: number): number;
  slopeClassAt(x: number, z: number): SlopeClass;
  isWater(x: number, z: number): boolean;
  inBounds(x: number, z: number): boolean;
}

/** Smooth cosine falloff: 1 at center → 0 at radius. */
function falloff(distance: number, radius: number): number {
  if (distance >= radius) {
    return 0;
  }
  const t = distance / radius;
  return 0.5 + 0.5 * Math.cos(t * Math.PI);
}

/** Deterministic value noise: seeded lattice + bilinear interpolation + 2 octaves. */
function makeValueNoise(seed: number, scale: number): (wx: number, wz: number) => number {
  const lattice = (ix: number, iz: number): number => {
    const h = fnv1a(`${seed}:${ix}:${iz}`);
    return new RngStream("n", h | 0).next() * 2 - 1;
  };
  const sample = (x: number, z: number): number => {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const a = lattice(ix, iz);
    const b = lattice(ix + 1, iz);
    const c = lattice(ix, iz + 1);
    const d = lattice(ix + 1, iz + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  };
  return (wx, wz) => sample(wx / scale, wz / scale) * 0.7 + sample((wx * 2.13) / scale, (wz * 2.13) / scale) * 0.3;
}

export function createTerrain(site: SiteDescriptor): Terrain {
  const noise = makeValueNoise(site.seed, site.noise.scale * CELL_SIZE_METERS);

  const heightAt = (wx: number, wz: number): number => {
    let height = 0;
    for (const landform of site.landforms) {
      const cx = landform.x * CELL_SIZE_METERS;
      const cz = landform.z * CELL_SIZE_METERS;
      const distance = Math.hypot(wx - cx, wz - cz);
      const shape = falloff(distance, landform.radius * CELL_SIZE_METERS);
      height += (landform.kind === "basin" ? -landform.height : landform.height) * shape;
    }
    return height + noise(wx, wz) * site.noise.amplitude;
  };

  const { w, d } = site.cells;
  // Precompute cell-center heights, slope classes and water flags.
  const centers = new Float32Array(w * d);
  const slopes = new Uint8Array(w * d); // 0 flat, 1 gentle, 2 steep
  const water = new Uint8Array(w * d);

  for (let z = 0; z < d; z++) {
    for (let x = 0; x < w; x++) {
      const index = z * w + x;
      const wx = (x + 0.5) * CELL_SIZE_METERS;
      const wz = (z + 0.5) * CELL_SIZE_METERS;
      centers[index] = heightAt(wx, wz);

      const corners = [
        heightAt(x * CELL_SIZE_METERS, z * CELL_SIZE_METERS),
        heightAt((x + 1) * CELL_SIZE_METERS, z * CELL_SIZE_METERS),
        heightAt(x * CELL_SIZE_METERS, (z + 1) * CELL_SIZE_METERS),
        heightAt((x + 1) * CELL_SIZE_METERS, (z + 1) * CELL_SIZE_METERS),
      ] as const;
      const rise = Math.max(...corners) - Math.min(...corners);
      slopes[index] = rise <= FLAT_MAX_RISE ? 0 : rise <= GENTLE_MAX_RISE ? 1 : 2;
      water[index] = Math.min(...corners, centers[index] ?? 0) < site.waterLevel ? 1 : 0;
    }
  }

  return {
    site,
    heightAt,
    cellHeight: (x, z) => centers[z * w + x] ?? 0,
    slopeClassAt: (x, z) => SLOPE_ORDER[slopes[z * w + x] ?? 2] as SlopeClass,
    isWater: (x, z) => (water[z * w + x] ?? 0) === 1,
    inBounds: (x, z) => x >= 0 && z >= 0 && x < w && z < d,
  };
}
