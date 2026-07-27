import { describe, expect, it } from "vitest";
import {
  EVENT_CARDS,
  EVENT_CARD_LIST,
  EVENT_IDS,
  INSPECTION_PASS_SCORE,
  type EventId,
} from "@/content/events";
import { DIFFICULTY_MODS } from "@/content/difficulty";
import { SHOP_DEFS } from "@/content/shops";
import { createSim, TICKS_PER_GAME_MONTH, type SimFacade } from "../api";
import { TEST_PIECES, TEST_SITE } from "../testing/fixture";
import { deckMonthClose, inspectionScore } from "./deck";
import { createInitialState } from "../state";

/**
 * The deck's job is to make months differ from each other without ever making
 * a park unrecoverable (ADR-15). So the tests care about two things: the draw
 * is a sane distribution that respects its own cooldowns, and nothing it does
 * can compound.
 */

function park(seed = 11): SimFacade {
  const shopPieces = Object.keys(SHOP_DEFS).map((pieceId) => ({
    id: pieceId,
    category: "building" as const,
    footprint: { w: 1, d: 1 },
    cost: SHOP_DEFS[pieceId]!.buildCost,
  }));
  const sim = createSim({
    seed,
    parkName: "Deck",
    site: TEST_SITE,
    pieceDefs: [...TEST_PIECES, ...shopPieces],
  });
  const gate = TEST_SITE.gate;
  sim.dispatch({
    type: "build/paintPath",
    cells: Array.from({ length: 10 }, (_, i) => ({ x: gate.x, z: gate.z - i })),
  });
  return sim;
}

/** A bare state we can drive month-by-month without paying for a full sim. */
function bareState(seed = 3) {
  return createInitialState(seed, "Deck", TEST_SITE, TEST_PIECES);
}

describe("the deck is a well-formed distribution", () => {
  it("gives every card a positive weight and a cooldown", () => {
    for (const id of EVENT_IDS) {
      const def = EVENT_CARDS[id];
      expect(def.weight).toBeGreaterThan(0);
      expect(def.cooldownMonths).toBeGreaterThan(0);
      expect(def.durationDays).toBeGreaterThanOrEqual(0);
    }
    expect(EVENT_CARD_LIST).toHaveLength(EVENT_IDS.length);
  });

  it("leaves Rain, Storm and Heatwave to the weather chain", () => {
    // §8.1a: a three-day forecast cannot promise what a card might spring.
    for (const id of ["rain", "storm", "heatwave"]) {
      expect(EVENT_IDS as readonly string[]).not.toContain(id);
    }
  });

  it("never draws a card inside its own cooldown, over 10k months", () => {
    // The ROADMAP's named M4 acceptance criterion.
    const state = bareState(4242);
    state.lastMonthGuests = 500;
    const lastSeen: Partial<Record<EventId, number>> = {};
    const drawn: Record<string, number> = {};
    let violations = 0;
    for (let month = 1; month <= 10_000; month++) {
      state.monthNumber = month;
      for (const event of deckMonthClose(state)) {
        if (event.kind !== "event/drawn" || !event.card) continue;
        const previous = lastSeen[event.card];
        if (previous !== undefined && month - previous < EVENT_CARDS[event.card].cooldownMonths) {
          violations += 1;
        }
        lastSeen[event.card] = month;
        drawn[event.card] = (drawn[event.card] ?? 0) + 1;
      }
    }
    expect(violations).toBe(0);
    // Every card that can fire without rides did fire — no card is dead data.
    // sponsor-offer is absent on purpose: it needs an open ride, and this
    // bare state has none — that prerequisite working IS the assertion.
    for (const id of ["litter-wave", "tax-audit"] as const) {
      expect(drawn[id] ?? 0).toBeGreaterThan(0);
    }
  });

  it("draws at roughly the difficulty's advertised rate", () => {
    for (const difficulty of ["relaxed", "standard", "tycoon"] as const) {
      const state = createInitialState(77, "Deck", TEST_SITE, TEST_PIECES, { difficulty });
      state.lastMonthGuests = 500;
      let total = 0;
      const months = 4_000;
      for (let month = 1; month <= months; month++) {
        state.monthNumber = month;
        total += deckMonthClose(state).filter((e) => e.kind === "event/drawn").length;
      }
      const rate = total / months;
      const target = DIFFICULTY_MODS[difficulty].eventsPerMonth;
      // Cooldowns and prerequisites hold the realised rate at or under target;
      // it must never EXCEED what the difficulty table promises.
      expect(rate).toBeLessThanOrEqual(target + 0.05);
      expect(rate).toBeGreaterThan(0);
    }
  });
});

