"use client";

import { useMemo } from "react";
import { DoubleSide } from "three";
import { composedBuilding, type ComposedBuildingDef } from "@/content/buildings";
import { CELL_SIZE_METERS } from "@/shared/grid";
import { type Terrain } from "@/sim/api";
import { useGame } from "@/ui/game/store";
import { composedPartTransforms } from "./ComposedBuildings";
import { usePieceSubMeshes, type PieceTransform } from "./pieceMeshes";

/**
 * Build-mode-only feedback (GAME_DESIGN §8.1, "no visible grid outside build
 * mode"): hover cell highlight, ghost piece tinted by validity, path-drag
 * preview, and a local terrain-conforming grid patch around the cursor.
 */

function CellQuad({
  terrain,
  x,
  z,
  color,
  opacity,
  lift = 0.06,
}: {
  terrain: Terrain;
  x: number;
  z: number;
  color: string;
  opacity: number;
  lift?: number;
}) {
  const wx = (x + 0.5) * CELL_SIZE_METERS;
  const wz = (z + 0.5) * CELL_SIZE_METERS;
  const y = terrain.heightAt(wx, wz) + lift;
  return (
    <mesh position={[wx, y, wz]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[CELL_SIZE_METERS * 0.94, CELL_SIZE_METERS * 0.94]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function GhostPiece({ terrain, file }: { terrain: Terrain; file: string }) {
  const hover = useGame((state) => state.hover);
  const rotation = useGame((state) => state.rotation);
  const subMeshes = usePieceSubMeshes(file);
  if (!hover) {
    return null;
  }
  const wx = (hover.x + 0.5) * CELL_SIZE_METERS;
  const wz = (hover.z + 0.5) * CELL_SIZE_METERS;
  return (
    <group
      position={[wx, terrain.heightAt(wx, wz), wz]}
      rotation={[0, (rotation * Math.PI) / 2, 0]}
    >
      {subMeshes.map((subMesh, index) => (
        <mesh
          key={index}
          geometry={subMesh.geometry}
          matrix={subMesh.nodeMatrix}
          matrixAutoUpdate={false}
        >
          <meshStandardMaterial
            color={hover.valid ? "#37c871" : "#f0426c"}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Ghost for a composed building: the real parts, tinted, through the same
 * transform the placed building will use. A silhouette or a single anchor mesh
 * would have been cheaper, but the whole job of a ghost is to promise where
 * things land — a preview that disagrees with the result teaches players to
 * ignore it.
 */
function GhostComposed({ terrain, def }: { terrain: Terrain; def: ComposedBuildingDef }) {
  const hover = useGame((state) => state.hover);
  const rotation = useGame((state) => state.rotation);
  const catalog = useGame((state) => state.catalog);
  const byPiece = useMemo(
    (): Map<string, PieceTransform[]> =>
      hover
        ? composedPartTransforms(def, hover.x, hover.z, rotation, terrain)
        : new Map<string, PieceTransform[]>(),
    [def, hover, rotation, terrain],
  );
  if (!hover || !catalog) {
    return null;
  }
  const color = hover.valid ? "#37c871" : "#f0426c";
  return (
    <group>
      {[...byPiece.entries()].map(([pieceId, transforms]) => {
        const file = catalog.pieces.find((piece) => piece.id === pieceId)?.file;
        return file ? (
          <GhostPartMesh key={pieceId} file={file} transforms={transforms} color={color} />
        ) : null;
      })}
    </group>
  );
}

function GhostPartMesh({
  file,
  transforms,
  color,
}: {
  file: string;
  transforms: readonly PieceTransform[];
  color: string;
}) {
  const subMeshes = usePieceSubMeshes(file);
  return (
    <>
      {transforms.map((transform, i) => {
        const scale: readonly [number, number, number] =
          typeof transform.scale === "number"
            ? [transform.scale, transform.scale, transform.scale]
            : transform.scale;
        return (
          <group
            key={i}
            position={[transform.x, transform.y, transform.z]}
            rotation={[0, transform.rotY, 0]}
            scale={[scale[0], scale[1], scale[2]]}
          >
            {subMeshes.map((subMesh, index) => (
              <mesh
                key={index}
                geometry={subMesh.geometry}
                matrix={subMesh.nodeMatrix}
                matrixAutoUpdate={false}
              >
                <meshStandardMaterial
                  color={color}
                  transparent
                  opacity={0.55}
                  depthWrite={false}
                />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
}

function LocalGrid({ terrain }: { terrain: Terrain }) {
  const hover = useGame((state) => state.hover);
  const points = useMemo(() => {
    if (!hover) {
      return null;
    }
    const radius = 6;
    const vertices: number[] = [];
    const push = (wx: number, wz: number): void => {
      vertices.push(wx, terrain.heightAt(wx, wz) + 0.04, wz);
    };
    for (let gx = hover.x - radius; gx <= hover.x + radius + 1; gx++) {
      for (let gz = hover.z - radius; gz < hover.z + radius + 1; gz++) {
        if (!terrain.inBounds(gx, gz) && !terrain.inBounds(gx - 1, gz)) {
          continue;
        }
        push(gx * CELL_SIZE_METERS, gz * CELL_SIZE_METERS);
        push(gx * CELL_SIZE_METERS, (gz + 1) * CELL_SIZE_METERS);
      }
    }
    for (let gz = hover.z - radius; gz <= hover.z + radius + 1; gz++) {
      for (let gx = hover.x - radius; gx < hover.x + radius + 1; gx++) {
        if (!terrain.inBounds(gx, gz) && !terrain.inBounds(gx, gz - 1)) {
          continue;
        }
        push(gx * CELL_SIZE_METERS, gz * CELL_SIZE_METERS);
        push((gx + 1) * CELL_SIZE_METERS, gz * CELL_SIZE_METERS);
      }
    }
    return new Float32Array(vertices);
  }, [hover, terrain]);

  if (!points) {
    return null;
  }
  return (
    <lineSegments key={points.length + (hover ? hover.x * 1000 + hover.z : 0)}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.22} depthWrite={false} />
    </lineSegments>
  );
}

export function BuildOverlay({
  terrain,
  fileForPiece,
}: {
  terrain: Terrain;
  fileForPiece: (pieceId: string) => string | null;
}) {
  const buildMode = useGame((state) => state.buildMode);
  const hover = useGame((state) => state.hover);
  const pathDrag = useGame((state) => state.pathDrag);
  const rotation = useGame((state) => state.rotation);

  if (buildMode.kind === "inspect") {
    return null;
  }
  const composed = buildMode.kind === "place" ? composedBuilding(buildMode.pieceId) : undefined;
  const ghostFile =
    buildMode.kind === "place" && !composed ? fileForPiece(buildMode.pieceId) : null;
  // A multi-cell building highlights every cell it will claim, not just the one
  // under the cursor — otherwise the player cannot see what they are about to
  // cover until it is already there.
  const footprint = composed
    ? { w: rotation % 2 === 0 ? composed.footprint.w : composed.footprint.d,
        d: rotation % 2 === 0 ? composed.footprint.d : composed.footprint.w }
    : { w: 1, d: 1 };

  return (
    <group>
      <LocalGrid terrain={terrain} />
      {hover
        ? Array.from({ length: footprint.w * footprint.d }, (_, i) => (
            <CellQuad
              key={i}
              terrain={terrain}
              x={hover.x + (i % footprint.w)}
              z={hover.z + Math.floor(i / footprint.w)}
              color={
                buildMode.kind === "bulldoze" ? "#f0426c" : hover.valid ? "#37c871" : "#f0426c"
              }
              opacity={0.4}
            />
          ))
        : null}
      {pathDrag?.map((cell) => (
        <CellQuad
          key={`${cell.x}:${cell.z}`}
          terrain={terrain}
          x={cell.x}
          z={cell.z}
          color="#37c871"
          opacity={0.3}
        />
      ))}
      {ghostFile ? <GhostPiece terrain={terrain} file={ghostFile} /> : null}
      {composed ? <GhostComposed terrain={terrain} def={composed} /> : null}
    </group>
  );
}
