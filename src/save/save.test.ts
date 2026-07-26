import { describe, expect, it } from "vitest";
import { gzipSync, strToU8 } from "fflate";
import { createSim } from "@/sim/api";
import { findOpenFlat, TEST_PIECES, TEST_SITE } from "@/sim/testing/fixture";
import { decodeSave, encodeSave, SaveCorruptError } from "./codec";
import { runMigrations, SaveVersionError, type Migration } from "./migrations";
import { SAVE_FORMAT_VERSION, SaveFileSchema, type SaveFile } from "./schema";

function makeSave(): SaveFile {
  const sim = createSim({
    seed: 4242,
    parkName: "Roundtrip Park",
    site: TEST_SITE,
    pieceDefs: TEST_PIECES,
  });
  const spot = findOpenFlat(sim.terrain());
  sim.dispatch({ type: "build/place", pieceId: "test/bench", ...spot, rot: 1 });
  sim.dispatch({
    type: "build/paintPath",
    cells: [
      { x: spot.x + 1, z: spot.z },
      { x: spot.x + 1, z: spot.z + 1 },
    ],
  });
  sim.advance(1234);
  return {
    formatVersion: SAVE_FORMAT_VERSION,
    appVersion: "0.1.0",
    meta: { name: "Roundtrip Park", savedAtIso: "2026-07-26T12:00:00.000Z" },
    sim: structuredClone(sim.snapshot()) as SaveFile["sim"],
  };
}

describe("save codec (TECH §8)", () => {
  it("round-trips a decorated park losslessly", () => {
    const save = makeSave();
    const decoded = decodeSave(encodeSave(save));
    expect(decoded).toEqual(save);
    expect(decoded.sim.world.placed).toHaveLength(1);
  });

  it("restoring the decoded snapshot resumes the identical sim", () => {
    const save = makeSave();
    const decoded = decodeSave(encodeSave(save));
    const resumed = createSim({
      seed: decoded.sim.seed,
      site: TEST_SITE,
      pieceDefs: TEST_PIECES,
      resumeFrom: decoded.sim,
    });
    const control = createSim({
      seed: save.sim.seed,
      site: TEST_SITE,
      pieceDefs: TEST_PIECES,
      resumeFrom: save.sim,
    });
    resumed.advance(100);
    control.advance(100);
    expect(resumed.hash()).toBe(control.hash());
    // Occupancy rebuilt: the restored bench still blocks its cells.
    const bench = resumed.placedPieces()[0]!;
    expect(resumed.checkPlace("test/flower", bench.x, bench.z, 0)).toEqual({
      ok: false,
      reason: "occupied",
    });
  });

  it("is deterministic: same save ⇒ same bytes (drift-checkable)", () => {
    const save = makeSave();
    expect(encodeSave(save)).toEqual(encodeSave(save));
  });

  it("rejects garbage bytes with a friendly error", () => {
    expect(() => decodeSave(new Uint8Array([1, 2, 3, 4]))).toThrow(SaveCorruptError);
  });

  it("rejects saves from a newer format version", () => {
    const save = makeSave();
    const tampered = { ...save, formatVersion: SAVE_FORMAT_VERSION + 1 };
    const futureBytes = gzipSync(strToU8(JSON.stringify(tampered)), { mtime: 0 });
    expect(() => decodeSave(futureBytes)).toThrow(SaveVersionError);
  });

  it("migrates a real v1 (M0) save to the current format", () => {
    const v1 = {
      formatVersion: 1,
      appVersion: "0.1.0",
      meta: { name: "Old Park", savedAtIso: "2026-07-26T10:00:00.000Z" },
      sim: {
        tick: 500,
        seed: 123,
        parkName: "Old Park",
        rng: [
          { name: "guests", state: 1 },
          { name: "events", state: 2 },
          { name: "rides", state: 3 },
          { name: "staff", state: 4 },
          { name: "world", state: 5 },
        ],
      },
    };
    const bytes = gzipSync(strToU8(JSON.stringify(v1)), { mtime: 0 });
    const migrated = decodeSave(bytes);
    expect(migrated.formatVersion).toBe(SAVE_FORMAT_VERSION);
    expect(migrated.sim.money).toBe(75_000_00);
    expect(migrated.sim.world.siteId).toBe("meadowbrook");
    expect(SaveFileSchema.parse(migrated)).toBeTruthy();
  });
});

describe("migration chain (TECH §8)", () => {
  it("applies migrations in order from the found version", () => {
    const table: Record<number, Migration> = {
      1: (raw) => ({ ...raw, addedByV1: true }),
      2: (raw) => ({ ...raw, addedByV2: true }),
    };
    const out = runMigrations({ formatVersion: 1 }, table, 3);
    expect(out).toEqual({ formatVersion: 3, addedByV1: true, addedByV2: true });
  });

  it("a save already at the target version passes through untouched", () => {
    const out = runMigrations({ formatVersion: 3, keep: "me" }, {}, 3);
    expect(out).toEqual({ formatVersion: 3, keep: "me" });
  });

  it("fails loudly on a gap in the chain", () => {
    expect(() => runMigrations({ formatVersion: 1 }, {}, 99)).toThrow(SaveVersionError);
  });

  it("fails loudly on nonsense versions", () => {
    expect(() => runMigrations({ formatVersion: -1 })).toThrow(SaveVersionError);
    expect(() => runMigrations({})).toThrow(SaveVersionError);
  });
});
