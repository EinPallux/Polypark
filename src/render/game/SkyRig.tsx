"use client";

/* eslint-disable react-hooks/immutability --
   why: useFrame callbacks mutate three.js objects (lights, scene fog/background)
   imperatively by design — the standard R3F pattern the compiler lint can't model. */

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Fog, type DirectionalLight, type HemisphereLight } from "three";
import { GAME_SECONDS_PER_TICK } from "@/sim/api";
import { useGame } from "@/ui/game/store";

/**
 * Time-of-day lighting (GAME_DESIGN §16, TECH §6.4): the sim clock drives sun
 * position/color, sky/fog color and ambient balance. Imperative per-frame
 * updates — no React re-renders.
 */

/** Park opens at 09:00 on tick 0. */
export function hourFromTick(tick: number): number {
  return (9 + (tick * GAME_SECONDS_PER_TICK) / 3600) % 24;
}

interface SkyKey {
  readonly hour: number;
  readonly sky: Color;
  readonly sun: Color;
  readonly sunIntensity: number;
  readonly ambient: number;
}

const KEYS: SkyKey[] = [
  { hour: 0, sky: new Color("#1c2a45"), sun: new Color("#a9c1ff"), sunIntensity: 0.18, ambient: 0.32 },
  { hour: 5.5, sky: new Color("#28395c"), sun: new Color("#b8c8ff"), sunIntensity: 0.2, ambient: 0.34 },
  { hour: 7, sky: new Color("#f5c390"), sun: new Color("#ffc98a"), sunIntensity: 1.05, ambient: 0.5 },
  { hour: 10, sky: new Color("#bfdcf5"), sun: new Color("#fff2dc"), sunIntensity: 1.65, ambient: 0.62 },
  { hour: 15, sky: new Color("#b3d8f7"), sun: new Color("#fff6e6"), sunIntensity: 1.6, ambient: 0.62 },
  { hour: 18.5, sky: new Color("#f2a06a"), sun: new Color("#ffb46e"), sunIntensity: 1.0, ambient: 0.48 },
  { hour: 20.5, sky: new Color("#3c3a66"), sun: new Color("#c5b6ff"), sunIntensity: 0.28, ambient: 0.36 },
  { hour: 24, sky: new Color("#1c2a45"), sun: new Color("#a9c1ff"), sunIntensity: 0.18, ambient: 0.32 },
];

const scratchSky = new Color();
const scratchSun = new Color();

function sampleKeys(hour: number): { sky: Color; sun: Color; sunIntensity: number; ambient: number } {
  let previous = KEYS[0]!;
  for (const key of KEYS) {
    if (hour <= key.hour) {
      const span = key.hour - previous.hour || 1;
      const t = (hour - previous.hour) / span;
      return {
        sky: scratchSky.copy(previous.sky).lerp(key.sky, t),
        sun: scratchSun.copy(previous.sun).lerp(key.sun, t),
        sunIntensity: previous.sunIntensity + (key.sunIntensity - previous.sunIntensity) * t,
        ambient: previous.ambient + (key.ambient - previous.ambient) * t,
      };
    }
    previous = key;
  }
  return previous;
}

export function SkyRig({ center }: { center: readonly [number, number] }) {
  const sunRef = useRef<DirectionalLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const scene = useThree((state) => state.scene);

  useFrame(() => {
    const tick = useGame.getState().snapshot?.tick ?? 0;
    const hour = hourFromTick(tick);
    const sample = sampleKeys(hour);

    // Sun swings east→west 06:00→22:00; below ~10° it hands off to ambient.
    const dayT = Math.min(Math.max((hour - 6) / 16, 0), 1);
    const azimuth = Math.PI * (0.15 + 0.7 * dayT);
    const elevation = Math.max(Math.sin(Math.PI * dayT) * 1.05, 0.12);
    const radius = 140;
    const sun = sunRef.current;
    if (sun) {
      sun.position.set(
        center[0] + Math.cos(azimuth) * radius,
        elevation * radius * 0.8,
        center[1] + Math.sin(azimuth) * radius * 0.6,
      );
      sun.target.position.set(center[0], 0, center[1]);
      sun.target.updateMatrixWorld();
      sun.intensity = sample.sunIntensity;
      sun.color.copy(sample.sun);
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = sample.ambient;
    }
    if (scene.background instanceof Color) {
      scene.background.copy(sample.sky);
    } else {
      scene.background = sample.sky.clone();
    }
    if (scene.fog instanceof Fog) {
      scene.fog.color.copy(sample.sky);
    } else {
      scene.fog = new Fog(sample.sky.clone(), 90, 260);
    }
  });

  return (
    <>
      <directionalLight
        ref={sunRef}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-far={400}
        shadow-bias={-0.0004}
      />
      <hemisphereLight ref={hemiRef} args={["#dff0ff", "#6f9a58", 0.6]} />
    </>
  );
}
