"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { APP_VERSION } from "@/shared/version";
import { parseCatalog, type Catalog } from "@/content/schema";
import { toSimPieceDefs } from "@/content/costs";
import { SITES, MEADOWBROOK } from "@/content/sites/meadowbrook";
import {
  createSim,
  type GameSpeed,
  type Rotation,
  type SimFacade,
  type SimStateSnapshot,
} from "@/sim/api";
import { readSlot, writeSlot, requestPersistence, type SlotMeta } from "@/save/store";
import { type SaveFile } from "@/save/schema";
import { t } from "@/ui/i18n/t";

/**
 * The play-session store: owns the SimFacade, mirrors its snapshot for React,
 * and holds all transient UI state (build mode, hover, toasts). The sim is
 * mutated ONLY through facade commands dispatched from here.
 */

export type BuildMode =
  | { readonly kind: "inspect" }
  | { readonly kind: "place"; readonly pieceId: string }
  | { readonly kind: "path" }
  | { readonly kind: "bulldoze" };

export interface Toast {
  readonly id: number;
  readonly tone: "good" | "bad" | "neutral";
  readonly text: string;
}

export interface HoverCell {
  readonly x: number;
  readonly z: number;
  readonly valid: boolean;
  readonly reason?: string;
}

export const QUICKSLOT = "park-1";

interface GameState {
  facade: SimFacade | null;
  snapshot: SimStateSnapshot | null;
  worldVersion: number;
  catalog: Catalog | null;
  speed: GameSpeed;
  buildMode: BuildMode;
  rotation: Rotation;
  hover: HoverCell | null;
  pathDrag: { x: number; z: number }[] | null;
  menuOpen: boolean;
  lastSaveMeta: SlotMeta | null;
  bootError: string | null;
  /** True once the 3D scene's model Suspense has resolved (e2e readiness). */
  sceneReady: boolean;

  boot: (options: { fresh: boolean; bench?: number }) => Promise<void>;
  syncFromSim: () => void;
  setSpeed: (speed: GameSpeed) => void;
  setBuildMode: (mode: BuildMode) => void;
  rotate: () => void;
  setMenuOpen: (open: boolean) => void;
  hoverCell: (x: number, z: number) => void;
  clearHover: () => void;
  pressCell: (x: number, z: number) => void;
  dragCell: (x: number, z: number) => void;
  releasePointer: () => void;
  undo: () => void;
  redo: () => void;
  save: () => Promise<void>;
  pushToast: (tone: Toast["tone"], text: string) => void;
  toasts: Toast[];
}

let toastId = 0;

const DENIAL_TEXT: Record<string, string> = {
  "out-of-bounds": t("play.deny.bounds"),
  occupied: t("play.deny.occupied"),
  water: t("play.deny.water"),
  "too-steep": t("play.deny.steep"),
  "not-enough-money": t("play.deny.money"),
};

