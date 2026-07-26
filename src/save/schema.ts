import { z } from "zod";

/**
 * Save file format (TECHNICAL_ARCHITECTURE §8). formatVersion is bumped ONLY
 * with a migration in ./migrations.ts — every version ever released must load
 * forever. The sim payload mirrors SimStateSnapshot (src/sim/state.ts); the
 * two evolve in the same commit, guarded by the round-trip test.
 */

export const SAVE_FORMAT_VERSION = 1;

export const RngStreamStateSchema = z.object({
  name: z.string(),
  state: z.number().int(),
});

export const SimSnapshotSchema = z.object({
  tick: z.number().int().nonnegative(),
  seed: z.number().int(),
  parkName: z.string().min(1).max(60),
  rng: z.array(RngStreamStateSchema),
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
