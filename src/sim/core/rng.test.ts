import { describe, expect, it } from "vitest";
import {
  createRngStreams,
  deserializeRngStreams,
  RngStream,
  serializeRngStreams,
} from "./rng";

describe("seeded RNG streams (TECH §4.3)", () => {
  it("same seed ⇒ same sequence", () => {
    const a = RngStream.fromSeed(42, "guests");
    const b = RngStream.fromSeed(42, "guests");
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds and different stream names diverge", () => {
    const seedA = RngStream.fromSeed(1, "guests").next();
    const seedB = RngStream.fromSeed(2, "guests").next();
    expect(seedA).not.toBe(seedB);

    const guests = RngStream.fromSeed(7, "guests");
    const events = RngStream.fromSeed(7, "events");
    expect(guests.next()).not.toBe(events.next());
  });

  it("streams are independent: rolling one never shifts another", () => {
    const streams = createRngStreams(1234);
    const control = createRngStreams(1234);
    for (let i = 0; i < 100; i++) {
      streams.guests.next(); // heavy guest activity...
    }
    expect(streams.events.next()).toBe(control.events.next()); // ...events unaffected
  });

  it("serializes and resumes mid-sequence exactly", () => {
    const original = createRngStreams(99);
    original.rides.next();
    original.rides.next();
    const resumed = deserializeRngStreams(serializeRngStreams(original));
    expect(resumed.rides.next()).toBe(original.rides.next());
  });

  it("nextInt stays in-range and covers bounds", () => {
    const rng = RngStream.fromSeed(5, "world");
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.nextInt(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([3, 4, 5, 6]));
  });
});
