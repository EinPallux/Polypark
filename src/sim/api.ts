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
export { createFixedStepper, TICKS_PER_SECOND, GAME_SECONDS_PER_TICK, type GameSpeed } from "./core/loop";

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
      // System order is fixed and versioned (TECH §4.1). Systems land M2+;
      // each appends its slice here, never reorders existing ones.
      for (let i = 0; i < ticks; i++) {
        state.tick += 1;
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
  };
}
