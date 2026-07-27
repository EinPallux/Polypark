"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { MathUtils, type Group } from "three";
import { FLAT_RIDES, type FlatRideDef, type RidePart } from "@/content/rides";
import { CELL_SIZE_METERS } from "@/shared/grid";
import { RIDE_STATE, type FlatRideView, type Terrain } from "@/sim/api";
import { useGame } from "@/ui/game/store";

/**
 * Flat rides: kit compositions with parametric group animation (TECH §4.6 —
 * spin/swing/drop programs, no physics). Each placed ride is one small scene
 * graph; the rotor/swing/lift group eases up while running and coasts to a
 * stop while loading.
 */

function PartMesh({ part, catalogFile }: { part: RidePart; catalogFile: string | null }) {
  // Hooks stay unconditional: resolve to the pad tile when a file is missing.
  const { scene } = useGLTF(`/${catalogFile ?? "models/miniarena/floor.glb"}`);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const scale: readonly [number, number, number] =
    typeof part.scale === "number"
      ? [part.scale, part.scale, part.scale]
      : (part.scale ?? [1, 1, 1]);
  return (
    <group
      position={[part.pos[0], part.pos[1], part.pos[2]]}
      rotation={[0, part.rotY ?? 0, 0]}
      scale={[scale[0], scale[1], scale[2]]}
    >
      <primitive object={cloned} />
    </group>
  );
}

function FlatRideNode({
  ride,
  def,
  terrain,
  fileForPiece,
}: {
  ride: FlatRideView;
  def: FlatRideDef;
  terrain: Terrain;
  fileForPiece: (pieceId: string) => string | null;
}) {
  const rotorRef = useRef<Group>(null);
  const swingRef = useRef<Group>(null);
  const liftRef = useRef<Group>(null);
  const speedRef = useRef(0);

  const w = ride.rot % 2 === 0 ? def.footprint.w : def.footprint.d;
  const d = ride.rot % 2 === 0 ? def.footprint.d : def.footprint.w;
  const cx = (ride.x + w / 2) * CELL_SIZE_METERS;
  const cz = (ride.z + d / 2) * CELL_SIZE_METERS;
  const y = terrain.heightAt(cx, cz);

  useFrame(({ clock }, delta) => {
    const running = ride.state === RIDE_STATE.open || ride.state === RIDE_STATE.testing;
    const target = running && ride.phase === "running" ? 1 : 0;
    speedRef.current = MathUtils.damp(speedRef.current, target, 2.2, delta);
    const speed = speedRef.current;
    const t = clock.elapsedTime;
    const anim = def.anim;
    if (rotorRef.current && (anim.kind === "spin" || anim.kind === "carousel")) {
      rotorRef.current.rotation.y += ((anim.rpm * Math.PI * 2) / 60) * delta * speed;
      if (anim.kind === "carousel") {
        // Mounts bob via child offsets baked at author time; the whole rotor
        // breathes gently instead (cheap, reads as motion at park scale).
        rotorRef.current.position.y = Math.sin(t * anim.bobHz * Math.PI * 2) * anim.bobAmp * speed;
      }
      if (anim.kind === "spin" && anim.counterRpm) {
        for (const cup of rotorRef.current.children) {
          cup.rotation.y += ((anim.counterRpm * Math.PI * 2) / 60) * delta * speed;
        }
      }
    }
    if (swingRef.current && anim.kind === "swing") {
      const angle =
        Math.sin((t * Math.PI * 2) / anim.periodS) * MathUtils.degToRad(anim.maxAngleDeg);
      swingRef.current.rotation.z = angle * speed;
    }
    if (liftRef.current && anim.kind === "drop") {
      const cycle = anim.riseS + anim.holdS + anim.dropS + 1.2;
      const phase = (t % cycle) * speed;
      let h = 0;
      if (phase < anim.riseS) {
        h = (phase / anim.riseS) * anim.height;
      } else if (phase < anim.riseS + anim.holdS) {
        h = anim.height;
      } else if (phase < anim.riseS + anim.holdS + anim.dropS) {
        const ft = (phase - anim.riseS - anim.holdS) / anim.dropS;
        h = anim.height * (1 - ft * ft); // accelerating fall
      } else {
        h = 0;
      }
      liftRef.current.position.y = h;
    }
  });

  const groups = useMemo(() => {
    const byGroup = new Map<RidePart["group"], RidePart[]>();
    for (const part of def.parts) {
      const list = byGroup.get(part.group) ?? [];
      list.push(part);
      byGroup.set(part.group, list);
    }
    return byGroup;
  }, [def.parts]);

  const anim = def.anim;
  const pivotY = anim.kind === "swing" ? anim.pivotY : 0;

  return (
    <group position={[cx, y, cz]} rotation={[0, (-ride.rot * Math.PI) / 2, 0]}>
      {(groups.get("static") ?? []).map((part, i) => (
        <PartMesh key={`s${i}`} part={part} catalogFile={fileForPiece(part.pieceId)} />
      ))}
      <group ref={rotorRef}>
        {(groups.get("rotor") ?? []).map((part, i) => (
          <PartMesh key={`r${i}`} part={part} catalogFile={fileForPiece(part.pieceId)} />
        ))}
      </group>
      <group position={[0, pivotY, 0]}>
        <group ref={swingRef}>
          {(groups.get("swing") ?? []).map((part, i) => (
            <PartMesh key={`w${i}`} part={part} catalogFile={fileForPiece(part.pieceId)} />
          ))}
        </group>
      </group>
      <group ref={liftRef}>
        {(groups.get("lift") ?? []).map((part, i) => (
          <PartMesh key={`l${i}`} part={part} catalogFile={fileForPiece(part.pieceId)} />
        ))}
      </group>
    </group>
  );
}

export function FlatRides({
  terrain,
  fileForPiece,
}: {
  terrain: Terrain;
  fileForPiece: (pieceId: string) => string | null;
}) {
  const rides = useGame((state) => state.rides);
  return (
    <>
      {(rides?.flat ?? []).map((ride) => (
        <FlatRideNode
          key={ride.key}
          ride={ride}
          def={FLAT_RIDES[ride.defId]}
          terrain={terrain}
          fileForPiece={fileForPiece}
        />
      ))}
    </>
  );
}
