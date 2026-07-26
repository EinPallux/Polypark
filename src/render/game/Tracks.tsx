"use client";

import { useMemo } from "react";
import { STATION_PROP_PIECES, SUPPORT_PIECES, TRACK_FAMILIES, TRACK_KINDS } from "@/content/track";
import {
  pieceEntryPoses,
  pieceRenderFrame,
  type Terrain,
  type TrackedRideView,
  type TrackPose,
} from "@/sim/api";
import { useGame } from "@/ui/game/store";
import { InstancedPiece } from "./InstancedPiece";
import { type PieceTransform } from "./pieceMeshes";

/**
 * Coaster track rendering: every piece resolves to an instanced catalog mesh
 * anchored at its forward-frame port (flipped pieces reuse the same geometry
 * from the far end). Elevated rails grow stacks of 1 m support modules —
 * the kit's own construction fantasy (GAME_DESIGN §8.2).
 */

const headingYaw = (heading: number): number => (heading * Math.PI) / 2;

/** Local-frame offset rotated into world space for a pose. */
function local(pose: TrackPose, dx: number, dz: number): { x: number; z: number } {
  const yaw = headingYaw(pose.heading);
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return { x: pose.mx + cos * dx + sin * dz, z: pose.mz - sin * dx + cos * dz };
}

export function Tracks({
  terrain,
  fileForPiece,
}: {
  terrain: Terrain;
  fileForPiece: (pieceId: string) => string | null;
}) {
  const rides = useGame((state) => state.rides);
  const worldVersion = useGame((state) => state.worldVersion);

  const byPiece = useMemo(() => {
    const map = new Map<string, PieceTransform[]>();
    const push = (pieceId: string, t: PieceTransform): void => {
      const list = map.get(pieceId) ?? [];
      list.push(t);
      map.set(pieceId, list);
    };
    for (const ride of rides?.tracked ?? []) {
      addTrackedRide(push, ride, terrain);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion invalidates ride geometry
  }, [rides, terrain, worldVersion]);

  return (
    <>
      {[...byPiece.entries()].map(([pieceId, transforms]) => {
        const file = fileForPiece(pieceId);
        return file ? (
          <InstancedPiece key={`track-${pieceId}`} file={file} transforms={transforms} />
        ) : null;
      })}
    </>
  );
}

function addTrackedRide(
  push: (pieceId: string, t: PieceTransform) => void,
  ride: TrackedRideView,
  terrain: Terrain,
): void {
  const family = TRACK_FAMILIES[ride.family];
  const poses = pieceEntryPoses(ride.anchor, ride.pieces);
  for (let i = 0; i < ride.pieces.length; i++) {
    const piece = ride.pieces[i]!;
    const frame = pieceRenderFrame(poses[i]!, piece);
    const railY = ride.baseHeight + frame.level * 0.5 + 0.3;
    const yaw = headingYaw(frame.heading);
    if (piece.kind === "station") {
      // Station run: four 1 m track segments + platform slabs + entry gate.
      const trackPieceId = family.pieceIds.station;
      for (let seg = 0; seg < 4; seg++) {
        const at = local(frame, 0, 0.5 + seg);
        push(trackPieceId, {
          x: at.x,
          y: railY + family.stationRailToOrigin,
          z: at.z,
          rotY: yaw,
          scale: 1,
        });
      }
      for (let seg = 0; seg < 2; seg++) {
        const at = local(frame, 1.5, 1 + seg * 1.6);
        push(STATION_PROP_PIECES.platform, {
          x: at.x,
          y: ride.baseHeight,
          z: at.z,
          rotY: yaw + Math.PI / 2,
          scale: 1,
        });
      }
      const gateAt = local(frame, 2.2, 3.4);
      push(STATION_PROP_PIECES.gate, {
        x: gateAt.x,
        y: ride.baseHeight,
        z: gateAt.z,
        rotY: yaw + Math.PI / 2,
        scale: 1,
      });
      continue;
    }
    const pieceId = family.pieceIds[piece.kind];
    const def = TRACK_KINDS[piece.kind];
    // The loop mesh is authored around its center: shift 2 m into the run.
    const meshAt = def.tags.inversion ? local(frame, 0, 2) : { x: frame.mx, z: frame.mz };
    push(pieceId, {
      x: meshAt.x,
      y: railY + family.railToOrigin,
      z: meshAt.z,
      rotY: yaw,
      scale: 1,
    });
    // Support stack at the piece entry, one 1 m module per meter of air.
    const ground = terrain.heightAt(frame.mx, frame.mz);
    const air = railY - 0.3 - ground;
    const modules = Math.floor(air + 0.01);
    for (let m = 0; m < Math.min(modules, 12); m++) {
      push(SUPPORT_PIECES.small, {
        x: frame.mx,
        y: ground + m,
        z: frame.mz,
        rotY: yaw,
        scale: 1,
      });
    }
  }
}
