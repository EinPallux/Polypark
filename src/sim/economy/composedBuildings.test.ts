import { describe, expect, it } from "vitest";
import {
  COMPOSED_BUILDINGS,
  COMPOSED_BUILDING_LIST,
  composedBuilding,
} from "@/content/buildings";
import { PILOT_MANIFEST } from "@/content/manifest";
import { levelOfUnlock } from "@/content/progression";
import { SHOP_DEFS, souvenirSecondItemChance } from "@/content/shops";
import { createSim, EMOTE, GUEST_STATE, type SimFacade } from "../api";
import { findShopSites } from "../guests/guests";
import { createInitialState } from "../state";
import { createLedger, restoreLedger, type Ledger } from "./ledgerCore";
import { SHOP_PIECES, TEST_PIECES, TEST_SITE } from "../testing/fixture";

/**
 * The four GAME_DESIGN §10 buildings. Each exists because it does something the
 * three M2 stalls cannot, so each mechanic is pinned here — otherwise "we
 * shipped four buildings" is a claim about the palette, not about the game.
 */

const GATE = TEST_SITE.gate;

/** A park with a path running north from the gate, ready to hang shops off. */
function park(seed = 5, pathLength = 13): SimFacade {
  const sim = createSim({
    unlockAll: true,
    seed,
    parkName: "Composed",
    site: TEST_SITE,
    pieceDefs: [...TEST_PIECES, ...SHOP_PIECES],
  });
  sim.dispatch({
    type: "build/paintPath",
    cells: Array.from({ length: pathLength }, (_, i) => ({ x: GATE.x, z: GATE.z - i })),
  });
  return sim;
}

describe("the four buildings are real content, not names", () => {
  it("gives every one a shop def, a footprint bigger than a stall, and a level", () => {
    for (const def of COMPOSED_BUILDING_LIST) {
      const shop = SHOP_DEFS[def.id];
      expect(shop, def.id).toBeDefined();
      expect(def.parts.length, def.id).toBeGreaterThan(4);
      // A composed building earns its composition by being bigger than the
      // 1×1 stall it would otherwise have been reskinned from.
      expect(def.footprint.w * def.footprint.d, def.id).toBeGreaterThan(1);
      expect(levelOfUnlock(def.id), def.id).not.toBeNull();
    }
  });

  it("builds every part from a pack piece (kit-only law, ADR-16)", () => {
    // No part may be invented. If a composition ever references a piece that
    // is not in the manifest, the building is not made of the packs and the
    // whole content law has been broken quietly.
    const shipped = new Set(PILOT_MANIFEST.map((entry) => entry.id));
    for (const def of COMPOSED_BUILDING_LIST) {
      for (const part of def.parts) {
        expect(shipped.has(part.pieceId), `${def.id} → ${part.pieceId}`).toBe(true);
      }
    }
  });

  it("ships no building-part no composition uses", () => {
    // A building-part exists only to be composed. One left behind after a
    // design change is pure shipped weight — an orphan mesh downloaded by
    // every player and drawn for nobody.
    const used = new Set(COMPOSED_BUILDING_LIST.flatMap((def) => def.parts.map((p) => p.pieceId)));
    const orphans = PILOT_MANIFEST.filter(
      (entry) => entry.category === "building-part" && !used.has(entry.id),
    ).map((entry) => entry.id);
    expect(orphans).toEqual([]);
  });

  it("keeps its parts inside the footprint it claims", () => {
    // A building whose geometry spills past its own cells looks placeable
    // where it is not, and overlaps whatever the player built next door.
    for (const def of COMPOSED_BUILDING_LIST) {
      const halfW = def.footprint.w; // cells are 2 m, so w cells = w metres each side
      const halfD = def.footprint.d;
      for (const part of def.parts) {
        expect(Math.abs(part.pos[0]), `${def.id} x`).toBeLessThanOrEqual(halfW);
        expect(Math.abs(part.pos[2]), `${def.id} z`).toBeLessThanOrEqual(halfD);
      }
    }
  });
});

/**
 * Average a need across the guests who have eaten at the park's one food
 * building, sampling as the day runs. Diners are the only population a
 * shop's after-effects are visible in.
 */
function needOfDiners(
  seed: number,
  pieceId: string,
  need: "thirst" | "energy",
): { avg: number; diners: number } {
  const sim = park(seed);
  // East of the gate path: the test site's west half is pond below z=10.
  expect(sim.dispatch({ type: "build/place", pieceId, x: 9, z: 9, rot: 0 }).ok, pieceId).toBe(
    true,
  );
  sim.dispatch({ type: "park/setOpen", open: true });
  let sum = 0;
  let diners = 0;
  for (let step = 0; step < 25; step++) {
    sim.advance(100);
    const view = sim.guestView();
    for (let slot = 0; slot < view.count; slot++) {
      const guest = sim.guestInfo(slot);
      if (!guest?.thoughts.includes("thought.ate")) {
        continue;
      }
      sum += guest[need];
      diners += 1;
    }
  }
  return { avg: diners ? sum / diners : 0, diners };
}

