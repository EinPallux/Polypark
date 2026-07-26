"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { type Mesh } from "three";
import { CELL_SIZE_METERS } from "@/shared/grid";
import { type Terrain } from "@/sim/api";

/** Pond surface over the site's water cells: translucent plane with a slow bob. */
export function Water({ terrain }: { terrain: Terrain }) {
  const ref = useRef<Mesh>(null);

  const bounds = useMemo(() => {
    const site = terrain.site;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let z = 0; z < site.cells.d; z++) {
      for (let x = 0; x < site.cells.w; x++) {
        if (terrain.isWater(x, z)) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x + 1);
          minZ = Math.min(minZ, z);
          maxZ = Math.max(maxZ, z + 1);
        }
      }
    }
    if (minX === Infinity) {
      return null;
    }
    const pad = CELL_SIZE_METERS * 0.75;
    return {
      cx: ((minX + maxX) / 2) * CELL_SIZE_METERS,
      cz: ((minZ + maxZ) / 2) * CELL_SIZE_METERS,
      w: (maxX - minX) * CELL_SIZE_METERS + pad * 2,
      d: (maxZ - minZ) * CELL_SIZE_METERS + pad * 2,
    };
  }, [terrain]);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y =
        terrain.site.waterLevel + 0.02 + Math.sin(clock.elapsedTime * 0.6) * 0.015;
    }
  });

  if (!bounds) {
    return null;
  }
  return (
    <mesh
      ref={ref}
      position={[bounds.cx, terrain.site.waterLevel + 0.02, bounds.cz]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[bounds.w, bounds.d, 1, 1]} />
      <meshStandardMaterial color="#3fa8c9" transparent opacity={0.72} roughness={0.15} metalness={0.05} />
    </mesh>
  );
}
