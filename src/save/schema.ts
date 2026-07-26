import { z } from "zod";

/**
 * Save file format (TECHNICAL_ARCHITECTURE §8). formatVersion is bumped ONLY
 * with a migration in ./migrations.ts — every version ever released must load
 * forever. The sim payload mirrors SimStateSnapshot (src/sim/state.ts); the
 * two evolve in the same commit, guarded by the round-trip test.
 *
 * v1 (M0): tick/seed/parkName/rng.
 * v2 (M1): + money, + world (siteId, nextInstanceId, placed pieces, path cells).
 * v3 (M2): + the living park — park open/fee, guests, litter, janitors,
 *          ledger, stats, goals, xp.
 */

export const SAVE_FORMAT_VERSION = 3;

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

const numberArray = z.array(z.number());
const intArray = z.array(z.number().int());

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
  parkOpen: z.boolean(),
  entryFeeCents: z.number().int().nonnegative(),
  spawnAccumulator: z.number(),
  monthNumber: z.number().int().nonnegative(),
  lastMonthGuests: z.number().int().nonnegative(),
  xp: z.number().nonnegative(),
  ledger: z.object({
    income: z.record(z.string(), z.number()),
    expense: z.record(z.string(), z.number()),
  }),
  stats: z.record(z.string(), z.number()),
  goals: z.object({
    active: z.array(z.object({ cardId: z.string(), baseValue: z.number() })),
    completed: z.array(z.string()),
    cooldowns: z.record(z.string(), z.number()),
  }),
  litter: z.array(
    z.object({ id: z.number().int(), cellX: z.number().int(), cellZ: z.number().int() }),
  ),
  janitors: z.array(
    z.object({
      id: z.number().int(),
      x: z.number(),
      z: z.number(),
      path: intArray,
      targetLitterId: z.number().int(),
      cleanTicks: z.number().int(),
    }),
  ),
  guests: z.object({
    count: z.number().int().nonnegative(),
    freeList: intArray,
    state: intArray,
    archetype: intArray,
    variant: intArray,
    x: numberArray,
    z: numberArray,
    hunger: numberArray,
    thirst: numberArray,
    bladder: numberArray,
    energy: numberArray,
    fun: numberArray,
    wallet: intArray,
    emote: intArray,
    emoteTtl: intArray,
    serveTicks: intArray,
    servingShop: intArray,
    enteredAtTick: intArray,
    paths: z.array(z.tuple([z.number().int(), intArray])),
    thoughts: z.array(z.tuple([z.number().int(), z.array(z.string())])),
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
