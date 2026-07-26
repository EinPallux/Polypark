"use client";

import { useEffect, useRef, type ComponentRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import { MOUSE, Vector3 } from "three";
import { CELL_SIZE_METERS } from "@/shared/grid";
import { type Terrain } from "@/sim/api";
import { useGame } from "@/ui/game/store";

/**
 * The RTS camera (UI_UX §8): LMB selects (never moves the camera), MMB pans,
 * RMB orbits, wheel zooms to cursor, WASD pans, Q/E rotate 45°, Home reframes
 * the gate. Target clamped to the site + margin; pitch 15°–70°.
 */
export function CameraRig({ terrain }: { terrain: Terrain }) {
  const controlsRef = useRef<ComponentRef<typeof MapControls>>(null);
  const keys = useRef(new Set<string>());
  const camera = useThree((state) => state.camera);

  // LMB must stay free for build/select input. OrbitControls disables a button
  // with null at runtime, but its types only admit MOUSE values.
  useEffect(() => {
    const controls = controlsRef.current;
    if (controls) {
      // why: null is the documented runtime way to disable a button; the type lags.
      controls.mouseButtons = {
        LEFT: null,
        MIDDLE: MOUSE.PAN,
        RIGHT: MOUSE.ROTATE,
      } as unknown as typeof controls.mouseButtons;
    }
  }, []);

  const site = terrain.site;
  const maxX = site.cells.w * CELL_SIZE_METERS;
  const maxZ = site.cells.d * CELL_SIZE_METERS;

  useEffect(() => {
    const down = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement) {
        return;
      }
      keys.current.add(event.code);
      if (event.code === "KeyQ" || event.code === "KeyE") {
        const controls = controlsRef.current;
        if (controls) {
          const angle = ((event.code === "KeyQ" ? 1 : -1) * Math.PI) / 4;
          const offset = new Vector3().subVectors(camera.position, controls.target);
          offset.applyAxisAngle(new Vector3(0, 1, 0), angle);
          camera.position.copy(controls.target).add(offset);
          controls.update();
        }
      }
      if (event.code === "Home") {
        const controls = controlsRef.current;
        if (controls) {
          const gateX = (site.gate.x + 0.5) * CELL_SIZE_METERS;
          const gateZ = (site.gate.z + 0.5) * CELL_SIZE_METERS;
          controls.target.set(gateX, terrain.heightAt(gateX, gateZ), gateZ - 10);
          camera.position.set(gateX, 26, gateZ + 26);
          controls.update();
        }
      }
    };
    const up = (event: KeyboardEvent): void => {
      keys.current.delete(event.code);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [camera, site, terrain]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }
    if (useGame.getState().menuOpen) {
      return;
    }
    // WASD pan in camera-forward space (flattened to the ground plane).
    const pressed = keys.current;
    const panX = (pressed.has("KeyD") ? 1 : 0) - (pressed.has("KeyA") ? 1 : 0);
    const panZ = (pressed.has("KeyS") ? 1 : 0) - (pressed.has("KeyW") ? 1 : 0);
    if (panX !== 0 || panZ !== 0) {
      const speed = 28 * delta * (camera.position.distanceTo(controls.target) / 40 + 0.4);
      const forward = new Vector3().subVectors(controls.target, camera.position);
      forward.y = 0;
      forward.normalize();
      const right = new Vector3(forward.z, 0, -forward.x);
      const move = new Vector3()
        .addScaledVector(forward, -panZ * speed)
        .addScaledVector(right, -panX * speed);
      controls.target.add(move);
      camera.position.add(move);
    }
    // Clamp the focus point to the site + a friendly margin.
    const margin = 24;
    controls.target.x = Math.min(Math.max(controls.target.x, -margin), maxX + margin);
    controls.target.z = Math.min(Math.max(controls.target.z, -margin), maxZ + margin);
    controls.target.y = terrain.heightAt(controls.target.x, controls.target.z);
    controls.update();
  });

  return (
    <MapControls
      ref={controlsRef}
      makeDefault
      target={[maxX / 2, 0, maxZ / 2 + 8]}
      enableDamping
      dampingFactor={0.12}
      zoomToCursor
      minDistance={9}
      maxDistance={170}
      minPolarAngle={(20 * Math.PI) / 180}
      maxPolarAngle={(75 * Math.PI) / 180}
      screenSpacePanning={false}
    />
  );
}