const thirstOfDiners = (seed: number, pieceId: string) => {
  const result = needOfDiners(seed, pieceId, "thirst");
  return { avgThirst: result.avg, diners: result.diners };
};

describe("Grill Garden makes guests thirsty", () => {
  it("declares a negative secondary, which no other shop does", () => {
    // GAME_BALANCE §6: "Hunger +70, Thirst −5". The salt is the point — it is
    // what links the grill to the drinks stall instead of leaving each shop an
    // independent vending machine.
    const grill = SHOP_DEFS["composed/grill-garden"]!;
    expect(grill.secondary).toEqual({ need: "thirst", amount: -5 });
    const negatives = Object.values(SHOP_DEFS).filter(
      (def) => (def.secondary?.amount ?? 0) < 0,
    );
    expect(negatives).toHaveLength(1);
  });

  it("leaves a fed guest thirstier than a Snack Shack would", () => {
    // Measured over guests who have ACTUALLY EATEN, not over the whole park.
    // Averaged across everyone the −5 vanishes into the base thirst decay of
    // the majority who never reached the counter, and the comparison flips
    // seed to seed — a measurement too noisy to mean anything either way.
    for (const seed of [3, 17]) {
      const grill = thirstOfDiners(seed, "composed/grill-garden");
      const stall = thirstOfDiners(seed, "coasterkit/stall-food");
      expect(grill.diners, `seed ${seed}`).toBeGreaterThan(10);
      expect(grill.avgThirst, `seed ${seed}`).toBeLessThan(stall.avgThirst);
    }
  });
});

describe("Poly Bistro is seated, not a queue", () => {
  it("is the only shop with a seat count, and the only source of Energy", () => {
    const bistro = SHOP_DEFS["composed/poly-bistro"]!;
    expect(bistro.capacity).toBe(40);
    expect(bistro.secondary).toEqual({ need: "energy", amount: 20 });
    const energySources = Object.values(SHOP_DEFS).filter(
      (def) => def.secondary?.need === "energy" && def.secondary.amount > 0,
    );
    expect(energySources).toHaveLength(1);
  });

  it("counts the guests in its seats exactly, and empties them again", () => {
    // Deliberately NOT "peak stays under 40": at the population a test park
    // reaches, a building that fills a guest up by 90 is never asked for 40
    // covers at once, so that assertion passes whether the cap is enforced or
    // deleted. What can be checked, and is what actually breaks, is that the
    // counter tracks reality — a seat leaked on every demolished or
    // interrupted meal would silently close the restaurant forever.
    const sim = park(3);
    expect(
      sim.dispatch({ type: "build/place", pieceId: "composed/poly-bistro", x: 9, z: 9, rot: 0 })
        .ok,
    ).toBe(true);
    sim.dispatch({ type: "park/setOpen", open: true });
    const bistro = sim.placedPieces().find((p) => p.pieceId === "composed/poly-bistro")!;

    let sawDiners = 0;
    for (let step = 0; step < 120; step++) {
      sim.advance(25);
      const view = sim.guestView();
      let serving = 0;
      for (let slot = 0; slot < view.count; slot++) {
        if (view.state[slot] === GUEST_STATE.serving) {
          serving += 1;
        }
      }
      // The Bistro is the only shop in this park, so every guest mid-serve is
      // sitting in it.
      expect(sim.shopOccupancy(bistro.id)).toBe(serving);
      sawDiners = Math.max(sawDiners, serving);
      expect(sim.shopOccupancy(bistro.id)).toBeLessThanOrEqual(40);
    }
    expect(sawDiners).toBeGreaterThan(0);
  });

  it("actually hands Energy back, which nothing else in the park does", () => {
    // The strongest proof that secondary needs are applied at all: energy has
    // no other source anywhere in the game, so a diner leaving the Bistro with
    // more of it than a diner leaving a snack stall can only have got it here.
    for (const seed of [3, 17]) {
      const bistro = needOfDiners(seed, "composed/poly-bistro", "energy");
      const stall = needOfDiners(seed, "coasterkit/stall-food", "energy");
      expect(bistro.diners, `seed ${seed}`).toBeGreaterThan(10);
      expect(bistro.avg, `seed ${seed}`).toBeGreaterThan(stall.avg + 5);
    }
  });

  it("turns over far slower than a snack stall for the same money spent", () => {
    // "High margin, low throughput" (GAME_DESIGN §10) has to be true of the
    // numbers, not just of the blurb: 40 covers per 100 ticks against a stall
    // that clears a guest every 13.
    const bistro = SHOP_DEFS["composed/poly-bistro"]!;
    const stall = SHOP_DEFS["coasterkit/stall-food"]!;
    const bistroPerTick = bistro.capacity! / bistro.serveTicks;
    const stallPerTick = 40 / stall.serveTicks; // same 40 guests, no seat limit
    expect(bistroPerTick).toBeLessThan(stallPerTick);
    const bistroMargin = bistro.defaultPriceCents - bistro.unitCostCents;
    const stallMargin = stall.defaultPriceCents - stall.unitCostCents;
    expect(bistroMargin).toBeGreaterThan(stallMargin * 2);
  });
});

