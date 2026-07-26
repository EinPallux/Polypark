/**
 * SimFacade — the ONLY surface render/ui/app may import from the simulation
 * (TECHNICAL_ARCHITECTURE §3, enforced by ESLint + dependency-cruiser).
 *
 * The interface is message-shaped on purpose: commands/queries in, snapshots
 * and event batches out, so moving the sim into a Web Worker (TECH §4.4) is a
 * transport change, not a redesign.
 */
import { type SimPieceDef } from "@/content/costs";
import { type SiteDescriptor } from "@/content/sites/types";
import { createCommandBus, type Command, type CommandResult } from "./core/commands";
import { createEventCollector, type SimEvent } from "./core/events";
import { stateHash } from "./core/hash";
import {
  createInitialState,
  restoreState,
  snapshotState,
  type SimStateSnapshot,
} from "./state";
import {
  guestNeedsSnapshot,
  liveGuestCount,
  moodOf,
  tickGuests,
  type GuestSoA,
} from "./guests/guests";
import { tickJanitors } from "./staff/janitors";
import { goalProgress, levelForXp, tickGoals, type GoalProgress } from "./goals/goals";
import { tickLedger } from "./economy/ledger";
import {
  checkPaintPath,
  checkPlace,
  resolveAllPathTiles,
  type PlaceCheck,
  type PlacedPiece,
  type ResolvedPathTile,
  type Rotation,
} from "./world/world";
import { type Terrain } from "./world/terrain";

export type {
  Command,
  CommandResult,
  SimEvent,
  SimStateSnapshot,
  PlaceCheck,
  PlacedPiece,
  ResolvedPathTile,
  Rotation,
  Terrain,
};
export {
  createFixedStepper,
  TICKS_PER_SECOND,
  TICKS_PER_GAME_MONTH,
  GAME_SECONDS_PER_TICK,
  type FixedStepper,
  type GameSpeed,
} from "./core/loop";
export { type MonthlyReport } from "./economy/ledger";
export { EMOTE, GUEST_STATE } from "./guests/guests";

/** Live read-only views into the guest SoA for the crowd renderer (zero-copy). */
export interface GuestRenderView {
  readonly count: number;
  readonly state: Uint8Array;
  readonly variant: Uint8Array;
  readonly emote: Uint8Array;
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly px: Float32Array;
  readonly pz: Float32Array;
}

export interface HudView {
  readonly tick: number;
  readonly money: number;
  readonly parkName: string;
  readonly parkOpen: boolean;
  readonly entryFeeCents: number;
  readonly guestCount: number;
  readonly janitorCount: number;
  readonly litterCount: number;
  readonly xp: number;
  readonly level: number;
  readonly goals: readonly GoalProgress[];
}

export interface SimFacade {
  advance(ticks: number): void;
  dispatch(command: Command): CommandResult;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  snapshot(): SimStateSnapshot;
  drainEvents(): SimEvent[];
  hash(): string;
  /** Monotonic counter bumped by every successful world mutation — render memo key. */
  worldVersion(): number;
  /** Read-only terrain view (static per site — safe to hold). */
  terrain(): Terrain;
  checkPlace(pieceId: string, x: number, z: number, rot: Rotation): PlaceCheck;
  checkPaintPath(x: number, z: number): PlaceCheck;
  pathTiles(): ResolvedPathTile[];
  placedPieces(): PlacedPiece[];
  hud(): HudView;
  guestView(): GuestRenderView;
  guestInfo(slot: number): ReturnType<typeof guestNeedsSnapshot> | null;
}

export interface CreateSimOptions {
  readonly seed: number;
  readonly parkName?: string;
  readonly site: SiteDescriptor;
  readonly pieceDefs: readonly SimPieceDef[];
  readonly resumeFrom?: SimStateSnapshot;
}

export function createSim(options: CreateSimOptions): SimFacade {
  const state = options.resumeFrom
    ? restoreState(options.resumeFrom, options.site, options.pieceDefs)
    : createInitialState(
        options.seed,
        options.parkName ?? "My Polypark",
        options.site,
        options.pieceDefs,
      );
  const bus = createCommandBus();
  const events = createEventCollector();
  let version = 1;

  events.emit({ type: "sim/started", seed: state.seed });

  const bumpOnBuild = (command: Command, ok: boolean): void => {
    if (ok && command.type.startsWith("build/")) {
      version += 1;
    }
  };

  return {
    advance(ticks: number): void {
      // System order is fixed and versioned (TECH §4.1): guests → staff →
      // goals → ledger. New systems append, never reorder.
      for (let i = 0; i < ticks; i++) {
        state.tick += 1;
        tickGuests(state);
        tickJanitors(state);
        for (const done of tickGoals(state)) {
          const before = levelForXp(state.xp);
          state.xp += done.rewardXp;
          events.emit({ type: "goal/completed", cardId: done.cardId, rewardXp: done.rewardXp });
          const after = levelForXp(state.xp);
          if (after > before) {
            events.emit({ type: "park/levelUp", level: after });
          }
        }
        const report = tickLedger(state);
        if (report) {
          events.emit({ type: "park/monthReport", report });
        }
      }
    },
    dispatch(command: Command): CommandResult {
      const result = bus.dispatch(state, command);
      bumpOnBuild(command, result.ok);
      if (result.ok && command.type === "park/rename") {
        events.emit({ type: "park/renamed", name: state.parkName });
      }
      return result;
    },
    undo(): boolean {
      const done = bus.undo(state);
      if (done) {
        version += 1;
      }
      return done;
    },
    redo(): boolean {
      const done = bus.redo(state);
      if (done) {
        version += 1;
      }
      return done;
    },
    canUndo: () => bus.canUndo(),
    canRedo: () => bus.canRedo(),
    snapshot: () => snapshotState(state),
    drainEvents: () => events.drain(),
    hash: () => stateHash(snapshotState(state)),
    worldVersion: () => version,
    terrain: () => state.world.terrain,
    checkPlace: (pieceId, x, z, rot) => checkPlace(state.world, pieceId, x, z, rot),
    checkPaintPath: (x, z) => checkPaintPath(state.world, x, z),
    pathTiles: () => resolveAllPathTiles(state.world),
    placedPieces: () => [...state.world.placed.values()],
    hud: () => ({
      tick: state.tick,
      money: state.money,
      parkName: state.parkName,
      parkOpen: state.parkOpen,
      entryFeeCents: state.entryFeeCents,
      guestCount: liveGuestCount(state.guests),
      janitorCount: state.janitors.length,
      litterCount: state.litter.length,
      xp: state.xp,
      level: levelForXp(state.xp),
      goals: goalProgress(state),
    }),
    guestView: () => ({
      count: state.guests.count,
      state: state.guests.state,
      variant: state.guests.variant,
      emote: state.guests.emote,
      x: state.guests.x,
      z: state.guests.z,
      px: state.guests.px,
      pz: state.guests.pz,
    }),
    guestInfo: (slot: number) => {
      const g: GuestSoA = state.guests;
      if (slot < 0 || slot >= g.count || g.state[slot] === 0) {
        return null;
      }
      void moodOf; // (kept in the facade surface via guestNeedsSnapshot)
      return guestNeedsSnapshot(g, slot);
    },
  };
}