describe("nothing the deck does can compound", () => {
  it("goes quiet during Receivership", () => {
    // A rescue, not a pile-on: the recovery chain has to be winnable.
    const state = bareState(9);
    state.lastMonthGuests = 500;
    state.finance.receivership.active = true;
    let drawnCount = 0;
    for (let month = 1; month <= 200; month++) {
      state.monthNumber = month;
      drawnCount += deckMonthClose(state).filter((e) => e.kind === "event/drawn").length;
    }
    expect(drawnCount).toBe(0);
  });

  it("expires every timed effect instead of stacking it", () => {
    const state = bareState(12);
    state.lastMonthGuests = 500;
    for (let month = 1; month <= 600; month++) {
      state.monthNumber = month;
      state.tick = month * TICKS_PER_GAME_MONTH;
      deckMonthClose(state);
      // Active effects are bounded by the card count — if they stacked, this
      // would climb without limit over 600 months.
      expect(state.deck.active.length).toBeLessThanOrEqual(EVENT_IDS.length);
    }
  });

  it("keeps failed inspections from spiralling", () => {
    // Failures add citations, which DECAY. Repeated failures must not push
    // Care to a floor the player cannot climb off.
    const state = bareState(21);
    for (let i = 0; i < 30; i++) {
      state.monthNumber = state.deck.nextInspectionMonth;
      deckMonthClose(state);
    }
    expect(Number.isFinite(state.rating.citations.total)).toBe(true);
    expect(state.rating.pressStars).toBeGreaterThanOrEqual(-0.5);
  });
});

describe("inspections", () => {
  it("scores a clean, quiet park as a pass", () => {
    // No broken rides, no citations, no crowding — this should clear the bar.
    const state = bareState(1);
    expect(inspectionScore(state)).toBeGreaterThanOrEqual(INSPECTION_PASS_SCORE);
  });

  it("reschedules within the §8.1 jitter window", () => {
    const state = bareState(33);
    const seen: number[] = [];
    for (let i = 0; i < 40; i++) {
      const due = state.deck.nextInspectionMonth;
      state.monthNumber = due;
      deckMonthClose(state);
      seen.push(state.deck.nextInspectionMonth - due);
    }
    // 3 months ±2 weeks, rounded to whole months → 2, 3 or 4.
    for (const gap of seen) {
      expect(gap).toBeGreaterThanOrEqual(2);
      expect(gap).toBeLessThanOrEqual(4);
    }
    expect(new Set(seen).size).toBeGreaterThan(1); // the jitter is real
  });

  it("never schedules the first inspection on opening week", () => {
    expect(bareState().deck.nextInspectionMonth).toBeGreaterThanOrEqual(3);
  });
});

describe("persistence", () => {
  it("survives a save round-trip with the deck state intact", () => {
    const sim = park(8);
    sim.dispatch({ type: "park/setOpen", open: true });
    sim.advance(TICKS_PER_GAME_MONTH + 50);
    const snapshot = sim.snapshot();
    const resumed = createSim({
      seed: snapshot.seed,
      site: TEST_SITE,
      pieceDefs: TEST_PIECES,
      resumeFrom: structuredClone(snapshot),
    });
    expect(resumed.snapshot().deck).toEqual(snapshot.deck);
    resumed.advance(300);
    sim.advance(300);
    expect(resumed.hash()).toBe(sim.hash());
  });
});
