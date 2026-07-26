import { type SimPieceDef } from "@/content/costs";
import { type SiteDescriptor } from "@/content/sites/types";
import { createTerrain, type Terrain } from "./terrain";

/**
 * The buildable world: occupancy grid on terrain, placed pieces, and the path
 * layer with auto-tiling (GAME_DESIGN §8.1). All mutation goes through the
 * command handlers in ../core/commands.ts.
 */

export type Rotation = 0 | 1 | 2 | 3;

export interface PlacedPiece {
  readonly id: number;
  readonly pieceId: string;
  readonly x: number;
  readonly z: number;
  readonly rot: Rotation;
  readonly placedAtTick: number;
  /** Cents actually paid — refunds and undo restore from this, not list price. */
  readonly paidCents: number;
}

export interface WorldState {
  readonly siteId: string;
  nextInstanceId: number;
  readonly placed: Map<number, PlacedPiece>;
  /** 1 where a path cell is painted. */
  readonly pathCells: Uint8Array;
  /** 0 = free; else the occupying piece instance id (paths use PATH_OCCUPANT). */
  readonly occupancy: Uint32Array;
  readonly terrain: Terrain;
  readonly pieces: ReadonlyMap<string, SimPieceDef>;
}

export const PATH_OCCUPANT = 0xffffffff;

export function createWorld(site: SiteDescriptor, pieceDefs: readonly SimPieceDef[]): WorldState {
  const cellCount = site.cells.w * site.cells.d;
  return {
    siteId: site.id,
    nextInstanceId: 1,
    placed: new Map(),
    pathCells: new Uint8Array(cellCount),
    occupancy: new Uint32Array(cellCount),
    terrain: createTerrain(site),
    pieces: new Map(pieceDefs.map((piece) => [piece.id, piece])),
  };
}

export function cellIndex(world: WorldState, x: number, z: number): number {
  return z * world.terrain.site.cells.w + x;
}

export function footprintCells(
  piece: SimPieceDef,
  x: number,
  z: number,
  rot: Rotation,
): { x: number; z: number }[] {
  const w = rot % 2 === 0 ? piece.footprint.w : piece.footprint.d;
  const d = rot % 2 === 0 ? piece.footprint.d : piece.footprint.w;
  const cells: { x: number; z: number }[] = [];
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      cells.push({ x: x + dx, z: z + dz });
    }
  }
  return cells;
}

export type PlaceDenial =
  | "unknown-piece"
  | "out-of-bounds"
  | "occupied"
  | "water"
  | "too-steep"
  | "not-enough-money";

export interface PlaceCheck {
  readonly ok: boolean;
  readonly reason?: PlaceDenial;
}

/** Slope rules (GAME_DESIGN §5/§8.1): flat = anything; gentle = paths + scenery/props; steep = nothing (M1). */
function slopeAllows(world: WorldState, piece: SimPieceDef, x: number, z: number): boolean {
  const slope = world.terrain.slopeClassAt(x, z);
  if (slope === "flat") {
    return true;
  }
  if (slope === "gentle") {
    return piece.category === "path" || piece.category === "scenery" || piece.category === "prop";
  }
  return false;
}

export function checkPlace(
  world: WorldState,
  pieceId: string,
  x: number,
  z: number,
  rot: Rotation,
): PlaceCheck {
  const piece = world.pieces.get(pieceId);
  if (!piece) {
    return { ok: false, reason: "unknown-piece" };
  }
  for (const cell of footprintCells(piece, x, z, rot)) {
    if (!world.terrain.inBounds(cell.x, cell.z)) {
      return { ok: false, reason: "out-of-bounds" };
    }
    if (world.terrain.isWater(cell.x, cell.z)) {
      return { ok: false, reason: "water" };
    }
    if (world.occupancy[cellIndex(world, cell.x, cell.z)] !== 0) {
      return { ok: false, reason: "occupied" };
    }
    if (!slopeAllows(world, piece, cell.x, cell.z)) {
      return { ok: false, reason: "too-steep" };
    }
  }
  return { ok: true };
}

