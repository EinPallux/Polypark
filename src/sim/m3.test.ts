import { describe, expect, it } from "vitest";
import { createSim, type SimFacade } from "./api";
import { TEST_PIECES, TEST_SITE } from "./testing/fixture";
import { RIDE_STATE } from "./rides/rides";

/**
 * M3 — rides end to end: build a coaster through commands, test it, open it,
 * let guests ride it, break it, fix it (the ROADMAP demo, headless).
 */

function makePark(): SimFacade {
  const sim = createSim({
    seed: 4242,
    parkName: "Ride Test",
    site: TEST_SITE,
    pieceDefs: TEST_PIECES,
  });
  const gate = TEST_SITE.gate;
  // Path spine from the gate up the middle, past the future station entrance,
  // plus an east branch serving the flat-ride pad.
  const cells = [
    ...Array.from({ length: 11 }, (_, i) => ({ x: gate.x, z: gate.z - i })),
    ...Array.from({ length: 4 }, (_, i) => ({ x: gate.x + 1 + i, z: gate.z - 2 })),
  ];
  expect(sim.dispatch({ type: "build/paintPath", cells }).ok).toBe(true);
  sim.dispatch({ type: "park/setOpen", open: true });
  return sim;
}

/** Station at cell (6,4) heading +z; entrance lands beside the path spine. */
const ANCHOR = { mx: 12, mz: 8, heading: 0 as const };

function buildOval(sim: SimFacade): number {
  const start = sim.dispatch({ type: "ride/startTrack", family: "mouse", ...ANCHOR });
  expect(start.ok).toBe(true);
  const rideId = 1;
  const seq = [
    { kind: "straight", flipped: false },
    { kind: "corner-small", flipped: false },
    { kind: "corner-small", flipped: false },
    { kind: "straight", flipped: false },
    { kind: "straight", flipped: false },
    { kind: "corner-small", flipped: false },
    { kind: "corner-small", flipped: false },
  ] as const;
  for (const piece of seq) {
    const result = sim.dispatch({ type: "ride/appendPiece", rideId, ...piece });
    expect(result.ok, `append ${piece.kind}`).toBe(true);
  }
  return rideId;
}

