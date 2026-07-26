import { CELL_SIZE_METERS } from "@/shared/grid";
import { type SimState } from "../state";
import { findPath } from "../guests/guests";

/**
 * Janitors v1 (GAME_DESIGN §13): hired hands who patrol the path network and
 * clean the nearest litter. Patrol zones arrive with the staff panel in M4 —
 * for now the whole park is one zone.
 */
export interface Janitor {
  id: number;
  x: number;
  z: number;
  path: number[];
  targetLitterId: number;
  cleanTicks: number;
}

export interface Litter {
  id: number;
  cellX: number;
  cellZ: number;
}

const JANITOR_SPEED = 0.16; // meters per tick — a brisk professional pace
const CLEAN_TICKS = 17; // ≈ 2 s of game time per piece of litter

export function tickJanitors(state: SimState): void {
  const w = state.world.terrain.site.cells.w;
  for (const janitor of state.janitors) {
    if (janitor.cleanTicks > 0) {
      janitor.cleanTicks -= 1;
      if (janitor.cleanTicks === 0) {
        const index = state.litter.findIndex((l) => l.id === janitor.targetLitterId);
        if (index >= 0) {
          state.litter.splice(index, 1);
          state.stats.littersCleaned += 1;
        }
        janitor.targetLitterId = -1;
      }
      continue;
    }

    if (janitor.targetLitterId >= 0) {
      const target = state.litter.find((l) => l.id === janitor.targetLitterId);
      if (!target) {
        janitor.targetLitterId = -1;
        janitor.path = [];
        continue;
      }
      if (janitor.path.length === 0) {
        const cellX = Math.floor(janitor.x / CELL_SIZE_METERS);
        const cellZ = Math.floor(janitor.z / CELL_SIZE_METERS);
        if (cellX === target.cellX && cellZ === target.cellZ) {
          janitor.cleanTicks = CLEAN_TICKS;
          continue;
        }
        const path = findPath(state, cellX, cellZ, target.cellX, target.cellZ);
        if (!path) {
          janitor.targetLitterId = -1; // unreachable — pick another next tick
          continue;
        }
        janitor.path = path;
      }
      const next = janitor.path[0]!;
      const targetX = ((next % w) + 0.5) * CELL_SIZE_METERS;
      const targetZ = (Math.floor(next / w) + 0.5) * CELL_SIZE_METERS;
      const dx = targetX - janitor.x;
      const dz = targetZ - janitor.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= JANITOR_SPEED) {
        janitor.x = targetX;
        janitor.z = targetZ;
        janitor.path.shift();
      } else {
        janitor.x += (dx / distance) * JANITOR_SPEED;
        janitor.z += (dz / distance) * JANITOR_SPEED;
      }
      continue;
    }

    // Claim the nearest unclaimed litter.
    const claimed = new Set(state.janitors.map((j) => j.targetLitterId));
    let best: Litter | null = null;
    let bestDistance = Infinity;
    for (const litter of state.litter) {
      if (claimed.has(litter.id)) {
        continue;
      }
      const distance =
        Math.abs(litter.cellX * CELL_SIZE_METERS - janitor.x) +
        Math.abs(litter.cellZ * CELL_SIZE_METERS - janitor.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = litter;
      }
    }
    if (best) {
      janitor.targetLitterId = best.id;
      janitor.path = [];
    }
  }
}
