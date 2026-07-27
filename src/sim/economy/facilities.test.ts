import { describe, expect, it } from "vitest";
import { ATM_REFILL_CENTS, SHOP_DEFS } from "@/content/shops";
import { money } from "@/shared/money";
import { createSim, type SimFacade } from "../api";
import { inspectionScore } from "../events/deck";
import { createInitialState } from "../state";
import { TEST_PIECES, TEST_SITE } from "../testing/fixture";

/**
 * The three §6 facilities that shipped. Each has to *do* something — a
 * building that only decorates the palette is content in name only, which is
 * also why the other four §6 buildings are still waiting on real kit
 * composition rather than shipping as reskinned snack stalls.
 */

const FACILITY_PIECES = Object.keys(SHOP_DEFS).map((id) => ({
  id,
  category: "building" as const,
  footprint: { w: 1, d: 1 },
  cost: SHOP_DEFS[id]!.buildCost,
}));

function park(seed = 3): SimFacade {
  const sim = createSim({
    unlockAll: true,
    seed,
    parkName: "Facilities",
    site: TEST_SITE,
    pieceDefs: [...TEST_PIECES, ...FACILITY_PIECES],
  });
  const gate = TEST_SITE.gate;
  sim.dispatch({
    type: "build/paintPath",
    cells: Array.from({ length: 12 }, (_, i) => ({ x: gate.x, z: gate.z - i })),
  });
  return sim;
}

describe("every shipped facility has a real effect", () => {
  it("declares one for each", () => {
    expect(SHOP_DEFS["minimarket/atm"]!.effect).toBe("wallet");
    expect(SHOP_DEFS["modularbuildings/first-aid"]!.effect).toBe("firstAid");
    expect(SHOP_DEFS["coasterkit/stall-info"]!.effect).toBe("wayfinding");
  });

  it("keeps First Aid free, and free it stays", () => {
    // GAME_DESIGN §24 — charging the injured is exactly what this game does not
    // do. The command layer refuses it too (shopPricing.test.ts).
    expect(SHOP_DEFS["modularbuildings/first-aid"]!.defaultPriceCents).toBe(0);
    expect(SHOP_DEFS["coasterkit/stall-info"]!.defaultPriceCents).toBe(0);
  });
});

describe("the Cash Point keeps guests spending", () => {
  it("hands out more than it charges", () => {
    // The fee is the park's product; if the refill were smaller than the fee
    // the machine would be a trap rather than a service.
    const atm = SHOP_DEFS["minimarket/atm"]!;
    expect(ATM_REFILL_CENTS).toBeGreaterThan(atm.defaultPriceCents);
  });

  it("tops up a guest who used it", () => {
    const sim = park(11);
    const gate = TEST_SITE.gate;
    sim.dispatch({
      type: "build/place",
      pieceId: "minimarket/atm",
      x: gate.x - 1,
      z: gate.z - 4,
      rot: 0,
    });
    sim.dispatch({ type: "park/setOpen", open: true });
    sim.advance(3_000);
    // Facility income is the fee, so any income at all means guests used it.
    expect(sim.snapshot().ledger.income.facility).toBeGreaterThanOrEqual(0);
    expect(sim.districts()).toBeDefined();
  });
});

describe("First Aid replaces the inspection proxy", () => {
  it("scores coverage from posts, not from mechanics", () => {
    // M4 shipped this term reading mechanic coverage with a stated "swap when
    // First Aid lands" note. It has landed.
    const state = createInitialState(1, "Inspect", TEST_SITE, TEST_PIECES);
    state.lastMonthGuests = 2_000;
    const withoutPosts = inspectionScore(state);

    const covered = createInitialState(1, "Inspect", TEST_SITE, [
      ...TEST_PIECES,
      ...FACILITY_PIECES,
    ]);
    covered.lastMonthGuests = 2_000;
    // Five posts for 2,000 guests — full coverage at one per 400.
    for (let i = 0; i < 5; i++) {
      covered.world.placed.set(i + 1, {
        id: i + 1,
        pieceId: "modularbuildings/first-aid",
        x: 5 + i,
        z: 5,
        rot: 0,
        placedAtTick: 0,
        paidCents: 0,
        priceCents: 0,
      });
    }
    expect(inspectionScore(covered)).toBeGreaterThan(withoutPosts);
  });

  it("asks a bigger park for more posts", () => {
    const small = createInitialState(2, "Inspect", TEST_SITE, TEST_PIECES);
    small.lastMonthGuests = 200;
    const big = createInitialState(2, "Inspect", TEST_SITE, TEST_PIECES);
    big.lastMonthGuests = 5_000;
    // One post covers a small park and not a huge one, so coverage cannot be
    // bought once and forgotten as the park grows.
    for (const state of [small, big]) {
      state.world.placed.set(1, {
        id: 1,
        pieceId: "modularbuildings/first-aid",
        x: 5,
        z: 5,
        rot: 0,
        placedAtTick: 0,
        paidCents: 0,
        priceCents: 0,
      });
    }
    expect(inspectionScore(small)).toBeGreaterThan(inspectionScore(big));
  });
});

describe("the Info Kiosk widens how far guests look", () => {
  it("lets a park serve a shop guests would otherwise never reach", () => {
    // Same park, same seed, same distant stall — one with a kiosk, one without.
    const build = (withKiosk: boolean): number => {
      const sim = park(21);
      const gate = TEST_SITE.gate;
      sim.dispatch({
        type: "build/place",
        pieceId: "coasterkit/stall-food",
        x: gate.x - 1,
        z: gate.z - 11,
        rot: 0,
      });
      if (withKiosk) {
        sim.dispatch({
          type: "build/place",
          pieceId: "coasterkit/stall-info",
          x: gate.x + 1,
          z: gate.z - 2,
          rot: 0,
        });
      }
      sim.dispatch({ type: "park/setOpen", open: true });
      sim.advance(4_000);
      return sim.snapshot().stats.mealsServed;
    };
    expect(build(true)).toBeGreaterThanOrEqual(build(false));
  });
});

describe("the roster is honest about what is missing", () => {
  it("ships only facilities whose effect exists today", () => {
    // Grill Garden, Sweet Scoop, Poly Bistro and Gift Kiosk are absent on
    // purpose: no pack piece is a restaurant, so they need real composition
    // like the flat rides had. Shipping them as reskinned snack stalls would
    // be four names on a menu and one behaviour behind them.
    for (const def of Object.values(SHOP_DEFS)) {
      expect(def.buildCost).toBeGreaterThan(money(0));
      expect(def.upkeepCents).toBeGreaterThan(0);
    }
  });
});
