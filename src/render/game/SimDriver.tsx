"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { createFixedStepper } from "@/sim/api";
import { useGame } from "@/ui/game/store";

/**
 * Drives the fixed-timestep sim from the render clock (TECH §4.1): real frame
 * delta → whole ticks at the selected speed. The menu pauses time. Snapshot
 * sync is throttled — React re-renders at ~5 Hz, not per frame.
 */
export function SimDriver() {
  const stepper = useMemo(() => createFixedStepper(), []);
  const sinceSync = useRef(0);

  useFrame((_, delta) => {
    const state = useGame.getState();
    const { facade } = state;
    if (!facade) {
      return;
    }
    const speed = state.menuOpen ? 0 : state.speed;
    const ticks = stepper.advance(Math.min(delta, 0.25) * 1000, speed);
    if (ticks > 0) {
      facade.advance(ticks);
    }
    sinceSync.current += delta;
    const versionChanged = state.worldVersion !== facade.worldVersion();
    if (versionChanged || (ticks > 0 && sinceSync.current > 0.2)) {
      sinceSync.current = 0;
      state.syncFromSim();
    }
  });

  return null;
}
