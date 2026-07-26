"use client";

/**
 * The living title-screen vignette (UI_UX §6.1): a slice of park on a grassy
 * mound, slowly orbiting. Every mesh is a pilot-catalog piece (kit-only law);
 * the ground disc + lighting are generated utility visuals (GAME_DESIGN P7).
 */
import { Suspense, useRef, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Clone, useGLTF } from "@react-three/drei";
import { type Group } from "three";

const MODEL = (id: string): string => `/models/${id}.glb`;

const PRELOAD_IDS = [
  "naturekit/path-straight",
  "naturekit/path-bend",
  "naturekit/tree-simple",
  "naturekit/tree-pine-small-a",
  "naturekit/tree-pine-tall-b",
  "naturekit/bush",
  "naturekit/rock-large-b",
  "naturekit/flower-yellow-b",
  "coasterkit/station",
  "coasterkit/steel-straight",
  "coasterkit/steel-curve",
  "coasterkit/steel-hill-complete",
  "coasterkit/steel-looping",
  "coasterkit/train",
  "foodkit/cup-tea",
  "citybits/car-sedan",
  "citybits/car-taxi",
  "furniturekit/bench",
  "furniturekit/lamp-round-floor",
  "blockycharacters/character-a",
  "cubepets/cat",
  "cubepets/bunny",
];

for (const id of PRELOAD_IDS) {
  useGLTF.preload(MODEL(id));
}

function Piece({
  id,
  position,
  rotationY = 0,
  scale = 1,
}: {
  id: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}) {
  const { scene } = useGLTF(MODEL(id));
  return <Clone object={scene} position={position} rotation={[0, rotationY, 0]} scale={scale} />;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

function Scene() {
  const spin = useRef<Group>(null);
  const reducedMotion = usePrefersReducedMotion();

  useFrame((_, delta) => {
    if (!reducedMotion && spin.current) {
      spin.current.rotation.y += delta * 0.06;
    }
  });

  return (
    <group ref={spin} rotation={[0, 0.6, 0]}>
      {/* grassy mound + earthy rim — generated utility ground */}
      <mesh position={[0, -0.28, 0]}>
        <cylinderGeometry args={[7.0, 7.5, 0.56, 48]} />
        <meshStandardMaterial color="#5fae4e" flatShading />
      </mesh>
      <mesh position={[0, -0.62, 0]}>
        <cylinderGeometry args={[7.5, 6.9, 0.5, 48]} />
        <meshStandardMaterial color="#8a6f47" flatShading />
      </mesh>

      {/* winding path across the mound. NatureKit ground tiles are authored
          sunken (AABB y −0.1…−0.05), so lift them until the slab clears grass. */}
      <group position={[0, 0.16, 0]}>
        {[-2, -1, 0, 1].map((x) => (
          <Piece
            key={`path-${x}`}
            id="naturekit/path-straight"
            position={[x * 1.5, 0, 0.9]}
            rotationY={Math.PI / 2}
            scale={1.5}
          />
        ))}
        <Piece id="naturekit/path-bend" position={[3, 0, 0.9]} rotationY={Math.PI} scale={1.5} />
        <Piece id="naturekit/path-straight" position={[3, 0, -0.6]} scale={1.5} />
      </group>

      {/* mini coaster running behind: hill → straights → loop silhouette */}
      <group position={[0, 0, -3.1]} scale={1.1}>
        <Piece id="coasterkit/steel-looping" position={[-3.2, 0, 0]} rotationY={Math.PI / 2} />
        <Piece id="coasterkit/steel-hill-complete" position={[-1.2, 0, 0]} rotationY={Math.PI / 2} />
        <Piece id="coasterkit/steel-straight" position={[0.4, 0, 0]} rotationY={Math.PI / 2} />
        <Piece id="coasterkit/steel-straight" position={[1.4, 0, 0]} rotationY={Math.PI / 2} />
        <Piece id="coasterkit/train" position={[0.9, 0.08, 0]} rotationY={Math.PI / 2} />
        <Piece id="coasterkit/station" position={[2.6, 0, 0.1]} scale={1.25} />
      </group>

      {/* teacup-on-saucer centerpiece — the future Teacup Twirl, toybox scale */}
      <group position={[-2.9, 0, 2.2]} rotation={[0, 0.7, 0]}>
        <Piece id="foodkit/cup-saucer" position={[0, 0.01, 0]} scale={3.2} />
        <Piece id="foodkit/cup-tea" position={[0, 0.06, 0]} scale={3.0} />
      </group>

      {/* arrivals parked at the rim (CityBits cars are ~0.3u tall — scale up) */}
      <Piece id="citybits/car-sedan" position={[4.3, 0, 2.6]} rotationY={-0.5} scale={1.4} />
      <Piece id="citybits/car-taxi" position={[5.1, 0, 1.3]} rotationY={-0.7} scale={1.4} />

      {/* guests & friends on the path (character-a is 2.7u tall raw → ≈0.55u here) */}
      <Piece id="blockycharacters/character-a" position={[-0.6, 0.085, 0.9]} rotationY={2.4} scale={0.2} />
      <Piece id="cubepets/cat" position={[-0.1, 0.085, 1.15]} rotationY={-2.2} scale={0.13} />
      <Piece id="cubepets/bunny" position={[-1.4, 0.085, 0.65]} rotationY={1.1} scale={0.13} />

      {/* street furniture beside the path */}
      <Piece id="furniturekit/bench" position={[0.9, 0, 1.8]} rotationY={Math.PI} scale={0.75} />
      <Piece id="furniturekit/lamp-round-floor" position={[1.8, 0, 1.7]} scale={0.8} />

      {/* greenery ring */}
      <Piece id="naturekit/tree-simple" position={[-4.6, 0, 0.4]} scale={1.5} />
      <Piece id="naturekit/tree-pine-tall-b" position={[4.4, 0, -2.6]} scale={1.5} />
      <Piece id="naturekit/tree-pine-small-a" position={[5.2, 0, -0.8]} scale={1.3} />
      <Piece id="naturekit/tree-pine-small-a" position={[-5.3, 0, -1.9]} rotationY={1.9} scale={1.2} />
      <Piece id="naturekit/tree-simple" position={[3.6, 0, 3.6]} rotationY={0.8} scale={1.3} />
      <Piece id="naturekit/bush" position={[-3.8, 0, 1.2]} scale={1.4} />
      <Piece id="naturekit/bush" position={[2.6, 0, 2.9]} rotationY={2.1} scale={1.2} />
      <Piece id="naturekit/rock-large-b" position={[-4.9, 0, 3.0]} scale={1.1} />
      <Piece id="naturekit/flower-yellow-b" position={[-1.9, 0.02, 1.7]} scale={1.3} />
      <Piece id="naturekit/flower-yellow-b" position={[2.4, 0.02, -0.9]} rotationY={1.3} scale={1.3} />
    </group>
  );
}

export default function TitleDiorama() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [8.5, 5.5, 10.5], fov: 38, near: 0.5, far: 60 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.4, 0)}
      className="pointer-events-none"
      aria-hidden
    >
      <color attach="background" args={["#bfdcf5"]} />
      <fog attach="fog" args={["#bfdcf5", 18, 42]} />
      <hemisphereLight args={["#dff0ff", "#7aa05f", 0.9]} />
      <directionalLight position={[6, 9, 4]} intensity={1.6} color="#fff2dc" />
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  );
}
