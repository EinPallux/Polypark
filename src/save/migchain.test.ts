import { describe, expect, it } from "vitest";
import { MIGRATIONS, runMigrations } from "./migrations";
import { SAVE_FORMAT_VERSION, SaveFileSchema } from "./schema";
import { createSim } from "@/sim/api";
import { TEST_PIECES, TEST_SITE } from "@/sim/testing/fixture";

/**
 * The migration matrix (ROADMAP M5 acceptance, TECH §8: "every version ever
 * released must load forever").
 *
 * save.test.ts exercises `runMigrations` against a *fabricated* table, which
 * proves the runner works but says nothing about the real chain. This walks a
 * save from every released format up to the current one through the actual
 * MIGRATIONS and validates the result against the live schema — the only test
 * that would notice a new field added without a migration to seed it.
 */

/** The payload a save written by `version` would have carried. */
function payloadFor(version: number): Record<string, unknown> {
  const sim = createSim({
    seed: 5,
    parkName: "Old",
    site: TEST_SITE,
    pieceDefs: TEST_PIECES,
    unlockAll: true,
  });
  const current = sim.snapshot() as unknown as Record<string, unknown>;

  // v1 (M0) predates money, the world layer and everything after it.
  const v1: Record<string, unknown> = {
    tick: current.tick,
    seed: current.seed,
    parkName: current.parkName,
    rng: current.rng,
  };
  if (version === 1) {
    return v1;
  }

  // v2 (M1) added money + world, and nothing else.
  if (version === 2) {
    return { ...v1, money: current.money, world: current.world };
  }

  // v3 and v4 are the current payload minus exactly what the migration FROM
  // that version is responsible for adding — the shape that build would write.
  const drop = (keys: readonly string[]): Record<string, unknown> => {
    const copy = { ...current };
    for (const key of keys) {
      delete copy[key];
    }
    return copy;
  };
  if (version === 3) {
    return drop(["rides", "mechanics", "nextMechanicId"]);
  }
  return drop([
    "difficulty",
    "finance",
    "districts",
    "deck",
    "weather",
    "rating",
    "starTickets",
    "unlockAll",
  ]);
}

describe("every released save format still loads", () => {
  for (let version = 1; version < SAVE_FORMAT_VERSION; version++) {
    it(`migrates v${version} → v${SAVE_FORMAT_VERSION} into a schema-valid save`, () => {
      const out = runMigrations(
        {
          formatVersion: version,
          appVersion: "0.0.1",
          meta: { name: "Old", savedAtIso: "2026-01-01T00:00:00.000Z" },
          sim: payloadFor(version),
        },
        MIGRATIONS,
        SAVE_FORMAT_VERSION,
      );
      const parsed = SaveFileSchema.safeParse(out);
      // Name what is missing. "expected false to be true" would send the next
      // person hunting through five migrations by hand.
      if (!parsed.success) {
        throw new Error(
          `v${version} did not survive the chain:\n` +
            parsed.error.issues
              .slice(0, 10)
              .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
              .join("\n"),
        );
      }
      expect(parsed.success).toBe(true);
    });
  }

  it("keeps a migration for every released version", () => {
    // A gap here means some save in the wild can never be opened again.
    for (let version = 1; version < SAVE_FORMAT_VERSION; version++) {
      expect(MIGRATIONS[version], `no migration from v${version}`).toBeDefined();
    }
  });
});
