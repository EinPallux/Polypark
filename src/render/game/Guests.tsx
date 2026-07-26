"use client";

/* eslint-disable react-hooks/immutability --
   why: useFrame writes instanced matrices imperatively — the R3F pattern. */

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  Euler,
  Matrix4,
  MeshBasicMaterial,
  NearestFilter,
  PlaneGeometry,
  Quaternion,
  TextureLoader,
  Vector3,
  type InstancedMesh,
  type Texture,
} from "three";
import { EMOTE, GUEST_STATE, type Terrain } from "@/sim/api";
import { useGame } from "@/ui/game/store";
import { usePieceSubMeshes } from "./pieceMeshes";

/**
 * The crowd (GAME_DESIGN §12, TECH §6.3): one InstancedMesh per palette
 * variant, matrices rewritten each frame from the live SoA view with
 * prev→curr interpolation and a procedural walk bob. Janitors ride along in
 * the reserved f-palette pool. Click a guest to inspect them.
 */

const GUEST_SCALE = 0.2; // blocky characters are 2.7 u tall raw
const CROWD_CAP_PER_VARIANT = 320;
const VARIANT_FILES = [
  "models/blockycharacters/character-a.glb",
  "models/blockycharacters/character-b.glb",
  "models/blockycharacters/character-c.glb",
  "models/blockycharacters/character-d.glb",
  "models/blockycharacters/character-e.glb",
  "models/blockycharacters/character-f.glb", // janitor uniform
];

const scratch = {
  matrix: new Matrix4(),
  withNode: new Matrix4(),
  quaternion: new Quaternion(),
  euler: new Euler(),
  position: new Vector3(),
  scale: new Vector3(),
};

