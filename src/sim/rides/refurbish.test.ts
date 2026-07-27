import { describe, expect, it } from "vitest";
import { REFURB_COST_RATE } from "@/content/rides";
import { novelty, NOVELTY_PEAK_BONUS, REFURB_NOVELTY_BONUS } from "../rating/rating";
import { createInitialState } from "../state";
import { createSim, TICKS_PER_GAME_MONTH, type SimFacade } from "../api";
import { TEST_PIECES, TEST_SITE } from "../testing/fixture";

/**
 * Refurbishment was M3's "refurbishment + visible aging (M4 economy pass)"
 * deferral. The interesting part is not that it works — it is that it must not
 * restore book value, or a 25% spend would buy back a 55% valuation swing on a
 * fully depreciated ride, and park value is what sets borrowing headroom.
 */

function parkWithFlatRide(seed = 6): { sim: SimFacade; key: number } {
  const sim = createSim({
    seed,
    parkName: "Refurb",
    site: TEST_SITE,
    pieceDefs: TEST_PIECES,
  });
  const gate = TEST_SITE.gate;
  sim.dispatch({
    type: "build/paintPath",
    cells: Array.from({ length: 10 }, (_, i) => ({ x: gate.x, z: gate.z - i })),
  });
  sim.dispatch({
    type: "build/placeFlatRide",
    defId: "teacups",
    x: gate.x + 3,
    z: gate.z - 5,
    rot: 0,
  });
  const ride = sim.ridesView().flat[0]!;
  return { sim, key: ride.key };
}

describe("refurbishing a ride", () => {
  it("charges a quarter of the build cost", () => {
    const { sim, key } = parkWithFlatRide();
    const before = sim.hud().money;
    expect(sim.dispatch({ type: "ride/refurbish", rideId: key }).ok).toBe(true);
    const spent = before - sim.hud().money;
    expect(spent).toBeGreaterThan(0);
    // Teacups cost $6,500 (GAME_BALANCE §5.1) → a quarter of that.
    expect(spent).toBe(Math.round(6_500_00 * REFURB_COST_RATE));
  });

  it("does NOT restore book value — the exploit this rule exists to close", () => {
    const { sim, key } = parkWithFlatRide();
    // Age the ride until depreciation has bitten.
    sim.advance(TICKS_PER_GAME_MONTH * 10);
    const before = sim.finance().valuation.rideValueCents;
    sim.dispatch({ type: "ride/refurbish", rideId: key });
    sim.advance(2);
    const after = sim.finance().valuation.rideValueCents;
    // A refurb buys appeal and reliability, never balance sheet: if this ever
    // RISES, refurbishing becomes an infinite-credit loop against park value.
    // (It may tick down — depreciation keeps running while we look.)
    expect(after).toBeLessThanOrEqual(before);
  });

  it("clears accumulated wear", () => {
    const { sim, key } = parkWithFlatRide(14);
    sim.dispatch({ type: "ride/setState", rideId: key, to: "testing" });
    sim.advance(400);
    sim.dispatch({ type: "ride/setState", rideId: key, to: "open" });
    sim.dispatch({ type: "park/setOpen", open: true });
    sim.advance(2_000);
    expect(sim.ridesView().flat[0]!.cycleCount).toBeGreaterThan(0);
    sim.dispatch({ type: "ride/refurbish", rideId: key });
    expect(sim.ridesView().flat[0]!.cycleCount).toBe(0);
  });

  it("puts novelty back on the curve at ×1.15, decaying again from there", () => {
    // Tested on the pure function: the Fun sub-score is clamped, banded and
    // confidence-blended, so a single ride's novelty change rounds away in the
    // aggregate even though it is doing exactly what it should underneath.
    const state = createInitialState(3, "Refurb", TEST_SITE, TEST_PIECES);
    const built = 0;

    state.tick = 0;
    expect(novelty(state, built, built)).toBeCloseTo(1.4, 5); // opening day

    state.tick = TICKS_PER_GAME_MONTH * 6; // fully worn off
    expect(novelty(state, built, built)).toBeCloseTo(1.0, 5);

    const refurbished = state.tick;
    expect(novelty(state, built, refurbished)).toBeCloseTo(1.15, 5);

    // …and it decays again from there, rather than sticking.
    state.tick = refurbished + TICKS_PER_GAME_MONTH * 1.5;
    expect(novelty(state, built, refurbished)).toBeCloseTo(1.075, 5);
    state.tick = refurbished + TICKS_PER_GAME_MONTH * 3;
    expect(novelty(state, built, refurbished)).toBeCloseTo(1.0, 5);
  });

  it("never restores as much novelty as opening day", () => {
    // §4.1: a new ride is ×1.4, a refurbished one ×1.15. The ceiling is what
    // stops refurbishing from being a substitute for building something new.
    expect(REFURB_NOVELTY_BONUS).toBeLessThan(NOVELTY_PEAK_BONUS);
    expect(REFURB_NOVELTY_BONUS).toBeCloseTo(0.15, 5);
    expect(NOVELTY_PEAK_BONUS).toBeCloseTo(0.4, 5);
  });

  it("is refused when the park cannot pay", () => {
    const { sim, key } = parkWithFlatRide();
    const broke = createSim({
      seed: 1,
      site: TEST_SITE,
      pieceDefs: TEST_PIECES,
      resumeFrom: { ...structuredClone(sim.snapshot()), money: 10 },
    });
    const result = broke.dispatch({ type: "ride/refurbish", rideId: key });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe("not-enough-money");
  });

  it("keeps the park deterministic across a save round-trip", () => {
    const { sim, key } = parkWithFlatRide(19);
    sim.dispatch({ type: "ride/refurbish", rideId: key });
    sim.advance(200);
    const snapshot = sim.snapshot();
    const resumed = createSim({
      seed: snapshot.seed,
      site: TEST_SITE,
      pieceDefs: TEST_PIECES,
      resumeFrom: structuredClone(snapshot),
    });
    resumed.advance(300);
    sim.advance(300);
    expect(resumed.hash()).toBe(sim.hash());
  });
});
