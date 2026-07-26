/**
 * Deterministic RNG primitives. Lives in shared/ because both the sim (game
 * logic streams, TECH §4.3) and the render layer (visual-only scatter
 * placement, TECH §6.4) need seeded determinism; only the sim owns *stateful
 * gameplay* streams (see src/sim/core/rng.ts).
 */

/** mulberry32 — tiny, fast, good-enough distribution for game logic. */
export function mulberry32Step(state: number): { state: number; value: number } {
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

  /** Uniform float in [min, max). */
  nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  serialize(): RngStreamState {
    return { name: this.name, state: this.state };
  }
}
