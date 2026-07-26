import { SAVE_FORMAT_VERSION } from "./schema";

/**
 * Forward-only save migrations. A save at version N runs migrations
 * N, N+1, … SAVE_FORMAT_VERSION-1 in order, then validates against the
 * current schema. Every released format version keeps its migration forever
 * (TECHNICAL_ARCHITECTURE §8); the matrix test in migrations.test.ts guards
 * the chain.
 */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** Keyed by the version the migration upgrades FROM. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // v2 (M1) → v3 (M2): the park wasn't alive yet — closed gate, no guests.
  2: (raw) => {
    const sim = (raw["sim"] ?? {}) as Record<string, unknown>;
    return {
      ...raw,
      sim: {
        ...sim,
        parkOpen: false,
        entryFeeCents: 10_00,
        spawnAccumulator: 0,
        monthNumber: 0,
        lastMonthGuests: 0,
        xp: 0,
        ledger: {
          income: { entry: 0, food: 0, drink: 0, facility: 0 },
          expense: { goods: 0, wages: 0, upkeep: 0, construction: 0 },
        },
        stats: {
          pathCellsBuilt: 0,
          sceneryPlaced: 0,
          shopsBuilt: 0,
          guestsWelcomed: 0,
          mealsServed: 0,
          drinksServed: 0,
          littersCleaned: 0,
          janitorsHired: 0,
          monthsProfit: 0,
          guestsDeparted: 0,
          happyDepartures: 0,
          litterSpawned: 0,
        },
        goals: { active: [], completed: [], cooldowns: {} },
        litter: [],
        janitors: [],
        guests: {
          count: 0,
          freeList: [],
          state: [],
          archetype: [],
          variant: [],
          x: [],
          z: [],
          hunger: [],
          thirst: [],
          bladder: [],
          energy: [],
          fun: [],
          wallet: [],
          emote: [],
          emoteTtl: [],
          serveTicks: [],
          servingShop: [],
          enteredAtTick: [],
          paths: [],
          thoughts: [],
        },
      },
    };
  },
  // v1 (M0) → v2 (M1): the world layer and money did not exist yet.
  1: (raw) => {
    const sim = (raw["sim"] ?? {}) as Record<string, unknown>;
    return {
      ...raw,
      sim: {
        ...sim,
        money: 75_000_00, // STARTING_MONEY at the time of the migration
        world: {
          siteId: "meadowbrook",
          nextInstanceId: 1,
          placed: [],
          pathCells: [], // restore pads to the site's cell count
        },
      },
    };
  },
};

export class SaveVersionError extends Error {
  constructor(
    readonly found: number,
    readonly supported: number,
  ) {
    super(
      found > supported
        ? `Save was written by a newer Polypark (format ${found} > ${supported}). Update the game to load it.`
        : `Save format ${found} is not recognized.`,
    );
    this.name = "SaveVersionError";
  }
}

export function runMigrations(
  raw: Record<string, unknown>,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  targetVersion: number = SAVE_FORMAT_VERSION,
): Record<string, unknown> {
  const found = raw["formatVersion"];
  if (typeof found !== "number" || !Number.isInteger(found) || found < 1) {
    throw new SaveVersionError(Number(found), targetVersion);
  }
  if (found > targetVersion) {
    throw new SaveVersionError(found, targetVersion);
  }
  let current = raw;
  for (let version = found; version < targetVersion; version++) {
    const migrate = migrations[version];
    if (!migrate) {
      throw new SaveVersionError(found, targetVersion);
    }
    current = { ...migrate(current), formatVersion: version + 1 };
  }
  return current;
}
