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
 * v4 (M3): + rides (tracked coasters with piece lists + flat rides),
 *          mechanics, guest rideId lane.
 * v5 (M4): + difficulty, finance (loans/credit/land value/campaign/
 *          receivership), the ledger's financing section, district state.
 */

export const SAVE_FORMAT_VERSION = 5;

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

const TrackPoseSchema = z.object({
  mx: z.number().int(),
  mz: z.number().int(),
  level: z.number().int(),
  heading: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});

const TrackPieceSchema = z.object({
  kind: z.enum([
    "station",
    "straight",
    "corner-small",
    "corner-large",
    "curve",
    "hill",
    "hill-half",
    "corner-small-ramp",
    "corner-large-ramp",
    "bump-up",
    "bump-down",
    "loop",
  ]),
  flipped: z.boolean(),
});

const TrackedRideSchema = z.object({
  id: z.number().int().positive(),
  family: z.enum(["steel", "mouse"]),
  anchor: TrackPoseSchema,
  baseHeight: z.number(),
  pieces: z.array(TrackPieceSchema),
  state: z.number().int().min(0).max(3),
  priceCents: z.number().int().nonnegative(),
  tested: z.boolean(),
  trainArc: z.number(),
  trainPhase: z.enum(["dwell", "run"]),
  dwellTicks: z.number().int(),
  riders: intArray,
  queue: intArray,
  cycleCount: z.number().int().nonnegative(),
  totalSpentCents: z.number().int(),
  entranceX: z.number().int(),
  entranceZ: z.number().int(),
  breakdownTicks: z.number().int(),
  mechanicId: z.number().int(),
  everOpened: z.boolean(),
  createdAtTick: z.number().int().nonnegative(),
});

const FlatRideSchema = z.object({
  id: z.number().int().positive(),
  defId: z.enum(["teacups", "carousel", "galleon", "rocket", "drop"]),
  x: z.number().int(),
  z: z.number().int(),
  rot: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  state: z.number().int().min(0).max(3),
  priceCents: z.number().int().nonnegative(),
  phaseTicks: z.number().int(),
  phase: z.enum(["loading", "running"]),
  riders: intArray,
  queue: intArray,
  cycleCount: z.number().int().nonnegative(),
  tested: z.boolean(),
  breakdownTicks: z.number().int(),
  mechanicId: z.number().int(),
  entranceX: z.number().int(),
  entranceZ: z.number().int(),
  placedAtTick: z.number().int().nonnegative(),
  everOpened: z.boolean(),
});

const LoanSchema = z.object({
  id: z.number().int().positive(),
  product: z.enum(["piggy", "trust", "consortium"]),
  principalCents: z.number().int(),
  aprBpsLocked: z.number().int(),
  termMonths: z.number().int(),
  minPaymentCents: z.number().int(),
  balanceCents: z.number().int(),
  monthsPaid: z.number().int(),
  arrearsCents: z.number().int(),
  missedPayments: z.number().int(),
  totalInterestPaidCents: z.number().int(),
  openedMonth: z.number().int(),
});

const FinanceSchema = z.object({
  nextLoanId: z.number().int().positive(),
  loans: z.array(LoanSchema),
  credit: z.object({
    gradeIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    cleanMonths: z.number().int(),
    missedPaymentsTotal: z.number().int(),
  }),
  landValueCents: z.number().int(),
  campaign: z
    .object({
      campaign: z.enum(["flyers", "online", "parade"]),
      startedAtTick: z.number().int(),
      endsAtTick: z.number().int(),
    })
    .nullable(),
  receivership: z.object({
    active: z.boolean(),
    enteredMonth: z.number().int(),
    monthsActive: z.number().int(),
    sweptCents: z.number().int(),
    comebackMonthsRemaining: z.number().int(),
  }),
  insolventMonths: z.number().int(),
  repossessedRideKey: z.number().int(),
  hardFail: z.boolean(),
});

const MechanicSchema = z.object({
  id: z.number().int().positive(),
  x: z.number(),
  z: z.number(),
  targetRide: z.number().int(),
  repairTicks: z.number().int(),
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
  parkOpen: z.boolean(),
  entryFeeCents: z.number().int().nonnegative(),
  spawnAccumulator: z.number(),
  monthNumber: z.number().int().nonnegative(),
  lastMonthGuests: z.number().int().nonnegative(),
  xp: z.number().nonnegative(),
  ledger: z.object({
    income: z.record(z.string(), z.number()),
    expense: z.record(z.string(), z.number()),
    financing: z.record(z.string(), z.number()),
  }),
  difficulty: z.enum(["relaxed", "standard", "tycoon"]),
  finance: FinanceSchema,
  // Rolling-window accumulators: plain numbers, persisted so a reload does not
  // reset the park's reputation history.
  rating: z.looseObject({
    pressStars: z.number(),
    capStars: z.number(),
    stars: z.number(),
  }),
  districts: z.object({ billboardCount: z.number().int() }).nullable(),
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
    rideId: intArray,
    paths: z.array(z.tuple([z.number().int(), intArray])),
    thoughts: z.array(z.tuple([z.number().int(), z.array(z.string())])),
  }),
  rides: z.object({
    nextId: z.number().int().positive(),
    tracked: z.array(TrackedRideSchema),
    flat: z.array(FlatRideSchema),
  }),
  mechanics: z.array(MechanicSchema),
  nextMechanicId: z.number().int().positive(),
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