describe("a big building is reachable from any side", () => {
  it("finds a path cell that only touches its far edge", () => {
    // The 4×4 Bistro is placed so the gate path runs along its far side only.
    // Before approach cells were computed from the whole footprint, this
    // building would have been unreachable and silently never used.
    // A short path — only z 15..12 — so it reaches the building's SOUTH-WEST
    // corner cell and nothing else.
    const sim = park(4, 4);
    const bistroX = 9;
    const bistroZ = 9;
    const placed = sim.dispatch({
      type: "build/place",
      pieceId: "composed/poly-bistro",
      x: bistroX,
      z: bistroZ,
      rot: 0,
    });
    expect(placed.ok).toBe(true);
    // The anchor cell (9,9) has no path neighbour: the path column stops at
    // z=12, three rows south. Only footprint cell (9,12) touches it — exactly
    // the case the anchor-only scan used to miss.
    expect(bistroZ + 3).toBe(12);
    sim.dispatch({ type: "park/setOpen", open: true });
    sim.advance(4_000);
    expect(sim.snapshot().stats.mealsServed).toBeGreaterThan(0);
  });
});

describe("the approach scan did not change under existing shops", () => {
  it("still sends guests to the south side of a stall ringed by paths", () => {
    // Generalising the scan from the anchor cell to the whole footprint also
    // changed the order cells are visited — and on a 1×1 shop all four
    // neighbours tie at distance 1, so the ORDER is the answer. Getting this
    // wrong would silently re-route guests around every stall in every
    // existing save while every test still passed.
    const state = createInitialState(1, "Approach", TEST_SITE, [
      ...TEST_PIECES,
      ...SHOP_PIECES,
    ]);
    const w = TEST_SITE.cells.w;
    for (const [x, z] of [
      [8, 7],
      [8, 9],
      [7, 8],
      [9, 8],
    ] as const) {
      state.world.pathCells[z * w + x] = 1;
    }
    state.world.placed.set(1, {
      id: 1,
      pieceId: "coasterkit/stall-food",
      x: 8,
      z: 8,
      rot: 0,
      placedAtTick: 0,
      paidCents: 0,
      priceCents: 6_00,
    });
    const sites = findShopSites(state);
    expect(sites).toHaveLength(1);
    expect({ x: sites[0]!.approachX, z: sites[0]!.approachZ }).toEqual({ x: 8, z: 9 });
  });
});

describe("Gift Kiosk sells souvenirs, and rating sets the basket", () => {
  it("books takings as retail rather than hiding them in facilities", () => {
    const kiosk = SHOP_DEFS["composed/gift-kiosk"]!;
    expect(kiosk.ledgerCategory).toBe("retail");
    expect(kiosk.effect).toBe("souvenir");
    expect(kiosk.satisfies).toBe("fun");
  });

  it("scales the second item from nothing at 1★ to everyone at 5★", () => {
    expect(souvenirSecondItemChance(1)).toBe(0);
    expect(souvenirSecondItemChance(0.5)).toBe(0); // clamped, never negative
    expect(souvenirSecondItemChance(5)).toBe(1);
    expect(souvenirSecondItemChance(6)).toBe(1); // clamped, never over one
    expect(souvenirSecondItemChance(3)).toBeCloseTo(0.5, 5);
  });

  it("earns retail income from guests who wanted a good time", () => {
    const sim = park(21);
    const placed = sim.dispatch({
      type: "build/place",
      pieceId: "composed/gift-kiosk",
      x: 9,
      z: 11,
      rot: 0,
    });
    expect(placed.ok).toBe(true);
    sim.dispatch({ type: "park/setOpen", open: true });
    sim.advance(2_500); // within the first month — see the note above
    const income = sim.snapshot().ledger.income;
    expect(income.retail).toBeGreaterThan(0);
    // And it did NOT land in the facility bucket it used to have to share.
    expect(income.facility).toBe(0);
  });
});

