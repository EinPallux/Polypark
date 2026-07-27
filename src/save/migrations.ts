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
  // v4 (M3) → v5 (M4): no economy layer existed — every park was Standard,
  // debt-free, and owned only its home plot.
  4: (raw) => {
    const sim = (raw["sim"] ?? {}) as Record<string, unknown>;
    const ledger = (sim["ledger"] ?? {}) as Record<string, unknown>;
    const expense = (ledger["expense"] ?? {}) as Record<string, unknown>;
    const stats = (sim["stats"] ?? {}) as Record<string, unknown>;
    const world = (sim["world"] ?? {}) as Record<string, unknown>;
    // Shops became priceable in v5. Seed each placed piece at its shop's
    // default so an upgraded park charges exactly what it charged before.
    // why: literal cents, not SHOP_DEFS — a migration is a frozen snapshot
    // (TECH §8) and must not shift when the shop table is retuned.
    const V5_DEFAULT_PRICE_CENTS: Record<string, number> = {
      "coasterkit/stall-food": 6_00,
      "coasterkit/stall-drinks": 4_00,
      "coasterkit/stall-toilets": 0,
    };
    const placed = (Array.isArray(world["placed"]) ? world["placed"] : []) as Record<
      string,
      unknown
    >[];
    return {
      ...raw,
      sim: {
        ...sim,
        world: {
          ...world,
          placed: placed.map((piece) => ({
            ...piece,
            priceCents: V5_DEFAULT_PRICE_CENTS[String(piece["pieceId"])] ?? 0,
          })),
        },
        difficulty: "standard",
        finance: {
          nextLoanId: 1,
          loans: [],
          credit: { gradeIndex: 2, cleanMonths: 0, missedPaymentsTotal: 0 },
          landValueCents: 20_000_00,
          campaign: null,
          receivership: {
            active: false,
            enteredMonth: 0,
            monthsActive: 0,
            sweptCents: 0,
            comebackMonthsRemaining: 0,
          },
          insolventMonths: 0,
          repossessedRideKey: 0,
          hardFail: false,
        },
        districts: null,
        // No deck has ever been dealt to a v4 park. First inspection is a full
        // interval from where the park stands, never immediately on load.
        // why: literals — a migration is a frozen snapshot (TECH §8).
        deck: {
          lastDrawnMonth: {},
          active: [],
          nextInspectionMonth: Number(sim["monthNumber"] ?? 0) + 3,
          sponsorUntilDay: -1,
        },
        // A v4 park has no sky yet. Start it clear, and set dayIndex from the
        // tick it is already at so the chain resumes today instead of
        // fast-forwarding every day the park has ever run.
        // why: literals, not the content constants — a migration is a frozen
        // snapshot of one format (TECH §8) and must not drift when weather is
        // retuned. 750 is TICKS_PER_PARK_DAY at v5.
        weather: {
          today: "sunny",
          forecast: ["sunny", "overcast", "sunny"],
          dayIndex: Math.floor(Number(sim["tick"] ?? 0) / 750),
          closedByWeather: [],
        },
        rating: {
          guestExposure: { num: 0, den: 0 },
          litterDensity: { num: 0, den: 0 },
          crowding: { num: 0, den: 0 },
          queueWait: { num: 0, den: 0 },
          departures: { total: 0 },
          happyDepartures: { total: 0 },
          riders: { total: 0 },
          citations: { total: 0 },
          perRide: {},
          mirror: { departures: 0, happyDepartures: 0, riders: 0 },
          pressStars: 0,
          capStars: 5,
          // Neutral, not zero: stars feeds ratingMult → arrivals, and a v4 park
          // has no rating history to judge it by. tickRating refreshes it.
          // why: a literal, not RATING_NEUTRAL_STARS — a migration is a frozen
          // snapshot of one format, so retuning that constant must not silently
          // rewrite what old saves upgraded into (TECH §8). It also keeps the
          // rating engine out of the title route's bundle.
          stars: 2.5,
          subscores: { fun: 50, value: 50, care: 50, wonder: 50, flow: 50 },
        },
        ledger: {
          ...ledger,
          income: { sponsor: 0, ...((ledger["income"] ?? {}) as Record<string, unknown>) },
          expense: { marketing: 0, interest: 0, admin: 0, ...expense },
          financing: { borrowed: 0, principalRepaid: 0, settlement: 0 },
        },
        // Spread defaults FIRST so real counters are never clobbered.
        stats: {
          loansTaken: 0,
          loansPaidOff: 0,
          campaignsRun: 0,
          paymentsMissed: 0,
          receiverships: 0,
          repossessions: 0,
          ...stats,
        },
      },
    };
  },
  // v3 (M2) → v4 (M3): rides did not exist yet — empty roster, no mechanics.
  3: (raw) => {
    const sim = (raw["sim"] ?? {}) as Record<string, unknown>;
    const guests = (sim["guests"] ?? {}) as Record<string, unknown>;
    const ledger = (sim["ledger"] ?? {}) as Record<string, unknown>;
    const income = (ledger["income"] ?? {}) as Record<string, unknown>;
    const stats = (sim["stats"] ?? {}) as Record<string, unknown>;
    const count = typeof guests["count"] === "number" ? guests["count"] : 0;
    return {
      ...raw,
      sim: {
        ...sim,
        guests: {
          ...guests,
          rideId: Array.from({ length: count }, () => 0),
        },
        ledger: { ...ledger, income: { ride: 0, ...income } },
        stats: {
          coastersBuilt: 0,
          flatRidesBuilt: 0,
          ridesOpened: 0,
          ridersServed: 0,
          mechanicsHired: 0,
          ridesTested: 0,
          breakdowns: 0,
          repairsDone: 0,
          ...stats,
        },
        rides: { nextId: 1, tracked: [], flat: [] },
        mechanics: [],
        nextMechanicId: 1,
      },
    };
  },
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
