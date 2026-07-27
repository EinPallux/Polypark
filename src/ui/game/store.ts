"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { APP_VERSION } from "@/shared/version";
import { parseCatalog, type Catalog } from "@/content/schema";
import { toSimPieceDefs } from "@/content/costs";
import { SITES, MEADOWBROOK } from "@/content/sites/meadowbrook";
import {
  createFixedStepper,
  createSim,
  type FinanceView,
  type FixedStepper,
  type FlatRideView,
  type GameSpeed,
  type HudView,
  type MonthlyReport,
  type RatingView,
  type WeatherView,
  type Rotation,
  type SimFacade,
  type SimStateSnapshot,
  type TrackedRideView,
} from "@/sim/api";
import { readSlot, writeSlot, requestPersistence, type SlotMeta } from "@/save/store";
import { type FlatRideId } from "@/content/rides";
import { type LoanProductId } from "@/content/loans";
import { type MarketingCampaignId } from "@/content/marketing";
import { type TrackFamilyId, type TrackKind } from "@/content/track";
import { SAVE_FORMAT_VERSION, type SaveFile } from "@/save/schema";
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
  | { readonly kind: "bulldoze" }
  | { readonly kind: "place-ride"; readonly defId: FlatRideId }
  /** Track builder: rideId null = choosing the station spot; set = appending. */
  | { readonly kind: "track"; readonly family: TrackFamilyId; readonly rideId: number | null };

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
  hud: HudView | null;
  rides: { tracked: TrackedRideView[]; flat: FlatRideView[] } | null;
  finance: FinanceView | null;
  rating: RatingView | null;
  weather: WeatherView | null;
  selectedRide: number | null;
  rideAlong: number | null;
  stepper: FixedStepper;
  selectedGuest: number | null;
  monthReport: MonthlyReport | null;
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
  setParkOpen: (open: boolean) => void;
  setEntryFee: (cents: number) => void;
  hireJanitor: () => void;
  fireJanitor: () => void;
  hireMechanic: () => void;
  fireMechanic: () => void;
  takeLoan: (product: LoanProductId) => void;
  payLoan: (loanId: number, amount: number | "payoff") => void;
  startCampaign: (campaign: MarketingCampaignId) => void;
  appendTrackPiece: (kind: TrackKind, flipped: boolean) => void;
  popTrackPiece: () => void;
  setRideState: (key: number, to: "closed" | "testing" | "open") => void;
  setRidePrice: (key: number, cents: number) => void;
  demolishRide: (key: number) => void;
  selectRide: (key: number | null) => void;
  setRideAlong: (key: number | null) => void;
  dismissGoal: (cardId: string) => void;
  selectGuest: (slot: number | null) => void;
  closeReport: () => void;
  /** Drain sim events into toasts/report state — called from syncFromSim. */
  handleEvents: () => void;
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
    hud: null,
    rides: null,
    finance: null,
    rating: null,
    weather: null,
    selectedRide: null,
    rideAlong: null,
    stepper: createFixedStepper(),
    selectedGuest: null,
    monthReport: null,
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
          // why: zod validated the payload at decode; the remaining gap is
          // readonly-tuple variance between the schema type and the snapshot.
          ...(resume ? { resumeFrom: resume.sim as unknown as SimStateSnapshot } : {}),
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
      // HUD reads the light view every sync; the full (guest-array) snapshot
      // only refreshes when the world changed — saves rebuild it themselves.
      const worldVersion = facade.worldVersion();
      set((current) => ({
        hud: facade.hud(),
        rides: facade.ridesView(),
        finance: facade.finance(),
        rating: facade.rating(),
        weather: facade.weather(),
        worldVersion,
        ...(current.worldVersion !== worldVersion ? { snapshot: facade.snapshot() } : {}),
      }));
      get().handleEvents();
    },

    handleEvents() {
      const { facade } = get();
      if (!facade) {
        return;
      }
      for (const event of facade.drainEvents()) {
        if (event.type === "goal/completed") {
          get().pushToast(
            "good",
            t("goal.completedToast", { title: t(`goal.${event.cardId}` as never), xp: event.rewardXp }),
          );
        } else if (event.type === "park/levelUp") {
          get().pushToast("good", t("play.levelUp", { level: event.level }));
        } else if (event.type === "park/monthReport") {
          set({ monthReport: event.report });
        } else if (event.type === "ride/broke") {
          get().pushToast("bad", t("ride.brokeToast"));
        } else if (event.type === "ride/repaired") {
          get().pushToast("good", t("ride.repairedToast"));
        } else if (event.type === "ride/testPassed") {
          get().pushToast("good", t("ride.testPassedToast"));
        } else if (event.type === "weather/changed") {
          // A storm that silently shuts the coasters would read as a bug, so
          // the closure (and the reopening) is always spoken aloud.
          if (event.weather === "storm" && event.ridesClosed > 0) {
            get().pushToast("bad", t("weather.stormClosedRides", { count: event.ridesClosed }));
          } else if (event.ridesClosed > 0) {
            get().pushToast("good", t("weather.stormPassedRides", { count: event.ridesClosed }));
          } else {
            get().pushToast(
              event.weather === "storm" || event.weather === "rain" ? "bad" : "neutral",
              t("weather.changedToast", { weather: t(`weather.${event.weather}` as never) }),
            );
          }
        }
      }
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
      } else if (buildMode.kind === "track" && buildMode.rideId === null) {
        const reason = facade.checkStartTrack(buildMode.family, x * 2 + 1, z * 2, rotation);
        set({
          hover: {
            x,
            z,
            valid: reason === null,
            ...(reason ? { reason: DENIAL_TEXT[reason] ?? reason } : {}),
          },
        });
      } else if (buildMode.kind === "place-ride") {
        set({ hover: { x, z, valid: true } });
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
      } else if (buildMode.kind === "place-ride") {
        const result = facade.dispatch({
          type: "build/placeFlatRide",
          defId: buildMode.defId,
          x,
          z,
          rot: rotation,
        });
        if (!result.ok) {
          state.pushToast("bad", DENIAL_TEXT[result.reason] ?? t("play.deny.generic"));
        } else {
          set({ buildMode: { kind: "inspect" } });
        }
        state.syncFromSim();
      } else if (buildMode.kind === "track" && buildMode.rideId === null) {
        const result = facade.dispatch({
          type: "ride/startTrack",
          family: buildMode.family,
          mx: x * 2 + 1,
          mz: z * 2,
          heading: rotation,
        });
        if (!result.ok) {
          state.pushToast("bad", DENIAL_TEXT[result.reason] ?? t("play.deny.generic"));
        } else {
          const rides = facade.ridesView().tracked;
          const newest = rides[rides.length - 1];
          if (newest) {
            set({
              buildMode: { kind: "track", family: buildMode.family, rideId: newest.key },
              selectedRide: newest.key,
            });
          }
        }
        state.syncFromSim();
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
        formatVersion: SAVE_FORMAT_VERSION,
        appVersion: APP_VERSION,
        meta: { name: snapshot.parkName, savedAtIso: new Date().toISOString() },
        // why: see resumeFrom above — validated at encode by SaveFileSchema.
        sim: snapshot as unknown as SaveFile["sim"],
      };
      const meta = await writeSlot(QUICKSLOT, save);
      set({ lastSaveMeta: meta });
      get().pushToast("good", t("play.saved"));
    },

    setParkOpen(open) {
      get().facade?.dispatch({ type: "park/setOpen", open });
      get().syncFromSim();
    },
    setEntryFee(cents) {
      get().facade?.dispatch({ type: "park/setEntryFee", cents });
      get().syncFromSim();
    },
    hireJanitor() {
      const result = get().facade?.dispatch({ type: "staff/hireJanitor" });
      if (result && !result.ok && result.reason === "not-enough-money") {
        get().pushToast("bad", t("play.deny.money"));
      }
      get().syncFromSim();
    },
    fireJanitor() {
      get().facade?.dispatch({ type: "staff/fireJanitor" });
      get().syncFromSim();
    },
    takeLoan(product) {
      const result = get().facade?.dispatch({ type: "finance/takeLoan", product });
      if (result && !result.ok) {
        get().pushToast("bad", t("manage.loanRefused"));
      } else {
        get().pushToast("good", t("manage.loanTakenToast"));
      }
      get().syncFromSim();
    },
    payLoan(loanId, amount) {
      const result = get().facade?.dispatch({ type: "finance/payLoan", loanId, amount });
      if (result && !result.ok && result.reason === "not-enough-money") {
        get().pushToast("bad", t("play.deny.money"));
      }
      get().syncFromSim();
    },
    startCampaign(campaign) {
      const result = get().facade?.dispatch({ type: "marketing/start", campaign });
      if (result && !result.ok) {
        get().pushToast("bad", t("play.deny.money"));
      }
      get().syncFromSim();
    },
    hireMechanic() {
      const result = get().facade?.dispatch({ type: "staff/hireMechanic" });
      if (result && !result.ok && result.reason === "not-enough-money") {
        get().pushToast("bad", t("play.deny.money"));
      }
      get().syncFromSim();
    },
    fireMechanic() {
      get().facade?.dispatch({ type: "staff/fireMechanic" });
      get().syncFromSim();
    },
    appendTrackPiece(kind, flipped) {
      const state = get();
      const { facade, buildMode } = state;
      if (!facade || buildMode.kind !== "track" || buildMode.rideId === null) {
        return;
      }
      const result = facade.dispatch({
        type: "ride/appendPiece",
        rideId: buildMode.rideId,
        kind,
        flipped,
      });
      if (!result.ok) {
        state.pushToast("bad", DENIAL_TEXT[result.reason] ?? t("ride.deny.append"));
      }
      state.syncFromSim();
    },
    popTrackPiece() {
      const state = get();
      const { facade, buildMode } = state;
      if (!facade || buildMode.kind !== "track" || buildMode.rideId === null) {
        return;
      }
      facade.dispatch({ type: "ride/popPiece", rideId: buildMode.rideId });
      state.syncFromSim();
    },
    setRideState(key, to) {
      const state = get();
      const result = state.facade?.dispatch({ type: "ride/setState", rideId: key, to });
      if (result && !result.ok) {
        state.pushToast("bad", t("ride.deny.state"));
      }
      state.syncFromSim();
    },
    setRidePrice(key, cents) {
      get().facade?.dispatch({ type: "ride/setPrice", rideId: key, cents });
      get().syncFromSim();
    },
    demolishRide(key) {
      const state = get();
      if (!state.facade) {
        return;
      }
      if (key > 0) {
        state.facade.dispatch({ type: "ride/demolish", rideId: key });
      } else {
        state.facade.dispatch({ type: "build/removeFlatRide", id: -key, refund: "bulldoze" });
      }
      set({
        selectedRide: null,
        ...(state.buildMode.kind === "track" ? { buildMode: { kind: "inspect" as const } } : {}),
      });
      state.syncFromSim();
    },
    selectRide(key) {
      set({ selectedRide: key });
    },
    setRideAlong(key) {
      set({ rideAlong: key });
    },
    dismissGoal(cardId) {
      get().facade?.dispatch({ type: "goal/dismiss", cardId });
      get().syncFromSim();
    },
    selectGuest(slot) {
      set({ selectedGuest: slot });
    },
    closeReport() {
      set({ monthReport: null });
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
