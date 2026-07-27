import { describe, expect, it } from "vitest";
import { createSim, type SimFacade } from "../api";
import { TEST_PIECES, TEST_SITE } from "../testing/fixture";
import { SHOP_DEFS } from "@/content/shops";

/**
 * Park Rating: the five sub-scores, their causes, and the promise that an
 * empty park is never punished into a death spiral (pillar P3).
 */

/** A park with guests actually in it — confidence needs evidence. */
function livingPark(): SimFacade {
  const sim = makePark();
  const gate = TEST_SITE.gate;
  sim.dispatch({
    type: "build/place",
    pieceId: "coasterkit/stall-food",
    x: gate.x - 1,
    z: gate.z - 3,
    rot: 0,
  });
  sim.dispatch({ type: "park/setOpen", open: true });
  sim.advance(1_500);
  return sim;
}

function makePark(): SimFacade {
  const shopPieces = Object.keys(SHOP_DEFS).map((pieceId) => ({
    id: pieceId,
    category: "building" as const,
    footprint: { w: 1, d: 1 },
    cost: SHOP_DEFS[pieceId]!.buildCost,
  }));
  const sim = createSim({
    // Progression is not what this test is about — build from a full palette.
    unlockAll: true,
    seed: 4242,
    parkName: "Rating Test",
    site: TEST_SITE,
    pieceDefs: [...TEST_PIECES, ...shopPieces],
  });
  const gate = TEST_SITE.gate;
  const cells = Array.from({ length: 10 }, (_, i) => ({ x: gate.x, z: gate.z - i }));
  sim.dispatch({ type: "build/paintPath", cells });
  return sim;
}

describe("rating basics", () => {
  it("a brand-new park sits at neutral, never at zero", () => {
    const sim = makePark();
    const rating = sim.rating();
    // Confidence is 0 with no guests, so every sub-score reads the neutral 50.
    expect(rating.confidence).toBe(0);
    expect(rating.fun.score).toBe(50);
    expect(rating.care.score).toBe(50);
    expect(rating.stars).toBeCloseTo(2.5, 1);
  });

  it("weights the five sub-scores 30/20/20/15/15", () => {
    const sim = makePark();
    const rating = sim.rating();
    const weighted =
      (30 * rating.fun.score +
        20 * rating.value.score +
        20 * rating.care.score +
        15 * rating.wonder.score +
        15 * rating.flow.score) /
      100;
    expect(rating.stars).toBeCloseTo(Math.round(((5 * weighted) / 100) * 10) / 10, 1);
  });

  it("reports structured causes, never sentences", () => {
    const sim = makePark();
    const causes = sim.rating().fun.causes;
    expect(causes.length).toBeGreaterThan(0);
    for (const cause of causes) {
      // A cause id + a magnitude — the UI supplies the words (module boundary).
      expect(cause.cause).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
      expect(typeof cause.magnitude).toBe("number");
    }
    expect(causes.some((c) => c.cause === "fun.noRides")).toBe(true);
  });
});