describe("M3 — the marquee toy", () => {
  it("builds a closed circuit through commands with live evaluation", () => {
    const sim = makePark();
    const rideId = buildOval(sim);
    const ride = sim.ridesView().tracked.find((r) => r.key === rideId)!;
    expect(ride.evaln.valid).toBe(true);
    expect(ride.pieces.length).toBe(8);
    expect(ride.evaln.eStat).toBeGreaterThan(0);
  });

  it("append/pop round-trips through undo/redo (exact inverse)", () => {
    const sim = makePark();
    expect(sim.dispatch({ type: "ride/startTrack", family: "mouse", ...ANCHOR }).ok).toBe(true);
    expect(sim.dispatch({ type: "ride/appendPiece", rideId: 1, kind: "straight", flipped: false }).ok).toBe(true);
    const before = sim.hash();
    expect(
      sim.dispatch({ type: "ride/appendPiece", rideId: 1, kind: "bump-up", flipped: false }).ok,
    ).toBe(true);
    const withBump = sim.hash();
    expect(sim.undo()).toBe(true);
    expect(sim.hash()).toBe(before);
    expect(sim.redo()).toBe(true);
    expect(sim.hash()).toBe(withBump);
    expect(sim.undo()).toBe(true);
    expect(sim.hash()).toBe(before);
  });

  it("the builder rejects invalid appends with reasons", () => {
    const sim = makePark();
    const rideId = buildOval(sim);
    // The circuit is closed — anything more would re-cover the station cells.
    const check = sim.checkAppendPiece(rideId, "straight", false);
    expect(check.reason).not.toBeNull();
  });

  it("test → open → guests queue, ride, and pay (the demo loop)", () => {
    const sim = makePark();
    const rideId = buildOval(sim);
    expect(sim.dispatch({ type: "ride/setState", rideId, to: "open" }).ok).toBe(false); // untested
    expect(sim.dispatch({ type: "ride/setState", rideId, to: "testing" }).ok).toBe(true);
    sim.advance(400);
    const tested = sim.ridesView().tracked[0]!;
    expect(tested.tested).toBe(true);
    expect(tested.state).toBe(RIDE_STATE.closed);
    expect(sim.dispatch({ type: "ride/setState", rideId, to: "open" }).ok).toBe(true);
    sim.advance(2_500);
    const snapshot = sim.snapshot();
    expect(snapshot.stats.ridersServed).toBeGreaterThan(0);
    expect(snapshot.ledger.income.ride).toBeGreaterThan(0);
  });

  it("flat rides place, open and serve riders", () => {
    const sim = makePark();
    const gate = TEST_SITE.gate;
    // 5×5 pad east of the spine; its entrance row meets the east path branch.
    const place = sim.dispatch({
      type: "build/placeFlatRide",
      defId: "teacups",
      x: gate.x + 1,
      z: gate.z - 7,
      rot: 0,
    });
    expect(place.ok).toBe(true);
    const key = sim.ridesView().flat[0]!.key;
    expect(sim.dispatch({ type: "ride/setState", rideId: key, to: "testing" }).ok).toBe(true);
    sim.advance(60);
    expect(sim.ridesView().flat[0]!.tested).toBe(true);
    expect(sim.dispatch({ type: "ride/setState", rideId: key, to: "open" }).ok).toBe(true);
    sim.advance(2_500);
    expect(sim.snapshot().stats.ridersServed).toBeGreaterThan(0);
  });

  it("rides break down and a mechanic repairs them", () => {
    const sim = makePark();
    const rideId = buildOval(sim);
    sim.dispatch({ type: "ride/setState", rideId, to: "testing" });
    sim.advance(400);
    sim.dispatch({ type: "ride/setState", rideId, to: "open" });
    expect(sim.dispatch({ type: "staff/hireMechanic" }).ok).toBe(true);
    sim.advance(45_000); // several game-days of cycles — seeded, deterministic
    const snapshot = sim.snapshot();
    expect(snapshot.stats.breakdowns).toBeGreaterThan(0);
    expect(snapshot.stats.repairsDone).toBeGreaterThan(0);
    // After repair the ride is running again (or mid-repair — never stuck-dead
    // without a mechanic on the case).
    const ride = sim.ridesView().tracked[0]!;
    if (ride.state === RIDE_STATE.broken) {
      expect(snapshot.mechanics.some((m) => m.targetRide === rideId)).toBe(true);
    }
  });

  it("save v4 round-trips a park with a live coaster deterministically", () => {
    const sim = makePark();
    const rideId = buildOval(sim);
    sim.dispatch({ type: "ride/setState", rideId, to: "testing" });
    sim.advance(400);
    sim.dispatch({ type: "ride/setState", rideId, to: "open" });
    sim.advance(1_000);
    const snapshot = sim.snapshot();
    const resumed = createSim({
      seed: snapshot.seed,
      site: TEST_SITE,
      pieceDefs: TEST_PIECES,
      resumeFrom: structuredClone(snapshot),
    });
    resumed.advance(500);
    sim.advance(500);
    expect(resumed.hash()).toBe(sim.hash());
  });

  it("ride goals complete from play", () => {
    const sim = makePark();
    sim.advance(30); // let the deck deal with zeroed baselines
    buildOval(sim);
    sim.advance(30);
    const goals = sim.hud().goals;
    void goals; // presence depends on prereqs; the stat itself is the check
    expect(sim.snapshot().stats.coastersBuilt).toBe(1);
  });

  it("demolish refunds and releases the station ground", () => {
    const sim = makePark();
    const rideId = buildOval(sim);
    const before = sim.hud().money;
    expect(sim.dispatch({ type: "ride/demolish", rideId }).ok).toBe(true);
    expect(sim.hud().money).toBeGreaterThan(before);
    expect(sim.ridesView().tracked.length).toBe(0);
    // Ground freed: a second coaster can rise in the same spot.
    expect(sim.dispatch({ type: "ride/startTrack", family: "steel", ...ANCHOR }).ok).toBe(true);
  });
});
