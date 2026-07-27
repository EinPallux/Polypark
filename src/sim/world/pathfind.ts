/**
 * A* over the park's walkable cells, with a small result cache.
 *
 * Lives at the world layer rather than inside guests/ because it is a property
 * of the grid, not of guests: janitors, mechanics and guests all need the same
 * answer. It used to live in guests.ts, which meant rides.ts could not use it
 * without an import cycle — so mechanics beelined across the grass instead.
 */
import { cellIndex } from "./world";
import { type SimState } from "../state";

const pathCache = new Map<number, number[] | null>();

function isWalkable(state: SimState, x: number, z: number): boolean {
  if (!state.world.terrain.inBounds(x, z)) {
    return false;
  }
  const index = cellIndex(state.world, x, z);
  if (state.world.pathCells[index] === 1) {
    return true;
  }
  // The gate forecourt (small lawn apron) is walkable so paths built NEAR the
  // gate connect — the visible gate build lands in M3 (design note in CHANGELOG).
  const gate = state.world.terrain.site.gate;
  return (
    Math.abs(x - gate.x) <= 4 &&
    Math.abs(z - gate.z) <= 4 &&
    !state.world.terrain.isWater(x, z) &&
    state.world.terrain.slopeClassAt(x, z) !== "steep"
  );
}

/** A* over path cells; returns cell indices from start (exclusive) to goal, or null. */
export function findPath(
  state: SimState,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): number[] | null {
  const w = state.world.terrain.site.cells.w;
  const key = (fromZ * w + fromX) * 65_536 + (toZ * w + toX);
  const cached = pathCache.get(key);
  if (cached !== undefined) {
    return cached ? [...cached] : null;
  }

  const start = fromZ * w + fromX;
  const goal = toZ * w + toX;
  const open: number[] = [start];
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>([[start, 0]]);
  const fScore = new Map<number, number>([
    [start, Math.abs(toX - fromX) + Math.abs(toZ - fromZ)],
  ]);

  let found = false;
  let iterations = 0;
  while (open.length > 0 && iterations < 4_000) {
    iterations += 1;
    let bestIndex = 0;
    for (let i = 1; i < open.length; i++) {
      if ((fScore.get(open[i]!) ?? Infinity) < (fScore.get(open[bestIndex]!) ?? Infinity)) {
        bestIndex = i;
      }
    }
    const current = open.splice(bestIndex, 1)[0]!;
    if (current === goal) {
      found = true;
      break;
    }
    const cx = current % w;
    const cz = Math.floor(current / w);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!isWalkable(state, nx, nz)) {
        continue;
      }
      const neighbor = nz * w + nx;
      const tentative = (gScore.get(current) ?? Infinity) + 1;
      if (tentative < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentative);
        fScore.set(neighbor, tentative + Math.abs(toX - nx) + Math.abs(toZ - nz));
        if (!open.includes(neighbor)) {
          open.push(neighbor);
        }
      }
    }
  }

  let result: number[] | null = null;
  if (found) {
    const chain: number[] = [];
    let node = goal;
    while (node !== start) {
      chain.push(node);
      node = cameFrom.get(node)!;
    }
    chain.reverse();
    result = chain;
  }
  if (pathCache.size > 600) {
    pathCache.clear();
  }
  pathCache.set(key, result ? [...result] : null);
  return result;
}

/** Call when the path network changes (build commands bump worldVersion). */
export function invalidatePathCache(): void {
  pathCache.clear();
}

