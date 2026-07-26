"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import {
  Mesh,
  type BufferGeometry,
  type Material,
  type Matrix4,
  type Object3D,
} from "three";

/**
 * Extracts renderable submeshes from an optimized catalog GLB for instancing.
 *
 * IMPORTANT: geometries are shared UNMODIFIED. The pipeline quantizes
 * attributes (KHR_mesh_quantization) and parks the dequantization scale on the
 * node transform — so each submesh carries its `nodeMatrix`, which instance
 * renderers must compose into every instance matrix. Baking it into the
 * geometry would corrupt the quantized int attributes (learned the hard way).
 */
export interface SubMesh {
  readonly geometry: BufferGeometry;
  readonly material: Material;
  readonly nodeMatrix: Matrix4;
}

export function extractSubMeshes(root: Object3D): SubMesh[] {
  const subMeshes: SubMesh[] = [];
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (node instanceof Mesh) {
      const mesh = node as Mesh<BufferGeometry, Material>;
      subMeshes.push({
        geometry: mesh.geometry,
        material: mesh.material,
        nodeMatrix: mesh.matrixWorld.clone(),
      });
    }
  });
  return subMeshes;
}

/** Load a shipped model (public/models/…) and memoize its submeshes. */
export function usePieceSubMeshes(file: string): SubMesh[] {
  const { scene } = useGLTF(`/${file}`);
  return useMemo(() => extractSubMeshes(scene), [scene]);
}

export interface PieceTransform {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotY: number;
  readonly scale: number;
  /** Optional ground normal — the piece tilts to sit flush on sloped terrain. */
  readonly tilt?: { readonly x: number; readonly y: number; readonly z: number };
}
