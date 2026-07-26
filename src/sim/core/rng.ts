/**
 * Deterministic RNG for the simulation (TECHNICAL_ARCHITECTURE §4.3).
 *
 * A single root seed derives named, independent streams (guests, events, …) so
 * that adding a roll in one system never reshuffles another. Streams serialize
 * to plain numbers for save files.
 */

/** mulberry32 — tiny, fast, good-enough distribution for game logic. */
function mulberry32Step(state: number): { state: number; value: number } {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { state: next, value };
}

/** FNV-1a 32-bit — stable string hash for deriving stream seeds from names. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface RngStreamState {
  readonly name: string;
  readonly state: number;
}

export class RngStream {
  readonly name: string;
  private state: number;

  constructor(name: string, state: number) {
    this.name = name;
    this.state = state | 0;
  }

  static fromSeed(rootSeed: number, name: string): RngStream {
    return new RngStream(name, (rootSeed ^ fnv1a(name)) | 0);
  }

  static fromState(saved: RngStreamState): RngStream {
    return new RngStream(saved.name, saved.state);
  }

  /** Uniform float in [0, 1). */
  next(): number {
    const { state, value } = mulberry32Step(this.state);
    this.state = state;
    return value;
  }

  /** Uniform integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  serialize(): RngStreamState {
    return { name: this.name, state: this.state };
  }
}

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
