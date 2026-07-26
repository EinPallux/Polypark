"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { BufferAttribute, Color, PlaneGeometry, type Mesh } from "three";
import { CELL_SIZE_METERS } from "@/shared/grid";
import { mulberry32Step, fnv1a } from "@/shared/rng";
import { type Terrain } from "@/sim/api";
import { useGame } from "@/ui/game/store";

/**
 * The heightfield (TECH §6.4): an inner mesh at 1 m vertex density over the
 * buildable rect (vertex-colored splat: grass variation, sandy shores, rocky
 * steeps, gravel halos under paths) and a coarser surround mesh for the
 * decorative ring. No checkerboard anywhere — color does the talking.
 */

const GRASS_A = new Color("#61b04b");
const GRASS_B = new Color("#79c25e");
const GRASS_DRY = new Color("#9fbf58");
const ROCK = new Color("#8d8577");
const SAND = new Color("#d8c087");
const GRAVEL = new Color("#b9a98c");
const UNDERWATER = new Color("#7a9a6b");

function colorNoise(x: number, z: number, seed: number): number {
  return mulberry32Step((fnv1a(`${seed}:${Math.round(x * 7)}:${Math.round(z * 7)}`) | 0) >>> 0)
    .value;
}

function buildGeometry(terrain: Terrain, resolution: number, margin: number): PlaneGeometry {
  const site = terrain.site;
  const width = site.cells.w * CELL_SIZE_METERS + margin * 2;
  const depth = site.cells.d * CELL_SIZE_METERS + margin * 2;
  const segmentsX = Math.round(width / resolution);
  const segmentsZ = Math.round(depth / resolution);
  const geometry = new PlaneGeometry(width, depth, segmentsX, segmentsZ);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(width / 2 - margin, 0, depth / 2 - margin);
  const positions = geometry.attributes["position"] as BufferAttribute;
  for (let i = 0; i < positions.count; i++) {
    positions.setY(i, terrain.heightAt(positions.getX(i), positions.getZ(i)));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function paintColors(geometry: PlaneGeometry, terrain: Terrain, pathCells: Set<number>): void {
  const site = terrain.site;
  const positions = geometry.attributes["position"] as BufferAttribute;
  const colors = new Float32Array(positions.count * 3);
  const color = new Color();
  const scratch = new Color();
  const waterLevel = site.waterLevel;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = positions.getY(i);

    // Grass with gentle patchiness.
    const patch = colorNoise(x, z, site.seed);
    color.copy(GRASS_A).lerp(GRASS_B, patch);
    if (patch > 0.82) {
      color.lerp(GRASS_DRY, 0.35);
    }

    // Rocky tint where the local gradient is steep.
    const gradient =
      Math.abs(terrain.heightAt(x + 0.9, z) - terrain.heightAt(x - 0.9, z)) +
      Math.abs(terrain.heightAt(x, z + 0.9) - terrain.heightAt(x, z - 0.9));
    if (gradient > 0.5) {
      color.lerp(ROCK, Math.min((gradient - 0.5) * 1.4, 0.7));
    }

    // Shoreline sand and underwater bed.
    if (y < waterLevel + 0.4) {
      color.lerp(SAND, Math.min((waterLevel + 0.4 - y) * 1.8, 1));
    }
    if (y < waterLevel - 0.15) {
      color.lerp(scratch.copy(UNDERWATER), 0.6);
    }

    // Gravel halo under and around path cells (soft organic edge).
    const cellX = Math.floor(x / CELL_SIZE_METERS);
    const cellZ = Math.floor(z / CELL_SIZE_METERS);
    let pathDistance = Infinity;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (pathCells.has((cellZ + dz) * site.cells.w + (cellX + dx))) {
          const centerX = (cellX + dx + 0.5) * CELL_SIZE_METERS;
          const centerZ = (cellZ + dz + 0.5) * CELL_SIZE_METERS;
          pathDistance = Math.min(pathDistance, Math.hypot(x - centerX, z - centerZ));
        }
      }
    }
    if (pathDistance < 1.9) {
      color.lerp(GRAVEL, 0.75 * (1 - pathDistance / 1.9));
    }

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

export function TerrainMesh({ terrain }: { terrain: Terrain }) {
  const worldVersion = useGame((state) => state.worldVersion);
  const snapshot = useGame((state) => state.snapshot);
  const innerRef = useRef<Mesh>(null);

  const inner = useMemo(() => buildGeometry(terrain, 1, 0), [terrain]);
  const surround = useMemo(
    () => buildGeometry(terrain, 2.5, terrain.site.surroundCells * CELL_SIZE_METERS),
    [terrain],
  );

  // Repaint the inner splat when paths change (worldVersion bumps).
  useLayoutEffect(() => {
    const pathCells = new Set<number>();
    snapshot?.world.pathCells.forEach((value, index) => {
      if (value === 1) {
        pathCells.add(index);
      }
    });
    paintColors(inner, terrain, pathCells);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion is the invalidation key for path edits
  }, [inner, terrain, worldVersion]);

  useMemo(() => paintColors(surround, terrain, new Set()), [surround, terrain]);

  return (
    <group>
      <mesh
        ref={innerRef}
        geometry={inner}
        receiveShadow
        onPointerMove={(event) => {
          const x = Math.floor(event.point.x / CELL_SIZE_METERS);
          const z = Math.floor(event.point.z / CELL_SIZE_METERS);
          const state = useGame.getState();
          state.hoverCell(x, z);
          if (event.buttons === 1) {
            state.dragCell(x, z);
          }
        }}
        onPointerDown={(event) => {
          if (event.button === 0) {
            const x = Math.floor(event.point.x / CELL_SIZE_METERS);
            const z = Math.floor(event.point.z / CELL_SIZE_METERS);
            useGame.getState().pressCell(x, z);
          }
        }}
        onPointerUp={() => useGame.getState().releasePointer()}
        onPointerLeave={() => useGame.getState().clearHover()}
      >
        <meshStandardMaterial vertexColors flatShading roughness={0.95} />
      </mesh>
      <mesh geometry={surround} position={[0, -0.03, 0]} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.95} />
      </mesh>
    </group>
  );
}