export function checkPaintPath(world: WorldState, x: number, z: number): PlaceCheck {
  if (!world.terrain.inBounds(x, z)) {
    return { ok: false, reason: "out-of-bounds" };
  }
  if (world.terrain.isWater(x, z)) {
    return { ok: false, reason: "water" };
  }
  if (world.terrain.slopeClassAt(x, z) === "steep") {
    return { ok: false, reason: "too-steep" };
  }
  const index = cellIndex(world, x, z);
  if (world.pathCells[index] === 1 || world.occupancy[index] !== 0) {
    return { ok: false, reason: "occupied" };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Path auto-tiling (ground_path* family)                              */
/* ------------------------------------------------------------------ */

export type PathTileKind =
  | "path-tile" // plaza interior
  | "path-cross"
  | "path-split"
  | "path-straight"
  | "path-bend"
  | "path-end";

export interface ResolvedPathTile {
  readonly x: number;
  readonly z: number;
  readonly kind: PathTileKind;
  readonly rot: Rotation;
}

function hasPath(world: WorldState, x: number, z: number): boolean {
  return world.terrain.inBounds(x, z) && world.pathCells[cellIndex(world, x, z)] === 1;
}

/**
 * Resolve one painted cell to a tile piece + rotation from its 4-neighborhood.
 * Base orientations (verified against the meshes in the M1 visual pass):
 *   straight: runs N–S · end: stub opens N · bend: connects N+E ·
 *   split: connects N+E+S (missing W) · cross/tile: all four.
 */
export function resolvePathTile(world: WorldState, x: number, z: number): ResolvedPathTile {
  const n = hasPath(world, x, z - 1);
  const e = hasPath(world, x + 1, z);
  const s = hasPath(world, x, z + 1);
  const w = hasPath(world, x - 1, z);
  const degree = (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0);

  if (degree === 4) {
    // Plaza interior when the diagonals are filled too, else a crossing.
    const diagonals =
      (hasPath(world, x + 1, z - 1) ? 1 : 0) +
      (hasPath(world, x + 1, z + 1) ? 1 : 0) +
      (hasPath(world, x - 1, z + 1) ? 1 : 0) +
      (hasPath(world, x - 1, z - 1) ? 1 : 0);
    return { x, z, kind: diagonals >= 3 ? "path-tile" : "path-cross", rot: 0 };
  }
  if (degree === 3) {
    // split connects N+E+S at rot 0 (missing W); rotate so the gap matches.
    const rot: Rotation = !w ? 0 : !n ? 1 : !e ? 2 : 3;
    return { x, z, kind: "path-split", rot };
  }
  if (degree === 2) {
    if (n && s) {
      return { x, z, kind: "path-straight", rot: 0 };
    }
    if (e && w) {
      return { x, z, kind: "path-straight", rot: 1 };
    }
    // bend connects N+E at rot 0; rotate clockwise for E+S, S+W, W+N.
    const rot: Rotation = n && e ? 0 : e && s ? 1 : s && w ? 2 : 3;
    return { x, z, kind: "path-bend", rot };
  }
  if (degree === 1) {
    // end stub opens toward its single neighbor; opening N at rot 0.
    const rot: Rotation = n ? 0 : e ? 1 : s ? 2 : 3;
    return { x, z, kind: "path-end", rot };
  }
  return { x, z, kind: "path-end", rot: 0 };
}

export function resolveAllPathTiles(world: WorldState): ResolvedPathTile[] {
  const tiles: ResolvedPathTile[] = [];
  const { w, d } = world.terrain.site.cells;
  for (let z = 0; z < d; z++) {
    for (let x = 0; x < w; x++) {
      if (world.pathCells[z * w + x] === 1) {
        tiles.push(resolvePathTile(world, x, z));
      }
    }
  }
  return tiles;
}