describe("running out of energy is not the park's fault", () => {
  it("sends worn-out guests home tired rather than furious", () => {
    // Energy decays on a fixed clock and, before the Bistro, nothing in the
    // game gave it back — so this branch was blaming the park for the passage
    // of time, in a park that had done nothing wrong.
    const sim = park(7);
    // Everything a guest could want, so energy is the only need that empties.
    for (const [pieceId, x, z] of [
      ["coasterkit/stall-food", 9, 11],
      ["coasterkit/stall-drinks", 7, 9],
      ["coasterkit/stall-toilets", 9, 8],
    ] as const) {
      expect(sim.dispatch({ type: "build/place", pieceId, x, z, rot: 0 }).ok, pieceId).toBe(
        true,
      );
    }
    sim.dispatch({ type: "park/setOpen", open: true });

    let wornOut = 0;
    let angryWhileWornOut = 0;
    for (let step = 0; step < 40; step++) {
      sim.advance(50);
      const view = sim.guestView();
      for (let slot = 0; slot < view.count; slot++) {
        const info = sim.guestInfo(slot);
        if (!info?.thoughts.includes("thought.wornOut")) {
          continue;
        }
        wornOut += 1;
        if (view.emote[slot] === EMOTE.angry) {
          angryWhileWornOut += 1;
        }
      }
    }
    expect(wornOut).toBeGreaterThan(0);
    expect(angryWhileWornOut).toBe(0);
  });
});

describe("guests complain about what the park could have built", () => {
  it("grumbles about missing food but never about nowhere to rest", () => {
    // Both needs go unserved in this empty park. Missing food is the park's
    // fault from level one; missing Energy is not, because the only building
    // that restores it unlocks at L13 — so grumbling about it every twenty
    // ticks would be a complaint the player cannot act on yet.
    const sim = park(13);
    sim.dispatch({ type: "park/setOpen", open: true });
    const thoughts = new Set<string>();
    for (let step = 0; step < 40; step++) {
      sim.advance(50);
      const view = sim.guestView();
      for (let slot = 0; slot < view.count; slot++) {
        for (const thought of sim.guestInfo(slot)?.thoughts ?? []) {
          thoughts.add(thought);
        }
      }
    }
    expect(thoughts.has("thought.no.hunger")).toBe(true);
    expect(thoughts.has("thought.no.energy")).toBe(false);
  });
});

describe("the ledger survives gaining a category", () => {
  it("fills in buckets a save predates instead of going NaN", () => {
    // A v5 save has no `retail` key. Cloning it straight through would make
    // the park's first souvenir sale `undefined + 1200`.
    const old = createLedger();
    const legacy = {
      ...old,
      income: Object.fromEntries(
        Object.entries(old.income).filter(([key]) => key !== "retail"),
      ),
    } as unknown as Ledger;
    expect(legacy.income.retail).toBeUndefined();

    const restored = restoreLedger(legacy);
    expect(restored.income.retail).toBe(0);
    expect(restored.income.retail + 1_200).toBe(1_200);
  });

  it("keeps the values a save does carry", () => {
    const saved = createLedger();
    saved.income.food = 4_200;
    saved.expense.wages = 900;
    const restored = restoreLedger(saved);
    expect(restored.income.food).toBe(4_200);
    expect(restored.expense.wages).toBe(900);
  });
});

describe("compositions place and demolish as one piece", () => {
  it("claims its whole footprint and gives it all back", () => {
    const sim = park(11);
    const def = COMPOSED_BUILDINGS["composed/grill-garden"];
    const before = sim.placedPieces().length;
    const result = sim.dispatch({ type: "build/place", pieceId: def.id, x: 9, z: 11, rot: 0 });
    expect(result.ok).toBe(true);
    // One placed piece, not thirteen — the sim never sees the parts list.
    expect(sim.placedPieces().length).toBe(before + 1);
    const placed = sim.placedPieces().find((p) => p.pieceId === def.id)!;

    // A second building overlapping the first must be refused — proof the
    // whole 3×2 footprint is claimed, not just the anchor cell.
    const overlap = sim.dispatch({ type: "build/place", pieceId: def.id, x: 10, z: 11, rot: 0 });
    expect(overlap.ok).toBe(false);

    sim.dispatch({ type: "build/remove", id: placed.id, refund: "exact" });
    expect(sim.placedPieces().find((p) => p.id === placed.id)).toBeUndefined();
    // Cleared ground takes the building again.
    expect(
      sim.dispatch({ type: "build/place", pieceId: def.id, x: 9, z: 11, rot: 0 }).ok,
    ).toBe(true);
  });

  it("resolves every composition id to its definition", () => {
    for (const def of COMPOSED_BUILDING_LIST) {
      expect(composedBuilding(def.id)).toBe(def);
    }
    expect(composedBuilding("coasterkit/stall-food")).toBeUndefined();
  });
});
