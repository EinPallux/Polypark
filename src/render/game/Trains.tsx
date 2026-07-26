"use client";

/* eslint-disable react-hooks/immutability --
   why: useFrame writes instanced matrices imperatively — the R3F pattern. */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Euler, Matrix4, Quaternion, Vector3, type InstancedMesh } from "three";
import { TRACK_FAMILIES } from "@/content/track";
import { poseAtArc, RIDE_STATE, type Terrain } from "@/sim/api";
import { useGame } from "@/ui/game/store";
import { usePieceSubMeshes } from "./pieceMeshes";

/**
 * Coaster trains: instanced cars playing back the measured speed profile with
 * fixed-step interpolation (TECH §6.1 instanced dynamics). Double-click a
 * train to ride along (ROADMAP M3); Escape releases the camera.
 */

const TRAIN_FILE = "models/coasterkit/train.glb";
const CAR_CAP = 48;

const scratch = {
  matrix: new Matrix4(),
  withNode: new Matrix4(),
  quaternion: new Quaternion(),
  euler: new Euler(),
  position: new Vector3(),
  scale: new Vector3(1, 1, 1),
};

export function Trains({ terrain }: { terrain: Terrain }) {
  void terrain;
  const subMeshes = usePieceSubMeshes(TRAIN_FILE);
  const refs = useRef<(InstancedMesh | null)[]>([]);
  const carRides = useMemo(() => new Array<number>(CAR_CAP).fill(0), []);

  useFrame(() => {
    const state = useGame.getState();
    const facade = state.facade;
    if (!facade) {
      return;
    }
    const alpha = state.stepper.alpha();
    const { tracked } = facade.ridesView();
    let car = 0;
    for (const ride of tracked) {
      if (!ride.evaln.valid || ride.state === RIDE_STATE.closed) {
        continue;
      }
      const family = TRACK_FAMILIES[ride.family];
      const arcNow =
        ride.trainPrevArc + (ride.trainArc - ride.trainPrevArc) * Math.min(alpha, 1);
      for (let i = 0; i < family.cars && car < CAR_CAP; i++) {
        const arc = arcNow - i * family.carPitch;
        const pose = poseAtArc(ride.anchor, ride.pieces, ride.evaln.runs, arc);
        scratch.position.set(pose.x, ride.baseHeight + pose.y, pose.z);
        scratch.euler.set(pose.pitchRad, pose.headingRad, 0, "YXZ");
        scratch.quaternion.setFromEuler(scratch.euler);
        scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
        carRides[car] = ride.key;
        for (const [meshIndex, mesh] of refs.current.entries()) {
          if (mesh) {
            scratch.withNode
              .copy(scratch.matrix)
              .multiply(subMeshes[meshIndex]!.nodeMatrix);
            mesh.setMatrixAt(car, scratch.withNode);
          }
        }
        car += 1;
      }
    }
    for (const mesh of refs.current) {
      if (mesh) {
        mesh.count = car;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <>
      {subMeshes.map((subMesh, index) => (
        <instancedMesh
          key={index}
          ref={(mesh) => {
            refs.current[index] = mesh;
          }}
          args={[subMesh.geometry, subMesh.material, CAR_CAP]}
          frustumCulled={false}
          onDoubleClick={(event) => {
            event.stopPropagation();
            const id = event.instanceId;
            if (id !== undefined && id < carRides.length) {
              useGame.getState().setRideAlong(carRides[id]!);
            }
          }}
        />
      ))}
    </>
  );
}
