import { describe, expect, it } from "vitest";
import { SHOP_DEFS, SHOP_PRICE_CEILING_CENTS } from "@/content/shops";
import { createSim, type SimFacade } from "../api";
import { TEST_PIECES, TEST_SITE } from "../testing/fixture";

/**
 * Shop pricing was promised in M2's deferral list ("shop price editing UI, M3
 * economy pass") and arrived two milestones late. These tests pin the thing
 * that was actually broken: the park charged a content constant, so Value's
 * `value.shopPrice` cause could never fire and the tycoon layer judged the
 * player on a lever they did not have.
 */

function park(seed = 5): { sim: SimFacade; shopId: number } {
  const shopPieces = Object.keys(SHOP_DEFS).map((pieceId) => ({
    id: pieceId,
    category: "building" as const,
    footprint: { w: 1, d: 1 },
    cost: SHOP_DEFS[pieceId]!.buildCost,
  }));
  const sim = createSim({
    seed,
    parkName: "Prices",
    site: TEST_SITE,
    pieceDefs: [...TEST_PIECES, ...shopPieces],
  });
  const gate = TEST_SITE.gate;
  sim.dispatch({
    type: "build/paintPath",
    cells: Array.from({ length: 12 }, (_, i) => ({ x: gate.x, z: gate.z - i })),
  });
  sim.dispatch({
    type: "build/place",
    pieceId: "coasterkit/stall-food",
    x: gate.x - 1,
    z: gate.z - 4,
    rot: 0,
  });
  const shop = sim.placedPieces().find((p) => p.pieceId === "coasterkit/stall-food")!;
  return { sim, shopId: shop.id };
}

const priceOf = (sim: SimFacade, id: number): number =>
  sim.placedPieces().find((p) => p.id === id)!.priceCents;

describe("a shop can be priced", () => {
  it("opens at the content default", () => {
    const { sim, shopId } = park();
    expect(priceOf(sim, shopId)).toBe(SHOP_DEFS["coasterkit/stall-food"]!.defaultPriceCents);
  });

  it("takes a new price and undoes back to the old one", () => {
    const { sim, shopId } = park();
    const before = priceOf(sim, shopId);
    expect(sim.dispatch({ type: "shop/setPrice", placedId: shopId, cents: 9_00 }).ok).toBe(true);
    expect(priceOf(sim, shopId)).toBe(9_00);
    expect(sim.undo()).toBe(true);
    expect(priceOf(sim, shopId)).toBe(before);
    expect(sim.redo()).toBe(true);
    expect(priceOf(sim, shopId)).toBe(9_00);
  });

  it("refuses a price past the decency ceiling, and refuses charging for toilets", () => {
    const { sim, shopId } = park();
    expect(
      sim.dispatch({
        type: "shop/setPrice",
        placedId: shopId,
        cents: SHOP_PRICE_CEILING_CENTS + 1,
      }).ok,
    ).toBe(false);
    expect(sim.dispatch({ type: "shop/setPrice", placedId: shopId, cents: -1 }).ok).toBe(false);

    const gate = TEST_SITE.gate;
    sim.dispatch({
      type: "build/place",
      pieceId: "coasterkit/stall-toilets",
      x: gate.x + 1,
      z: gate.z - 4,
      rot: 0,
    });
    const loo = sim.placedPieces().find((p) => p.pieceId === "coasterkit/stall-toilets")!;
    // Free facilities stay free (GAME_DESIGN §24) — not a balance dial.
    expect(sim.dispatch({ type: "shop/setPrice", placedId: loo.id, cents: 1_00 }).ok).toBe(false);
  });

  it("survives a save round-trip and keeps the park deterministic", () => {
    const { sim, shopId } = park();
    sim.dispatch({ type: "shop/setPrice", placedId: shopId, cents: 8_50 });
    sim.dispatch({ type: "park/setOpen", open: true });
    sim.advance(400);
    const snapshot = sim.snapshot();
    const resumed = createSim({
      seed: snapshot.seed,
      site: TEST_SITE,
      pieceDefs: TEST_PIECES,
      resumeFrom: structuredClone(snapshot),
    });
    expect(priceOf(resumed, shopId)).toBe(8_50);
    resumed.advance(300);
    sim.advance(300);
    expect(resumed.hash()).toBe(sim.hash());
  });

  it("does not alias the snapshot it was restored from", () => {
    // priceCents is the one mutable field on a placed piece, so a shared
    // object would let a resumed park write back into its own save.
    const { sim, shopId } = park();
    const snapshot = sim.snapshot();
    const resumed = createSim({
      seed: snapshot.seed,
      site: TEST_SITE,
      pieceDefs: TEST_PIECES,
      resumeFrom: snapshot,
    });
    resumed.dispatch({ type: "shop/setPrice", placedId: shopId, cents: 12_00 });
    const inSnapshot = snapshot.world.placed.find((p) => p.id === shopId)!;
    expect(inSnapshot.priceCents).not.toBe(12_00);
  });
});

describe("price reaches the guests and the books", () => {
  it("charges what the shop asks, not the content default", () => {
    const { sim, shopId } = park(9);
    sim.dispatch({ type: "shop/setPrice", placedId: shopId, cents: 6_50 });
    sim.dispatch({ type: "park/setOpen", open: true });
    sim.advance(2_000);
    const food = sim.snapshot().ledger.income.food;
    const meals = sim.snapshot().stats.mealsServed;
    expect(meals).toBeGreaterThan(0);
    // Every sale went through at the set price — no fractional cents, no default.
    expect(food).toBe(meals * 6_50);
  });

  it("prices guests out: a gouging stall serves fewer than a fair one", () => {
    const fair = park(21);
    fair.sim.dispatch({ type: "park/setOpen", open: true });
    fair.sim.advance(3_000);

    const gouge = park(21);
    gouge.sim.dispatch({ type: "shop/setPrice", placedId: gouge.shopId, cents: 20_00 });
    gouge.sim.dispatch({ type: "park/setOpen", open: true });
    gouge.sim.advance(3_000);

    expect(gouge.sim.snapshot().stats.mealsServed).toBeLessThan(
      fair.sim.snapshot().stats.mealsServed,
    );
  });

  it("makes value.shopPrice a cause that can actually fire", () => {
    // Before pricing existed the ratio was hardcoded to 1, so this cause was
    // unreachable — the sub-score carried dead weight.
    const { sim, shopId } = park(31);
    sim.dispatch({ type: "shop/setPrice", placedId: shopId, cents: SHOP_PRICE_CEILING_CENTS });
    sim.dispatch({ type: "park/setOpen", open: true });
    sim.advance(3_000);
    const value = sim.rating().value;
    expect(value.causes.some((c) => c.cause === "value.shopPrice")).toBe(true);
  });
});
