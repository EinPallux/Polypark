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
