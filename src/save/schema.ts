import { z } from "zod";

/**
 * Save file format (TECHNICAL_ARCHITECTURE §8). formatVersion is bumped ONLY
 * with a migration in ./migrations.ts — every version ever released must load
 * forever. The sim payload mirrors SimStateSnapshot (src/sim/state.ts); the
 * two evolve in the same commit, guarded by the round-trip test.
 *
 * v1 (M0): tick/seed/parkName/rng.
 * v2 (M1): + money, + world (siteId, nextInstanceId, placed pieces, path cells).
 */

export const SAVE_FORMAT_VERSION = 2;

export const RngStreamStateSchema = z.object({
  name: z.string(),
  state: z.number().int(),
});

export const PlacedPieceSchema = z.object({
  id: z.number().int().positive(),
  pieceId: z.string(),
  x: z.number().int().nonnegative(),
  z: z.number().int().nonnegative(),
  rot: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  placedAtTick: z.number().int().nonnegative(),
  paidCents: z.number().int().nonnegative(),
});

export const SimSnapshotSchema = z.object({
  tick: z.number().int().nonnegative(),
  seed: z.number().int(),
  parkName: z.string().min(1).max(60),
  money: z.number().int(),
  rng: z.array(RngStreamStateSchema),
  world: z.object({
    siteId: z.string().min(1),
    nextInstanceId: z.number().int().positive(),
    placed: z.array(PlacedPieceSchema),
    pathCells: z.array(z.number().int().min(0).max(1)),
  }),
});

export const SaveFileSchema = z.object({
  formatVersion: z.literal(SAVE_FORMAT_VERSION),
  /** App version that wrote the save — diagnostics only, never branching logic. */
  appVersion: z.string(),
  meta: z.object({
    name: z.string().min(1).max(60),
    /** Wall-clock is fine here: saves are written by the shell, not the sim. */
    savedAtIso: z.string(),
  }),
  sim: SimSnapshotSchema,
});

export type SaveFile = z.infer<typeof SaveFileSchema>;
