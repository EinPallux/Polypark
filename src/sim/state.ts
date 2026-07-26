import { money, type Money } from "@/shared/money";
import { type SimPieceDef } from "@/content/costs";
import { type SiteDescriptor } from "@/content/sites/types";
import {
  createRngStreams,
  deserializeRngStreams,
  serializeRngStreams,
  type RngStreams,
  type RngStreamState,
} from "./core/rng";
import {
  cellIndex,
  createWorld,
  footprintCells,
  PATH_OCCUPANT,
  type PlacedPiece,
  type WorldState,
} from "./world/world";

/**
 * The whole mutable simulation state. Each milestone adds its slice here plus
 * a save-schema field (src/save/schema.ts) in the same change, guarded by the
 * round-trip test.
 */
export interface SimState {
  tick: number;
  seed: number;
  parkName: string;
  money: Money;
  rng: RngStreams;
  world: WorldState;
}

/** The serializable snapshot of SimState — exactly what save files store. */
export interface SimStateSnapshot {
  readonly tick: number;
  readonly seed: number;
  readonly parkName: string;
  readonly money: number;
  readonly rng: readonly RngStreamState[];
  readonly world: {
    readonly siteId: string;
    readonly nextInstanceId: number;
    readonly placed: readonly PlacedPiece[];
    readonly pathCells: readonly number[];
  };
}

export const STARTING_MONEY: Money = money(75_000_00); // sandbox default, GAME_BALANCE §3.1

export function createInitialState(
  seed: number,
  parkName: string,
  site: SiteDescriptor,
  pieceDefs: readonly SimPieceDef[],
): SimState {
  return {
    tick: 0,
    seed,
    parkName,
    money: STARTING_MONEY,
    rng: createRngStreams(seed),
    world: createWorld(site, pieceDefs),
  };
}

export function snapshotState(state: SimState): SimStateSnapshot {
  return {
    tick: state.tick,
    seed: state.seed,
    parkName: state.parkName,
    money: state.money,
    rng: serializeRngStreams(state.rng),
    world: {
      siteId: state.world.siteId,
      nextInstanceId: state.world.nextInstanceId,
      placed: [...state.world.placed.values()].sort((a, b) => a.id - b.id),
      pathCells: [...state.world.pathCells],
    },
  };
}

export function restoreState(
  snapshot: SimStateSnapshot,
  site: SiteDescriptor,
  pieceDefs: readonly SimPieceDef[],
): SimState {
  if (snapshot.world.siteId !== site.id) {
    throw new Error(`Save is for site "${snapshot.world.siteId}", got "${site.id}"`);
  }
  const world = createWorld(site, pieceDefs);
  world.nextInstanceId = snapshot.world.nextInstanceId;
  const copyLength = Math.min(world.pathCells.length, snapshot.world.pathCells.length);
  for (let i = 0; i < copyLength; i++) {
    const value = snapshot.world.pathCells[i] ?? 0;
    world.pathCells[i] = value;
    if (value === 1) {
      world.occupancy[i] = PATH_OCCUPANT;
    }
  }
  for (const piece of snapshot.world.placed) {
    world.placed.set(piece.id, piece);
    const def = world.pieces.get(piece.pieceId);
    if (def) {
      for (const cell of footprintCells(def, piece.x, piece.z, piece.rot)) {
        world.occupancy[cellIndex(world, cell.x, cell.z)] = piece.id;
      }
    }
  }
  return {
    tick: snapshot.tick,
    seed: snapshot.seed,
    parkName: snapshot.parkName,
    money: money(snapshot.money),
    rng: deserializeRngStreams(snapshot.rng),
    world,
  };
}
