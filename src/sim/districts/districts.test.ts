import { describe, expect, it } from "vitest";
import {
  DISTRICTS,
  DISTRICT_LIST,
  GATE_ARRIVAL_CAPACITY,
  CAPACITY_PER_BAY,
  CAPACITY_TAPER_FLOOR,
} from "@/content/districts";
import { xpForLevel } from "@/content/progression";
import { money } from "@/shared/money";
import { createSim, type SimFacade } from "../api";
import { TEST_PIECES, TEST_SITE } from "../testing/fixture";

/**
 * Districts turn the park into a resort. The risk they carry is arrival
 * capacity: GAME_BALANCE §3.3 reads as a hard 60-guest ceiling, which would
 * delete a game that benches at 1,200–1,500 guests. So the tests care most
 * that capacity presses rather than walls.
 */

const DISTRICT_PIECES = [
  { id: "cityroads/parking-bay", category: "building" as const, footprint: { w: 1, d: 1 }, cost: money(150_00) },
  { id: "suburban/cabin", category: "building" as const, footprint: { w: 1, d: 1 }, cost: money(1_700_00) },
];

function park(opts: { unlockAll?: boolean; xp?: number } = {}): SimFacade {
  const sim = createSim({
    seed: 12,
    parkName: "Resort",
    site: TEST_SITE,
    pieceDefs: [...TEST_PIECES, ...DISTRICT_PIECES],
    ...(opts.unlockAll ? { unlockAll: true } : {}),
  });
  const gate = TEST_SITE.gate;
  sim.dispatch({
    type: "build/paintPath",
    cells: Array.from({ length: 8 }, (_, i) => ({ x: gate.x, z: gate.z - i })),
  });
  if (opts.xp === undefined) {
    return sim;
  }
  return createSim({
    seed: sim.snapshot().seed,
    site: TEST_SITE,
    pieceDefs: [...TEST_PIECES, ...DISTRICT_PIECES],
    resumeFrom: { ...structuredClone(sim.snapshot()), xp: opts.xp },
  });
}

describe("plots", () => {
  it("authors all six districts, even the ones without buildables yet", () => {
    // The shape of the resort is part of the pitch — hiding the unshipped four
    // would make the game look smaller than it is planned to be.
    expect(DISTRICT_LIST).toHaveLength(6);
    for (const def of DISTRICT_LIST) {
      expect(def.plotCents).toBeGreaterThan(0);
      expect(def.unlockLevel).toBeGreaterThan(0);
    }
    expect(DISTRICTS.parking.buildables.length).toBeGreaterThan(0);
    expect(DISTRICTS.resort.buildables.length).toBeGreaterThan(0);
  });

  it("is locked until the park reaches its level, then buyable once", () => {
    const early = park();
    expect(early.dispatch({ type: "district/purchase", district: "parking" }).ok).toBe(false);

    const ready = park({ xp: xpForLevel(DISTRICTS.parking.unlockLevel) });
    expect(ready.dispatch({ type: "district/purchase", district: "parking" }).ok).toBe(true);
    expect(ready.districts().owned).toContain("parking");
    // Buying twice is a no-op, not a second charge.
    const again = ready.dispatch({ type: "district/purchase", district: "parking" });
    expect(again.ok).toBe(false);
  });

  it("raises land value, which is what widens borrowing headroom", () => {
    // The only path by which land value ever grows. Without it the biggest
    // loan is unreachable no matter how well the park does.
    const sim = park({ xp: xpForLevel(DISTRICTS.parking.unlockLevel) });
    const before = sim.finance().valuation.landValueCents;
    sim.dispatch({ type: "district/purchase", district: "parking" });
    sim.advance(2);
    expect(sim.finance().valuation.landValueCents).toBe(before + DISTRICTS.parking.plotCents);
  });

  it("only opens its buildables once the plot is owned", () => {
    const sim = park({ xp: xpForLevel(DISTRICTS.parking.unlockLevel) });
    const gate = TEST_SITE.gate;
    const before = sim.dispatch({
      type: "build/place",
      pieceId: "cityroads/parking-bay",
      x: gate.x + 2,
      z: gate.z - 2,
      rot: 0,
    });
    expect(before.ok).toBe(false);
    expect(before.ok === false && before.reason).toBe("locked");

    sim.dispatch({ type: "district/purchase", district: "parking" });
    expect(
      sim.dispatch({
        type: "build/place",
        pieceId: "cityroads/parking-bay",
        x: gate.x + 2,
        z: gate.z - 2,
        rot: 0,
      }).ok,
    ).toBe(true);
  });
});

