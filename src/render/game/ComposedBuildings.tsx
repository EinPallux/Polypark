"use client";

import { useMemo } from "react";
import { composedBuilding, type ComposedBuildingDef } from "@/content/buildings";
import { CELL_SIZE_METERS } from "@/shared/grid";
import { type Terrain } from "@/sim/api";
import { useGame } from "@/ui/game/store";
import { InstancedPiece } from "./InstancedPiece";
import { type PieceTransform } from "./pieceMeshes";

/**
 * The four §6 buildings, drawn from their parts lists (src/content/buildings.ts).
 *
 * Nothing here animates, so — unlike the flat rides — parts are flattened into
 * instance transforms grouped by catalog piece rather than cloned into a scene
 * graph per building. Twelve Gift Kiosks cost the same draw calls as one.
 */

/** Placement rotation as radians, matching the flat rides' sign convention. */
function rotationOf(rot: number): number {
  return (-rot * Math.PI) / 2;
}

/**
 * Where one part of a placed composition lands in the world.
 *
 * Exported because the build ghost has to preview the exact same geometry — if
 * the preview and the placed building disagreed about where the counter goes,
 * every player would learn to distrust the ghost.
 */
export function composedPartTransforms(
  def: ComposedBuildingDef,
  cellX: number,
  cellZ: number,
  rot: number,
  terrain: Terrain,
): Map<string, PieceTransform[]> {
  // Footprint swaps on the odd rotations, exactly as footprintCells() does.
  const w = rot % 2 === 0 ? def.footprint.w : def.footprint.d;
  const d = rot % 2 === 0 ? def.footprint.d : def.footprint.w;
  const centreX = (cellX + w / 2) * CELL_SIZE_METERS;
  const centreZ = (cellZ + d / 2) * CELL_SIZE_METERS;
  const groundY = terrain.heightAt(centreX, centreZ);

  const theta = rotationOf(rot);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const byPiece = new Map<string, PieceTransform[]>();
  for (const part of def.parts) {
    const [px, py, pz] = part.pos;
    const list = byPiece.get(part.pieceId) ?? [];
    list.push({
      x: centreX + px * cos + pz * sin,
      y: groundY + py,
      z: centreZ + (-px * sin + pz * cos),
      rotY: theta + (part.rotY ?? 0),
      scale: part.scale ?? 1,
    });
    byPiece.set(part.pieceId, list);
  }
  return byPiece;
}

export function ComposedBuildings({
  terrain,
  fileForPiece,
}: {
  terrain: Terrain;
  fileForPiece: (pieceId: string) => string | null;
}) {
  const snapshot = useGame((state) => state.snapshot);
  const worldVersion = useGame((state) => state.worldVersion);

  const byPiece = useMemo(() => {
    const merged = new Map<string, PieceTransform[]>();
    for (const piece of snapshot?.world.placed ?? []) {
      const def = composedBuilding(piece.pieceId);
      if (!def) {
        continue;
      }
      for (const [pieceId, transforms] of composedPartTransforms(
        def,
        piece.x,
        piece.z,
        piece.rot,
        terrain,
      )) {
        const list = merged.get(pieceId) ?? [];
        list.push(...transforms);
        merged.set(pieceId, list);
      }
    }
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion invalidates the placed list
  }, [snapshot?.world.placed, terrain, worldVersion]);

  return (
    <>
      {[...byPiece.entries()].map(([pieceId, transforms]) => {
        const file = fileForPiece(pieceId);
        return file ? (
          <InstancedPiece key={`composed-${pieceId}`} file={file} transforms={transforms} />
        ) : null;
      })}
    </>
  );
}