export const useGame = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    facade: null,
    snapshot: null,
    worldVersion: 0,
    catalog: null,
    speed: 1,
    buildMode: { kind: "inspect" },
    rotation: 0,
    hover: null,
    pathDrag: null,
    menuOpen: false,
    lastSaveMeta: null,
    bootError: null,
    sceneReady: false,
    toasts: [],

    async boot({ fresh, bench }) {
      try {
        const response = await fetch("/content/catalog.json");
        const catalog = parseCatalog(await response.json());
        const pieceDefs = toSimPieceDefs(catalog.pieces);

        let resume: SaveFile | null = null;
        if (!fresh) {
          resume = await readSlot(QUICKSLOT).catch(() => null);
        }
        const site = resume ? (SITES[resume.sim.world.siteId] ?? MEADOWBROOK) : MEADOWBROOK;
        const facade = createSim({
          seed: resume ? resume.sim.seed : (Date.now() ^ (Math.random() * 0xffff)) | 0,
          parkName: t("play.defaultParkName"),
          site,
          pieceDefs,
          ...(resume ? { resumeFrom: resume.sim } : {}),
        });
        // Perf harness (ROADMAP M1 acceptance): ?bench=N fills the site with
        // free random scenery so any machine can load-test the renderer.
        if (bench && bench > 0) {
          const site = facade.terrain().site;
          const sceneryIds = pieceDefs
            .filter((piece) => piece.category === "scenery")
            .map((piece) => piece.id);
          let placed = 0;
          for (let attempt = 0; attempt < bench * 8 && placed < bench; attempt++) {
            const result = facade.dispatch({
              type: "build/place",
              pieceId: sceneryIds[attempt % sceneryIds.length] ?? "",
              x: (attempt * 7919) % site.cells.w,
              z: Math.floor((attempt * 104729) / site.cells.w) % site.cells.d,
              rot: (attempt % 4) as 0 | 1 | 2 | 3,
              forceCostCents: 0,
            });
            if (result.ok) {
              placed += 1;
            }
          }
        }
        requestPersistence();
        set({
          facade,
          catalog,
          snapshot: facade.snapshot(),
          worldVersion: facade.worldVersion(),
          bootError: null,
        });
      } catch (error) {
        set({ bootError: error instanceof Error ? error.message : String(error) });
      }
    },

    syncFromSim() {
      const { facade } = get();
      if (!facade) {
        return;
      }
      set({ snapshot: facade.snapshot(), worldVersion: facade.worldVersion() });
    },

    setSpeed(speed) {
      set({ speed });
    },

    setBuildMode(buildMode) {
      set({ buildMode, hover: null, pathDrag: null });
    },

    rotate() {
      set((state) => ({ rotation: ((state.rotation + 1) % 4) as Rotation }));
    },

    setMenuOpen(menuOpen) {
      set({ menuOpen });
    },

    hoverCell(x, z) {
      const { facade, buildMode, rotation } = get();
      if (!facade) {
        return;
      }
      if (buildMode.kind === "place") {
        const check = facade.checkPlace(buildMode.pieceId, x, z, rotation);
        set({
          hover: {
            x,
            z,
            valid: check.ok,
            ...(check.reason ? { reason: DENIAL_TEXT[check.reason] ?? check.reason } : {}),
          },
        });
      } else if (buildMode.kind === "path") {
        const check = facade.checkPaintPath(x, z);
        set({ hover: { x, z, valid: check.ok } });
      } else if (buildMode.kind === "bulldoze") {
        set({ hover: { x, z, valid: true } });
      } else {
        set({ hover: { x, z, valid: true } });
      }
    },

    clearHover() {
      set({ hover: null });
    },

    pressCell(x, z) {
      const state = get();
      const { facade, buildMode, rotation } = state;
      if (!facade || state.menuOpen) {
        return;
      }
      if (buildMode.kind === "place") {
        const result = facade.dispatch({
          type: "build/place",
          pieceId: buildMode.pieceId,
          x,
          z,
          rot: rotation,
        });
        if (!result.ok) {
          state.pushToast("bad", DENIAL_TEXT[result.reason] ?? t("play.deny.generic"));
        }
        state.syncFromSim();
        state.hoverCell(x, z);
      } else if (buildMode.kind === "path") {
        set({ pathDrag: [{ x, z }] });
      } else if (buildMode.kind === "bulldoze") {
        const occupant = facade.placedPieces().find((piece) => {
          return piece.x === x && piece.z === z; // 1×1 M1 pieces; footprint-aware pass in M3
        });
        if (occupant) {
          facade.dispatch({ type: "build/remove", id: occupant.id, refund: "bulldoze" });
        } else {
          facade.dispatch({ type: "build/erasePath", cells: [{ x, z }] });
        }
        state.syncFromSim();
      }
    },

    dragCell(x, z) {
      const { pathDrag, buildMode, facade } = get();
      if (buildMode.kind === "path" && pathDrag && facade) {
        const last = pathDrag[pathDrag.length - 1];
        if (!last || last.x !== x || last.z !== z) {
          set({ pathDrag: [...pathDrag, { x, z }] });
        }
      } else if (buildMode.kind === "bulldoze" && facade) {
        get().pressCell(x, z);
      }
    },

    releasePointer() {
      const state = get();
      const { pathDrag, facade } = state;
      if (pathDrag && facade && pathDrag.length > 0) {
        const result = facade.dispatch({ type: "build/paintPath", cells: pathDrag });
        if (!result.ok && result.reason === "not-enough-money") {
          state.pushToast("bad", DENIAL_TEXT["not-enough-money"] ?? "");
        }
        state.syncFromSim();
      }
      set({ pathDrag: null });
    },

    undo() {
      const { facade } = get();
      if (facade?.undo()) {
        get().syncFromSim();
      }
    },

    redo() {
      const { facade } = get();
      if (facade?.redo()) {
        get().syncFromSim();
      }
    },

    async save() {
      const { facade } = get();
      if (!facade) {
        return;
      }
      const snapshot = facade.snapshot();
      const save: SaveFile = {
        formatVersion: 2,
        appVersion: APP_VERSION,
        meta: { name: snapshot.parkName, savedAtIso: new Date().toISOString() },
        sim: snapshot as SaveFile["sim"],
      };
      const meta = await writeSlot(QUICKSLOT, save);
      set({ lastSaveMeta: meta });
      get().pushToast("good", t("play.saved"));
    },

    pushToast(tone, text) {
      toastId += 1;
      const toast = { id: toastId, tone, text };
      set((state) => ({ toasts: [...state.toasts.slice(-3), toast] }));
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((candidate) => candidate.id !== toast.id) }));
      }, 6000);
    },
  })),
);
