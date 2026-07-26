import { describe, expect, it } from "vitest";
import { gzipSync, strToU8 } from "fflate";
import { createSim } from "@/sim/api";
import { decodeSave, encodeSave, SaveCorruptError } from "./codec";
import { runMigrations, SaveVersionError, type Migration } from "./migrations";
import { SAVE_FORMAT_VERSION, type SaveFile } from "./schema";

function makeSave(): SaveFile {
  const sim = createSim({ seed: 4242, parkName: "Roundtrip Park" });
  sim.advance(1234);
  return {
    formatVersion: SAVE_FORMAT_VERSION,
    appVersion: "0.1.0",
    meta: { name: "Roundtrip Park", savedAtIso: "2026-07-26T12:00:00.000Z" },
    sim: structuredClone(sim.snapshot()) as SaveFile["sim"],
  };
}

describe("save codec (TECH §8)", () => {
  it("round-trips through gzip bytes losslessly", () => {
    const save = makeSave();
    const decoded = decodeSave(encodeSave(save));
    expect(decoded).toEqual(save);
  });

  it("restoring the decoded snapshot resumes the identical sim", () => {
    const save = makeSave();
    const decoded = decodeSave(encodeSave(save));
    const resumed = createSim({ seed: decoded.sim.seed, resumeFrom: decoded.sim });
    const control = createSim({ seed: save.sim.seed, resumeFrom: save.sim });
    resumed.advance(100);
    control.advance(100);
    expect(resumed.hash()).toBe(control.hash());
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
    // Encode manually to bypass the outbound validation:
    const futureBytes = gzipSync(strToU8(JSON.stringify(tampered)), { mtime: 0 });
    expect(() => decodeSave(futureBytes)).toThrow(SaveVersionError);
    expect(() => decodeSave(encodeSave(save))).not.toThrow();
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
    expect(() => runMigrations({ formatVersion: 1 }, {}, 2)).toThrow(SaveVersionError);
  });

  it("fails loudly on nonsense versions", () => {
    expect(() => runMigrations({ formatVersion: -1 })).toThrow(SaveVersionError);
    expect(() => runMigrations({})).toThrow(SaveVersionError);
  });
});