describe("the sub-scores respond to the park", () => {
  it("litter drives Care down and names it as the cause", () => {
    const clean = livingPark();
    const cleanCare = clean.rating().care.score;
    expect(clean.rating().confidence).toBeGreaterThan(0); // guests are watching

    // The same park, filthy: litter strewn over its paths.
    const snapshot = clean.snapshot();
    const shopPieces = Object.keys(SHOP_DEFS).map((pieceId) => ({
      id: pieceId,
      category: "building" as const,
      footprint: { w: 1, d: 1 },
      cost: SHOP_DEFS[pieceId]!.buildCost,
    }));
    const dirty = createSim({
      // Progression is not what this test is about — build from a full palette.
      unlockAll: true,
      seed: snapshot.seed,
      site: TEST_SITE,
      pieceDefs: [...TEST_PIECES, ...shopPieces],
      resumeFrom: {
        ...structuredClone(snapshot),
        litter: Array.from({ length: 40 }, (_, i) => ({
          id: i + 1,
          cellX: TEST_SITE.gate.x,
          cellZ: TEST_SITE.gate.z - (i % 10),
        })),
      },
    });
    dirty.advance(600);
    const after = dirty.rating();
    expect(after.care.score).toBeLessThan(cleanCare);
    expect(after.care.causes.some((c) => c.cause === "care.litter")).toBe(true);
  });

  it("scenery lifts Wonder", () => {
    const sim = livingPark();
    const bare = sim.rating().wonder.score;
    const gate = TEST_SITE.gate;
    for (let i = 0; i < 8; i++) {
      sim.dispatch({
        type: "build/place",
        pieceId: "test/flower",
        x: gate.x + 1 + (i % 4),
        z: gate.z - 1 - Math.floor(i / 4),
        rot: 0,
      });
    }
    expect(sim.rating().wonder.score).toBeGreaterThan(bare);
  });

  it("an empty park and a busy park both stay inside 0..5 stars", () => {
    for (const sim of [makePark(), livingPark()]) {
      const rating = sim.rating();
      expect(rating.stars).toBeGreaterThanOrEqual(0);
      expect(rating.stars).toBeLessThanOrEqual(5);
      for (const sub of [rating.fun, rating.value, rating.care, rating.wonder, rating.flow]) {
        expect(sub.score).toBeGreaterThanOrEqual(0);
        expect(sub.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it("a Consortium loan caps the public rating at 4.5 stars", () => {
    const sim = makePark();
    expect(sim.rating().capStars).toBe(5);
    // Give the park enough assets to clear the debt-ratio gate.
    const rich = createSim({
      // Progression is not what this test is about — build from a full palette.
      unlockAll: true,
      seed: 1,
      site: TEST_SITE,
      pieceDefs: TEST_PIECES,
      resumeFrom: {
        ...structuredClone(sim.snapshot()),
        finance: {
          ...structuredClone(sim.snapshot().finance),
          landValueCents: 200_000_00,
        },
      },
    });
    expect(rich.dispatch({ type: "finance/takeLoan", product: "consortium" }).ok).toBe(true);
    rich.advance(2);
    expect(rich.rating().capStars).toBe(4.5);
  });
});

describe("reading the rating never changes the park", () => {
  it("leaves the hash untouched whether or not rating() was called", () => {
    // The management window polls facade.rating() every sync. stars is saved
    // AND feeds ratingMult → arrivals, so a read that wrote it would make the
    // guest count depend on whether a panel happened to be open.
    const watched = livingPark();
    const ignored = livingPark();
    for (let i = 0; i < 40; i++) {
      watched.rating(); // somebody has the panel open
      watched.advance(25);
      ignored.advance(25);
    }
    expect(watched.hash()).toBe(ignored.hash());
    expect(watched.hud().guestCount).toBe(ignored.hud().guestCount);
  });

  it("starts a fresh park at neutral stars, not zero", () => {
    // stars drives ratingMult (0.6 at 0★). A park that had never opened a
    // panel used to sit at 0★ forever and take a permanent arrivals penalty.
    const sim = makePark();
    expect(sim.snapshot().rating.stars).toBe(2.5);
    expect(sim.hud().ratingStars).toBe(2.5);
    sim.advance(30);
    expect(sim.snapshot().rating.stars).toBeGreaterThan(0);
  });

  it("keeps the stored stars in step with a fresh evaluation", () => {
    const sim = livingPark();
    sim.advance(25 - (sim.hud().tick % 25)); // land on a refresh tick
    expect(sim.snapshot().rating.stars).toBe(sim.rating().stars);
  });
});

describe("cost and persistence", () => {
  it("a full game-month of sampling leaves the windows well-formed", () => {
    // Cost is measured by scripts/bench-guests.ts, not the clock — sim/ has no
    // wall clock at all (CLAUDE.md), and the lint rule enforces that here too.
    const sim = makePark();
    sim.advance(3_000);
    const rating = sim.rating();
    expect(Number.isFinite(rating.stars)).toBe(true);
    expect(rating.stars).toBeGreaterThanOrEqual(0);
    expect(rating.confidence).toBeGreaterThanOrEqual(0);
    expect(rating.confidence).toBeLessThanOrEqual(1);
  });

  it("rating history survives a save round-trip", () => {
    const sim = makePark();
    sim.dispatch({ type: "park/setOpen", open: true });
    sim.advance(1_200);
    const snapshot = sim.snapshot();
    const resumed = createSim({
      // Progression is not what this test is about — build from a full palette.
      unlockAll: true,
      seed: snapshot.seed,
      site: TEST_SITE,
      pieceDefs: TEST_PIECES,
      resumeFrom: structuredClone(snapshot),
    });
    expect(resumed.rating().stars).toBe(sim.rating().stars);
    resumed.advance(300);
    sim.advance(300);
    expect(resumed.hash()).toBe(sim.hash());
  });
});
