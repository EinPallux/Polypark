"use client";

import { useLayoutEffect, useRef } from "react";
import {
  Matrix4,
  Euler,
  Vector3,
  Quaternion,
  type BufferGeometry,
  type InstancedMesh,
  type Material,
} from "three";
import { usePieceSubMeshes, type PieceTransform } from "./pieceMeshes";

const scratchMatrix = new Matrix4();
const scratchQuaternion = new Quaternion();
const scratchTilt = new Quaternion();
const scratchEuler = new Euler();
const scratchScale = new Vector3();
const scratchPosition = new Vector3();
const scratchNormal = new Vector3();
const UP = new Vector3(0, 1, 0);

/** One catalog piece rendered at N transforms via InstancedMesh per submesh. */
export function InstancedPiece({
  file,
  transforms,
  frustumCulled = true,
}: {
  file: string;
  transforms: readonly PieceTransform[];
  frustumCulled?: boolean;
}) {
  const subMeshes = usePieceSubMeshes(file);
  return (
    <>
      {subMeshes.map((subMesh, index) => (
        <SubMeshInstances
          key={index}
          geometry={subMesh.geometry}
          material={subMesh.material}
          nodeMatrix={subMesh.nodeMatrix}
          transforms={transforms}
          frustumCulled={frustumCulled}
        />
      ))}
    </>
  );
}

function SubMeshInstances({
  geometry,
  material,
  nodeMatrix,
  transforms,
  frustumCulled,
}: {
  geometry: BufferGeometry;
  material: Material;
  nodeMatrix: Matrix4;
  transforms: readonly PieceTransform[];
  frustumCulled: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) {
      return;
    }
    for (let i = 0; i < transforms.length; i++) {
      const transform = transforms[i]!;
      scratchPosition.set(transform.x, transform.y, transform.z);
      scratchQuaternion.setFromEuler(scratchEuler.set(0, transform.rotY, 0));
      if (transform.tilt) {
        scratchNormal.set(transform.tilt.x, transform.tilt.y, transform.tilt.z).normalize();
        scratchTilt.setFromUnitVectors(UP, scratchNormal);
        scratchQuaternion.premultiply(scratchTilt);
      }
      if (typeof transform.scale === "number") {
        scratchScale.setScalar(transform.scale);
      } else {
        scratchScale.set(transform.scale[0], transform.scale[1], transform.scale[2]);
      }
      scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
      // Instance world = placement × node (carries the dequantization scale).
      scratchMatrix.multiply(nodeMatrix);
      mesh.setMatrixAt(i, scratchMatrix);
    }
    mesh.count = transforms.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [transforms, nodeMatrix]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, Math.max(transforms.length, 1)]}
      frustumCulled={frustumCulled}
      castShadow
      receiveShadow
      key={transforms.length > 0 ? `cap-${nextPow2(transforms.length)}` : "cap-1"}
    />
  );
}

function nextPow2(value: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(value, 1)));
}
