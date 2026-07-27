/**
 * The sim's named gameplay RNG streams (TECHNICAL_ARCHITECTURE §4.3): a single
 * root seed derives independent streams so adding a roll in one system never
 * reshuffles another. Primitives live in @/shared/rng.
 */
import { RngStream, type RngStreamState } from "@/shared/rng";

export { RngStream, fnv1a, type RngStreamState } from "@/shared/rng";

/** The named streams the sim owns. Add streams here — never share one across systems. */
export const RNG_STREAM_NAMES = [
  "guests",
  "events",
  "rides",
  "staff",
  "weather",
  "world",
] as const;
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

/**
 * Restore streams from a save. A stream the save predates is derived fresh from
 * the root seed rather than throwing: a save written before a system existed
 * legitimately has no state for it, and deriving is exactly what a new park
 * does. That keeps "add a stream" from being a save-breaking change forever
 * after — the alternative is a migration per stream, which is churn for no
 * safety. Unknown stream names in the save are ignored.
 */
export function deserializeRngStreams(
  saved: readonly RngStreamState[],
  rootSeed: number,
): RngStreams {
  const streams = {} as Record<RngStreamName, RngStream>;
  for (const state of saved) {
    if ((RNG_STREAM_NAMES as readonly string[]).includes(state.name)) {
      streams[state.name as RngStreamName] = RngStream.fromState(state);
    }
  }
  for (const name of RNG_STREAM_NAMES) {
    if (!(name in streams)) {
      streams[name] = RngStream.fromSeed(rootSeed, name);
    }
  }
  return streams;
}
