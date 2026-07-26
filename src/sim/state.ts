import {
  createRngStreams,
  deserializeRngStreams,
  serializeRngStreams,
  type RngStreams,
  type RngStreamState,
} from "./core/rng";

/**
 * The whole mutable simulation state. M0 carries only the spine (tick, seed,
 * rng, park identity); systems land per ROADMAP M1+ and each adds its slice
 * here plus a save-schema field (src/save/schema.ts) in the same change.
 */
export interface SimState {
  tick: number;
  seed: number;
  parkName: string;
  rng: RngStreams;
}

/** The serializable snapshot of SimState — exactly what save files store. */
export interface SimStateSnapshot {
  readonly tick: number;
  readonly seed: number;
  readonly parkName: string;
  readonly rng: readonly RngStreamState[];
}

export function createInitialState(seed: number, parkName: string): SimState {
  return {
    tick: 0,
    seed,
    parkName,
    rng: createRngStreams(seed),
  };
}

export function snapshotState(state: SimState): SimStateSnapshot {
  return {
    tick: state.tick,
    seed: state.seed,
    parkName: state.parkName,
    rng: serializeRngStreams(state.rng),
  };
}

export function restoreState(snapshot: SimStateSnapshot): SimState {
  return {
    tick: snapshot.tick,
    seed: snapshot.seed,
    parkName: snapshot.parkName,
    rng: deserializeRngStreams(snapshot.rng),
  };
}
