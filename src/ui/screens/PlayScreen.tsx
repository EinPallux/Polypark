"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { t } from "@/ui/i18n/t";
import { BuildPalette } from "@/ui/game/BuildPalette";
import { Hud } from "@/ui/game/Hud";
import { PauseMenu } from "@/ui/game/PauseMenu";
import { useGame } from "@/ui/game/store";

const GameCanvas = dynamic(
  () => import("@/render/game/GameCanvas").then((module) => module.GameCanvas),
  { ssr: false, loading: () => null },
);

/** Invisible DOM signal that the 3D scene finished loading (Playwright hook). */
function SceneReadyMarker() {
  const sceneReady = useGame((state) => state.sceneReady);
  return sceneReady ? <div data-testid="scene-ready" hidden /> : null;
}

/** Autosave cadence in real milliseconds (quiet; manual save is in the pause menu). */
const AUTOSAVE_MS = 90_000;

function PlayInner() {
  const params = useSearchParams();
  const fresh = params.get("new") === "1";
  const bench = Number(params.get("bench") ?? 0);
  const boot = useGame((state) => state.boot);
  const bootError = useGame((state) => state.bootError);
  const ready = useGame((state) => state.facade !== null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    void boot({ fresh: fresh || bench > 0, ...(bench > 0 ? { bench } : {}) });
  }, [boot, fresh, bench]);

  // Global shortcuts: ESC (close layers → menu), R rotate, space pause, 1/2/3 speeds, Ctrl+Z/Y.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const state = useGame.getState();
      if (event.key === "Escape") {
        if (paletteOpen) {
          setPaletteOpen(false);
        } else if (state.buildMode.kind !== "inspect") {
          state.setBuildMode({ kind: "inspect" });
        } else {
          state.setMenuOpen(!state.menuOpen);
        }
      } else if (event.key === "r" || event.key === "R") {
        state.rotate();
        if (state.hover) {
          state.hoverCell(state.hover.x, state.hover.z);
        }
      } else if (event.key === " ") {
        event.preventDefault();
        state.setSpeed(state.speed === 0 ? 1 : 0);
      } else if (event.key === "1") {
        state.setSpeed(1);
      } else if (event.key === "2") {
        state.setSpeed(2);
      } else if (event.key === "3") {
        state.setSpeed(4);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          state.redo();
        } else {
          state.undo();
        }
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        state.redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paletteOpen]);

  // Quiet autosave + save on tab hide (GAME_DESIGN §21 idle-positive promise).
  // Bench runs never autosave — they must not clobber the player's park.
  useEffect(() => {
    if (!ready || bench > 0) {
      return;
    }
    const interval = setInterval(() => void useGame.getState().save(), AUTOSAVE_MS);
    const onHide = (): void => {
      if (document.visibilityState === "hidden") {
        void useGame.getState().save();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [ready, bench]);

  if (bootError) {
    return (
      <main className="facet-bg flex h-dvh items-center justify-center">
        <p className="max-w-md text-center font-ui text-lg font-semibold text-danger-500">
          {t("play.error", { message: bootError })}
        </p>
      </main>
    );
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-[#bfdcf5]">
      <div className="absolute inset-0">
        <GameCanvas />
      </div>
      <SceneReadyMarker />
      {!ready ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink-900/40">
          <p className="skew-ui font-display text-2xl text-white uppercase">{t("play.loading")}</p>
        </div>
      ) : null}
      <Hud onOpenPalette={() => setPaletteOpen(true)} />
      <BuildPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <PauseMenu />
    </main>
  );
}

export function PlayScreen() {
  return (
    <Suspense fallback={null}>
      <PlayInner />
    </Suspense>
  );
}
