"use client";

import { useMemo } from "react";
import { CELL_SIZE_METERS } from "@/shared/grid";
import { type Terrain } from "@/sim/api";
import { useGame } from "@/ui/game/store";
import { InstancedPiece } from "./InstancedPiece";
import { type PieceTransform } from "./pieceMeshes";

/**
 * Player-built content: scenery/prop instances from the snapshot plus the
 * auto-tiled path layer resolved by the sim (GAME_DESIGN §8.1).
 */

/** ground_path* tiles are 1×1 m sunken slabs — scaled to the 2 m cell and lifted so the slab top clears the lawn. */
const PATH_TILE_SCALE = CELL_SIZE_METERS;
const PATH_TILE_LIFT = 0.2;

function groundNormal(
  terrain: Terrain,
  wx: number,
  wz: number,
): { x: number; y: number; z: number } {
  const step = 0.9;
  const dx = terrain.heightAt(wx + step, wz) - terrain.heightAt(wx - step, wz);
  const dz = terrain.heightAt(wx, wz + step) - terrain.heightAt(wx, wz - step);
  return { x: -dx, y: 2 * step, z: -dz };
}

const PATH_KIND_TO_PIECE: Record<string, string> = {
  "path-tile": "naturekit/path-tile",
  "path-cross": "naturekit/path-cross",
  "path-split": "naturekit/path-split",
  "path-straight": "naturekit/path-straight",
  "path-bend": "naturekit/path-bend",
  "path-end": "naturekit/path-end",
};

export function PlacedPieces({
  terrain,
  fileForPiece,
}: {
  terrain: Terrain;
  fileForPiece: (pieceId: string) => string | null;
}) {
  const snapshot = useGame((state) => state.snapshot);
  const worldVersion = useGame((state) => state.worldVersion);
  const facade = useGame((state) => state.facade);

  const sceneryByPiece = useMemo(() => {
    const byPiece = new Map<string, PieceTransform[]>();
    for (const piece of snapshot?.world.placed ?? []) {
      const wx = (piece.x + 0.5) * CELL_SIZE_METERS;
      const wz = (piece.z + 0.5) * CELL_SIZE_METERS;
      const list = byPiece.get(piece.pieceId) ?? [];
      list.push({
        x: wx,
        y: terrain.heightAt(wx, wz),
        z: wz,
        rotY: (piece.rot * Math.PI) / 2,
        scale: 1,
      });
      byPiece.set(piece.pieceId, list);
    }
    return byPiece;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion invalidates the placed list
  }, [snapshot?.world.placed, terrain, worldVersion]);

  const pathByPiece = useMemo(() => {
    const byPiece = new Map<string, PieceTransform[]>();
    if (!facade) {
      return byPiece;
    }
    for (const tile of facade.pathTiles()) {
      const pieceId = PATH_KIND_TO_PIECE[tile.kind];
      if (!pieceId) {
        continue;
      }
      const wx = (tile.x + 0.5) * CELL_SIZE_METERS;
      const wz = (tile.z + 0.5) * CELL_SIZE_METERS;
      const list = byPiece.get(pieceId) ?? [];
      list.push({
        x: wx,
        y: terrain.heightAt(wx, wz) + PATH_TILE_LIFT,
        z: wz,
        rotY: (-tile.rot * Math.PI) / 2,
        scale: PATH_TILE_SCALE,
        tilt: groundNormal(terrain, wx, wz),
      });
      byPiece.set(pieceId, list);
    }
    return byPiece;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion invalidates the path layer
  }, [facade, terrain, worldVersion]);

  return (
    <>
      {[...sceneryByPiece.entries()].map(([pieceId, transforms]) => {
        const file = fileForPiece(pieceId);
        return file ? <InstancedPiece key={pieceId} file={file} transforms={transforms} /> : null;
      })}
      {[...pathByPiece.entries()].map(([pieceId, transforms]) => {
        const file = fileForPiece(pieceId);
        return file ? (
          <InstancedPiece key={`path-${pieceId}`} file={file} transforms={transforms} />
        ) : null;
      })}
    </>
  );
}
