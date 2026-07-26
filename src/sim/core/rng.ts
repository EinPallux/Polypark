/**
 * The sim's named gameplay RNG streams (TECHNICAL_ARCHITECTURE §4.3): a single
 * root seed derives independent streams so adding a roll in one system never
 * reshuffles another. Primitives live in @/shared/rng.
 */
import { RngStream, type RngStreamState } from "@/shared/rng";

export { RngStream, fnv1a, type RngStreamState } from "@/shared/rng";

/** The named streams the sim owns. Add streams here — never share one across systems. */
export const RNG_STREAM_NAMES = ["guests", "events", "rides", "staff", "world"] as const;
export type RngStreamName = (typeof RNG_STREAM_NAMES)[number];

export type RngStreams = Record<RngStreamName, RngStream>;

export function createRngStreams(rootSeed: number): RngStreams {
  const streams = {} as Record<RngStreamName, RngStream>;
  for (const name of RNG_STREAM_NAMES) {
    streams[name] = RngStream.fromSeed(rootSeed, name);
  }
  return streams;
}

export function serializeRngStreams(streams: RngStreams): RngStreamState[] {
  return RNG_STREAM_NAMES.map((name) => streams[name].serialize());
}

export function deserializeRngStreams(saved: readonly RngStreamState[]): RngStreams {
  const streams = {} as Record<RngStreamName, RngStream>;
  for (const state of saved) {
    if ((RNG_STREAM_NAMES as readonly string[]).includes(state.name)) {
      streams[state.name as RngStreamName] = RngStream.fromState(state);
    }
  }
  for (const name of RNG_STREAM_NAMES) {
    if (!(name in streams)) {
      throw new Error(`Missing RNG stream "${name}" in save data`);
    }
  }
  return streams;
}
