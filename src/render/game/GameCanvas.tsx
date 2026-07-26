"use client";

import { Suspense, useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { CELL_SIZE_METERS } from "@/shared/grid";
import { useGame } from "@/ui/game/store";
import { BuildOverlay } from "./BuildOverlay";
import { CameraRig } from "./CameraRig";
import { Guests } from "./Guests";
import { PlacedPieces } from "./PlacedPieces";
import { Scatter } from "./Scatter";
import { SimDriver } from "./SimDriver";
import { SkyRig } from "./SkyRig";
import { TerrainMesh } from "./TerrainMesh";
import { Water } from "./Water";

/** Mounts once the surrounding Suspense boundary resolves — flips the store flag. */
function SceneReadyFlag() {
  useEffect(() => {
    useGame.setState({ sceneReady: true });
    return () => {
      useGame.setState({ sceneReady: false });
    };
  }, []);
  return null;
}

/** The in-game 3D view: everything terrain-and-pieces, driven by the store. */
export function GameCanvas() {
  const facade = useGame((state) => state.facade);
  const catalog = useGame((state) => state.catalog);

  const fileForPiece = useCallback(
    (pieceId: string): string | null =>
      catalog?.pieces.find((piece) => piece.id === pieceId)?.file ?? null,
    [catalog],
  );

  if (!facade || !catalog) {
    return null;
  }
  const terrain = facade.terrain();
  const center: readonly [number, number] = [
    (terrain.site.cells.w * CELL_SIZE_METERS) / 2,
    (terrain.site.cells.d * CELL_SIZE_METERS) / 2,
  ];

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [center[0], 30, center[1] + 44], fov: 42, near: 0.5, far: 420 }}
      onPointerMissed={() => useGame.getState().clearHover()}
    >
      <SimDriver />
      <SkyRig center={center} />
      <CameraRig terrain={terrain} />
      {/* One boundary for the whole world. Keep TerrainMesh INSIDE it: as a
          frequently re-rendering store subscriber, hoisting it beside a pending
          sibling boundary starves the model loads' retry lanes indefinitely
          (observed under software GL; see M1 notes in CHANGELOG). */}
      <Suspense fallback={null}>
        <TerrainMesh terrain={terrain} />
        <Water terrain={terrain} />
        <Scatter terrain={terrain} fileForPiece={fileForPiece} />
        <PlacedPieces terrain={terrain} fileForPiece={fileForPiece} />
        <Guests terrain={terrain} />
        <BuildOverlay terrain={terrain} fileForPiece={fileForPiece} />
        <SceneReadyFlag />
      </Suspense>
    </Canvas>
  );
}
