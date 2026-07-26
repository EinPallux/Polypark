"use client";

import { useMemo } from "react";
import { CELL_SIZE_METERS } from "@/shared/grid";
import { RngStream } from "@/shared/rng";
import { type Terrain } from "@/sim/api";
import { InstancedPiece } from "./InstancedPiece";
import { type PieceTransform } from "./pieceMeshes";

/**
 * Deterministic vegetation scatter from the site descriptor (TECH §6.4):
 * visual-only, seeded by the site (not the park), instanced per species.
 * The rim ring gives the lush treeline; interior groups add meadow life.
 */

interface SpeciesPlacements {
  readonly pieceId: string;
  readonly transforms: PieceTransform[];
}

const SLOPE_LIMIT: Record<string, number> = { flat: 0.1, gentle: 0.28, steep: 10 };

function slopeRiseAt(terrain: Terrain, wx: number, wz: number): number {
  const h = CELL_SIZE_METERS / 2;
  const heights = [
    terrain.heightAt(wx - h, wz - h),
    terrain.heightAt(wx + h, wz - h),
    terrain.heightAt(wx - h, wz + h),
    terrain.heightAt(wx + h, wz + h),
  ];
  return Math.max(...heights) - Math.min(...heights);
}

export function computeScatter(terrain: Terrain): SpeciesPlacements[] {
  const site = terrain.site;
  const byPiece = new Map<string, PieceTransform[]>();

  site.scatter.forEach((group, groupIndex) => {
    const rng = RngStream.fromSeed(site.seed, `scatter:${groupIndex}`);
    const maxRise = SLOPE_LIMIT[group.maxSlope] ?? 10;
    const surround = site.surroundCells;
    const minCell = group.region === "rim" ? -surround : 0;
    const maxCellX = group.region === "rim" ? site.cells.w + surround : site.cells.w;
    const maxCellZ = group.region === "rim" ? site.cells.d + surround : site.cells.d;

    for (let cz = minCell; cz < maxCellZ; cz++) {
      for (let cx = minCell; cx < maxCellX; cx++) {
        const inInterior = cx >= 0 && cz >= 0 && cx < site.cells.w && cz < site.cells.d;
        if (group.region === "rim" ? inInterior : !inInterior) {
          continue;
        }
        if (!rng.chance(group.density)) {
          continue;
        }
        const wx = (cx + rng.next()) * CELL_SIZE_METERS;
        const wz = (cz + rng.next()) * CELL_SIZE_METERS;
        const y = terrain.heightAt(wx, wz);
        if (y < site.waterLevel + 0.15) {
          continue; // nothing grows in the pond
        }
        if (slopeRiseAt(terrain, wx, wz) > maxRise) {
          continue;
        }
        const pieceId = group.pieces[rng.nextInt(0, group.pieces.length - 1)]!;
        const list = byPiece.get(pieceId) ?? [];
        list.push({
          x: wx,
          y,
          z: wz,
          rotY: rng.next() * Math.PI * 2,
          scale: rng.nextRange(group.minScale, group.maxScale),
        });
        byPiece.set(pieceId, list);
      }
    }
  });

  return [...byPiece.entries()].map(([pieceId, transforms]) => ({ pieceId, transforms }));
}

export function Scatter({
  terrain,
  fileForPiece,
}: {
  terrain: Terrain;
  fileForPiece: (pieceId: string) => string | null;
}) {
  const species = useMemo(() => computeScatter(terrain), [terrain]);
  return (
    <>
      {species.map((entry) => {
        const file = fileForPiece(entry.pieceId);
        if (!file) {
          return null;
        }
        return <InstancedPiece key={entry.pieceId} file={file} transforms={entry.transforms} />;
      })}
    </>
  );
}