function VariantPool({
  file,
  variant,
  terrain,
}: {
  file: string;
  variant: number;
  terrain: Terrain;
}) {
  const subMeshes = usePieceSubMeshes(file);
  const refs = useRef<(InstancedMesh | null)[]>([]);
  /** instance index → guest slot, rebuilt every frame for click mapping. */
  const slotOf = useRef<Int32Array>(new Int32Array(CROWD_CAP_PER_VARIANT));

  useFrame(({ clock }) => {
    const state = useGame.getState();
    const facade = state.facade;
    if (!facade) {
      return;
    }
    const view = facade.guestView();
    const alpha = state.stepper.alpha();
    let written = 0;

    const writeInstance = (
      x: number,
      z: number,
      heading: number,
      bobPhase: number,
      slot: number,
    ): void => {
      if (written >= CROWD_CAP_PER_VARIANT) {
        return;
      }
      const y = terrain.heightAt(x, z);
      const bob = Math.abs(Math.sin(clock.elapsedTime * 9 + bobPhase)) * 0.045;
      scratch.position.set(x, y + bob, z);
      scratch.quaternion.setFromEuler(scratch.euler.set(0, heading, 0));
      scratch.scale.setScalar(GUEST_SCALE);
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
      slotOf.current[written] = slot;
      // Instance world = placement × node (quantized-geometry rule, TECH M1 note).
      for (let m = 0; m < refs.current.length; m++) {
        const mesh = refs.current[m];
        const node = subMeshes[m]?.nodeMatrix;
        if (mesh && node) {
          scratch.withNode.copy(scratch.matrix).multiply(node);
          mesh.setMatrixAt(written, scratch.withNode);
        }
      }
      written += 1;
    };

    if (variant < 5) {
      for (let slot = 0; slot < view.count; slot++) {
        if (view.state[slot] === GUEST_STATE.off || view.variant[slot] !== variant) {
          continue;
        }
        const x = view.px[slot]! + (view.x[slot]! - view.px[slot]!) * alpha;
        const z = view.pz[slot]! + (view.z[slot]! - view.pz[slot]!) * alpha;
        const dx = view.x[slot]! - view.px[slot]!;
        const dz = view.z[slot]! - view.pz[slot]!;
        const heading = dx * dx + dz * dz > 1e-8 ? Math.atan2(dx, dz) : slot;
        writeInstance(x, z, heading, slot, slot);
      }
    } else {
      // Janitors in the f-palette pool (negative slot = not inspectable).
      const janitors = state.snapshot?.janitors ?? [];
      for (const janitor of janitors) {
        writeInstance(janitor.x, janitor.z, (janitor.id * 1.7) % (Math.PI * 2), janitor.id, -1);
      }
    }

    for (const mesh of refs.current) {
      if (mesh) {
        mesh.count = written;
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
          args={[undefined, undefined, CROWD_CAP_PER_VARIANT]}
          geometry={subMesh.geometry}
          material={subMesh.material}
          frustumCulled={false}
          castShadow
          onClick={(event) => {
            event.stopPropagation();
            const slot = slotOf.current[event.instanceId ?? -1] ?? -1;
            if (slot >= 0) {
              useGame.getState().selectGuest(slot);
            }
          }}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Emote bubbles                                                       */
/* ------------------------------------------------------------------ */

const EMOTE_FILES: Record<number, string> = {
  [EMOTE.happy]: "/emotes/faceHappy.png",
  [EMOTE.thirsty]: "/emotes/drop.png",
  [EMOTE.needToilet]: "/emotes/exclamation.png",
  [EMOTE.tired]: "/emotes/sleep.png",
  [EMOTE.angry]: "/emotes/anger.png",
  [EMOTE.broke]: "/emotes/cash.png",
  [EMOTE.heart]: "/emotes/heart.png",
};

/** The one glyph no pack provides (GAME_BALANCE §10): a tiny canvas burger. */
function makeBurgerTexture(): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e8a33d";
  ctx.beginPath();
  ctx.arc(32, 24, 22, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#7a4a21";
  ctx.fillRect(10, 26, 44, 10);
  ctx.fillStyle = "#57a639";
  ctx.fillRect(8, 36, 48, 5);
  ctx.fillStyle = "#e8a33d";
  ctx.fillRect(10, 41, 44, 10);
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  return texture;
}

const bubbleGeometry = new PlaneGeometry(0.55, 0.55);

function EmoteBubbles({ terrain }: { terrain: Terrain }) {
  const loader = useMemo(() => new TextureLoader(), []);
  const materials = useMemo(() => {
    const map = new Map<number, MeshBasicMaterial>();
    for (const [emote, file] of Object.entries(EMOTE_FILES)) {
      map.set(
        Number(emote),
        new MeshBasicMaterial({ map: loader.load(file), transparent: true, depthWrite: false }),
      );
    }
    map.set(
      EMOTE.hungry,
      new MeshBasicMaterial({ map: makeBurgerTexture(), transparent: true, depthWrite: false }),
    );
    return map;
  }, [loader]);
  const refs = useRef<Map<number, InstancedMesh>>(new Map());

  useLayoutEffect(() => {
    const map = refs.current;
    return () => map.clear();
  }, []);

  useFrame(({ camera }) => {
    const state = useGame.getState();
    const facade = state.facade;
    if (!facade) {
      return;
    }
    const view = facade.guestView();
    const alpha = state.stepper.alpha();
    const written = new Map<number, number>();
    for (let slot = 0; slot < view.count; slot++) {
      const emote = view.emote[slot]!;
      if (view.state[slot] === GUEST_STATE.off || emote === EMOTE.none) {
        continue;
      }
      const mesh = refs.current.get(emote);
      if (!mesh) {
        continue;
      }
      const index = written.get(emote) ?? 0;
      if (index >= 120) {
        continue;
      }
      const x = view.px[slot]! + (view.x[slot]! - view.px[slot]!) * alpha;
      const z = view.pz[slot]! + (view.z[slot]! - view.pz[slot]!) * alpha;
      scratch.position.set(x, terrain.heightAt(x, z) + 0.95, z);
      scratch.scale.setScalar(1);
      scratch.matrix.compose(scratch.position, camera.quaternion, scratch.scale);
      mesh.setMatrixAt(index, scratch.matrix);
      written.set(emote, index + 1);
    }
    for (const [emote, mesh] of refs.current) {
      mesh.count = written.get(emote) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {[...materials.entries()].map(([emote, material]) => (
        <instancedMesh
          key={emote}
          ref={(mesh) => {
            if (mesh) {
              refs.current.set(emote, mesh);
            }
          }}
          args={[undefined, undefined, 120]}
          geometry={bubbleGeometry}
          material={material}
          frustumCulled={false}
        />
      ))}
    </>
  );
}

/** Litter: dropped snacks on the paths (kit piece, tiny). */
function LitterBits({ terrain }: { terrain: Terrain }) {
  const worldVersion = useGame((state) => state.worldVersion);
  const snapshot = useGame((state) => state.snapshot);
  const transforms = useMemo(
    () =>
      (snapshot?.litter ?? []).map((litter, index) => {
        const wx = (litter.cellX + 0.3 + ((litter.id * 37) % 40) / 100) * 2;
        const wz = (litter.cellZ + 0.3 + ((litter.id * 53) % 40) / 100) * 2;
        return {
          x: wx,
          y: terrain.heightAt(wx, wz) + 0.22,
          z: wz,
          rotY: litter.id * 1.3,
          scale: 0.55,
          index,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- litter changes with worldVersion/snapshot ticks
    [snapshot?.litter, terrain, worldVersion],
  );
  const subMeshes = usePieceSubMeshes("models/foodkit/burger-cheese.glb");
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    const subMesh = subMeshes[0];
    if (!mesh || !subMesh) {
      return;
    }
    for (let i = 0; i < transforms.length && i < 200; i++) {
      const transform = transforms[i]!;
      scratch.position.set(transform.x, transform.y, transform.z);
      scratch.quaternion.setFromEuler(scratch.euler.set(0.4, transform.rotY, 0.2));
      scratch.scale.setScalar(transform.scale);
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
      scratch.matrix.multiply(subMesh.nodeMatrix);
      mesh.setMatrixAt(i, scratch.matrix);
    }
    mesh.count = Math.min(transforms.length, 200);
    mesh.instanceMatrix.needsUpdate = true;
  }, [transforms, subMeshes]);

  const subMesh = subMeshes[0];
  if (!subMesh) {
    return null;
  }
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, 200]}
      geometry={subMesh.geometry}
      material={subMesh.material}
      frustumCulled={false}
    />
  );
}

export function Guests({ terrain }: { terrain: Terrain }) {
  return (
    <>
      {VARIANT_FILES.map((file, variant) => (
        <VariantPool key={file} file={file} variant={variant} terrain={terrain} />
      ))}
      <EmoteBubbles terrain={terrain} />
      <LitterBits terrain={terrain} />
    </>
  );
}