describe("arrival capacity presses, it does not wall", () => {
  it("does nothing at all below capacity", () => {
    const sim = park({ unlockAll: true });
    expect(sim.districts().arrivalCapacity).toBe(GATE_ARRIVAL_CAPACITY);
  });

  it("never shuts the gate, however far over capacity the park runs", () => {
    // The floor is the whole design: a full lot slows arrivals, it can never
    // stop them, so a busy park is never punished into a spiral (ADR-15).
    const sim = park({ unlockAll: true });
    const snapshot = sim.snapshot();
    expect(snapshot).toBeDefined();
    // Direct on the pure function via the view's capacity figure.
    const capacity = sim.districts().arrivalCapacity;
    for (const live of [capacity + 1, capacity * 2, capacity * 50, capacity * 5_000]) {
      const mult = Math.max(Math.pow(capacity / live, 0.6), CAPACITY_TAPER_FLOOR);
      expect(mult).toBeGreaterThanOrEqual(CAPACITY_TAPER_FLOOR);
      expect(mult).toBeLessThanOrEqual(1);
    }
  });

  it("is monotonic — more guests never speeds the gate up", () => {
    const capacity = 60;
    let previous = 1;
    for (let live = capacity; live <= capacity * 40; live += 37) {
      const mult =
        live <= capacity
          ? 1
          : Math.max(Math.pow(capacity / live, 0.6), CAPACITY_TAPER_FLOOR);
      expect(mult).toBeLessThanOrEqual(previous + 1e-9);
      previous = mult;
    }
  });

  it("leaves an ordinary early park completely alone", () => {
    // The cap must never bite before the player has a lever. Parking Grounds
    // unlocks at L3, and below the gate's own capacity the multiplier is
    // exactly 1 — so a park too small to have bought the district is also too
    // small to be throttled by not having it (ADR-15).
    expect(DISTRICTS.parking.unlockLevel).toBeLessThanOrEqual(3);
    const sim = park({ unlockAll: true });
    const capacity = sim.districts().arrivalCapacity;
    expect(capacity).toBe(GATE_ARRIVAL_CAPACITY);
    for (const live of [0, 1, 30, capacity]) {
      const mult = live <= capacity ? 1 : Math.pow(capacity / live, 0.6);
      expect(mult).toBe(1);
    }
  });

  it("is calibrated so a modest lot serves a big park", () => {
    // Measured (scripts/bench-guests.ts): the bench park's natural population
    // with capacity removed is ~1,214. 29 pieces must cover that, or the lot
    // becomes a map-eating chore rather than a decision — the reason per-bay
    // moved from 5 to 25.
    const modestLot = 29;
    const capacity = GATE_ARRIVAL_CAPACITY + modestLot * CAPACITY_PER_BAY;
    expect(capacity).toBeGreaterThan(700);
    // …and the same lot at the old rate would not have come close.
    expect(GATE_ARRIVAL_CAPACITY + modestLot * 5).toBeLessThan(300);
  });

  it("widens with every parking bay built", () => {
    const sim = park({ unlockAll: true });
    const gate = TEST_SITE.gate;
    const before = sim.districts().arrivalCapacity;
    for (let i = 0; i < 4; i++) {
      sim.dispatch({
        type: "build/place",
        pieceId: "cityroads/parking-bay",
        x: gate.x + 2 + i,
        z: gate.z - 6,
        rot: 0,
      });
    }
    expect(sim.districts().arrivalCapacity).toBe(before + 4 * CAPACITY_PER_BAY);
  });
});

describe("Resort Row", () => {
  it("counts rooms and trades them monthly against the rating", () => {
    const sim = park({ unlockAll: true });
    const gate = TEST_SITE.gate;
    expect(sim.districts().hotelRooms).toBe(0);
    sim.dispatch({
      type: "build/place",
      pieceId: "suburban/cabin",
      x: gate.x + 3,
      z: gate.z - 6,
      rot: 0,
    });
    expect(sim.districts().hotelRooms).toBe(2);
  });

  it("charges upkeep on every room, sold or not", () => {
    // Over-building must be a real mistake, not a free bet.
    const sim = park({ unlockAll: true });
    const gate = TEST_SITE.gate;
    for (let i = 0; i < 3; i++) {
      sim.dispatch({
        type: "build/place",
        pieceId: "suburban/cabin",
        x: gate.x + 3 + i,
        z: gate.z - 6,
        rot: 0,
      });
    }
    const before = sim.snapshot().ledger.expense.upkeep;
    sim.advance(3_100); // past a month close
    expect(sim.snapshot().ledger.expense.upkeep).toBeGreaterThan(before);
  });
});

describe("persistence", () => {
  it("keeps owned plots and stays deterministic across a save", () => {
    const sim = park({ unlockAll: true });
    sim.dispatch({ type: "district/purchase", district: "parking" });
    sim.advance(200);
    const snapshot = sim.snapshot();
    const resumed = createSim({
      seed: snapshot.seed,
      site: TEST_SITE,
      pieceDefs: [...TEST_PIECES, ...DISTRICT_PIECES],
      resumeFrom: structuredClone(snapshot),
    });
    expect(resumed.districts().owned).toEqual(["parking"]);
    resumed.advance(300);
    sim.advance(300);
    expect(resumed.hash()).toBe(sim.hash());
  });
});
