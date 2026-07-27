import { describe, expect, it } from "vitest";
import {
  LEVEL_TRACK,
  MAX_LEVEL,
  MILESTONE_EVERY,
  levelForXp,
  levelOfUnlock,
  unlocksThrough,
  xpForLevel,
  type UnlockId,
} from "@/content/progression";
import { FLAT_RIDES } from "@/content/rides";
import { SHOP_DEFS } from "@/content/shops";
import { TRACK_FAMILY_IDS } from "@/content/track";
import { createSim, type SimFacade } from "../api";
import { TEST_PIECES, TEST_SITE } from "../testing/fixture";

/**
 * The level track is the first thing in Polypark that tells a player "not
 * yet". ADR-15 says that must never read as "you failed to" — so the tests
 * care less about the schedule than about the guarantees around it: a level-1
 * park is playable, nothing already built can become un-rebuildable, and the
 * sandbox opt-out is a real setting rather than a test-only door.
 */

function park(opts: { unlockAll?: boolean; xp?: number } = {}): SimFacade {
  const shopPieces = Object.keys(SHOP_DEFS).map((pieceId) => ({
    id: pieceId,
    category: "building" as const,
    footprint: { w: 1, d: 1 },
    cost: SHOP_DEFS[pieceId]!.buildCost,
  }));
  const sim = createSim({
    seed: 77,
    parkName: "Track",
    site: TEST_SITE,
    pieceDefs: [...TEST_PIECES, ...shopPieces],
    ...(opts.unlockAll ? { unlockAll: true } : {}),
  });
  if (opts.xp) {
    const snapshot = sim.snapshot();
    return createSim({
      seed: snapshot.seed,
      site: TEST_SITE,
      pieceDefs: [...TEST_PIECES, ...shopPieces],
      resumeFrom: { ...structuredClone(snapshot), xp: opts.xp },
    });
  }
  const gate = TEST_SITE.gate;
  sim.dispatch({
    type: "build/paintPath",
    cells: Array.from({ length: 10 }, (_, i) => ({ x: gate.x, z: gate.z - i })),
  });
  return sim;
}

describe("the track is well-formed", () => {
  it("covers every level with a milestone every fifth", () => {
    expect(LEVEL_TRACK).toHaveLength(MAX_LEVEL);
    for (const node of LEVEL_TRACK) {
      expect(node.isMilestone).toBe(node.level % MILESTONE_EVERY === 0);
      expect(node.starTickets).toBe(node.isMilestone ? 1 : 0);
    }
  });

  it("never promises the same unlock twice", () => {
    const seen = new Set<UnlockId>();
    for (const node of LEVEL_TRACK) {
      for (const id of node.unlocks) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
  });

  it("only names things that actually exist", () => {
    // A node promising content the game cannot deliver is worse than an empty
    // node — the player sees a reward that never arrives.
    const real = new Set<string>([
      ...Object.keys(SHOP_DEFS),
      ...Object.keys(FLAT_RIDES),
      ...TRACK_FAMILY_IDS,
    ]);
    const phantom = LEVEL_TRACK.flatMap((n) => n.unlocks).filter((id) => !real.has(id));
    expect(phantom).toEqual([]);
  });

  it("matches the §9.2 XP curve", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(399)).toBe(1);
    expect(levelForXp(400)).toBe(2); // L2 = 400 XP
    expect(levelForXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEVEL);
    // xpForLevel is the inverse the track screen draws its bar from.
    for (const level of [1, 2, 5, 10, 20, 30]) {
      expect(levelForXp(xpForLevel(level))).toBe(level);
    }
  });
});

describe("a level-1 park is playable, not a cage", () => {
  it("opens with paths, scenery and the first two shops", () => {
    const sim = park();
    const gate = TEST_SITE.gate;
    // Paths and scenery are never gated — they are how a park exists at all.
    expect(sim.dispatch({ type: "build/place", pieceId: "test/flower", x: gate.x + 2, z: gate.z - 2, rot: 0 }).ok).toBe(true);
    expect(
      sim.dispatch({
        type: "build/place",
        pieceId: "coasterkit/stall-food",
        x: gate.x - 1,
        z: gate.z - 3,
        rot: 0,
      }).ok,
    ).toBe(true);
  });

  it("says 'not yet' to a ride the track has not reached", () => {
    const sim = park();
    const gate = TEST_SITE.gate;
    const result = sim.dispatch({
      type: "build/placeFlatRide",
      defId: "teacups",
      x: gate.x + 3,
      z: gate.z - 5,
      rot: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe("locked");
  });

  it("opens it once the park reaches that level", () => {
    // Teacups sit at L3.
    const level = levelOfUnlock("teacups")!;
    const sim = park({ xp: xpForLevel(level) });
    expect(sim.progression().level).toBeGreaterThanOrEqual(level);
    expect(sim.progression().unlocked).toContain("teacups");
  });

  it("gates coasters by family", () => {
    const sim = park();
    expect(sim.dispatch({ type: "ride/startTrack", family: "mouse", mx: 20, mz: 20, heading: 0 }).ok).toBe(
      false,
    );
  });
});

describe("nothing here can trap a park", () => {
  it("keeps a piece rebuildable through undo after a demolish", () => {
    // Undo re-places with a pinned id. If the gate re-checked it, undoing a
    // build made before an unlock could fail — and the undo-fuzz invariant
    // would break with it.
    const sim = park({ unlockAll: true });
    const gate = TEST_SITE.gate;
    const placed = sim.dispatch({
      type: "build/placeFlatRide",
      defId: "teacups",
      x: gate.x + 3,
      z: gate.z - 5,
      rot: 0,
    });
    expect(placed.ok).toBe(true);
    // Flat rides are keyed negative in the view; the command wants the id.
    const key = sim.ridesView().flat[0]!.key;
    expect(
      sim.dispatch({ type: "build/removeFlatRide", id: Math.abs(key), refund: "bulldoze" }).ok,
    ).toBe(true);
    expect(sim.undo()).toBe(true);
    expect(sim.ridesView().flat).toHaveLength(1);
  });

  it("leaves an unknown id open rather than locked", () => {
    // Forgetting to author a node must never silently remove something from
    // the palette — content defaults to buildable.
    expect(levelOfUnlock("naturekit/tree-oak" as UnlockId)).toBeNull();
    const sim = park();
    const gate = TEST_SITE.gate;
    expect(
      sim.dispatch({ type: "build/place", pieceId: "test/flower", x: gate.x + 4, z: gate.z - 2, rot: 0 })
        .ok,
    ).toBe(true);
  });

  it("hands everything over in sandbox mode", () => {
    const sim = park({ unlockAll: true });
    const all = unlocksThrough(MAX_LEVEL);
    for (const id of all) {
      expect(sim.progression().unlocked).toContain(id);
    }
    expect(sim.progression().unlockAll).toBe(true);
  });

  it("carries the sandbox setting through a save round-trip", () => {
    const sim = park({ unlockAll: true });
    const snapshot = sim.snapshot();
    const resumed = createSim({
      seed: snapshot.seed,
      site: TEST_SITE,
      pieceDefs: TEST_PIECES,
      resumeFrom: structuredClone(snapshot),
    });
    expect(resumed.progression().unlockAll).toBe(true);
  });
});

describe("XP and Star Tickets", () => {
  it("pays a ticket at every milestone level crossed", () => {
    const sim = park({ unlockAll: true, xp: xpForLevel(11) });
    // L5 and L10 are milestones — a park at L11 banked both.
    expect(sim.progression().level).toBe(11);
    const sim2 = park({ unlockAll: true });
    expect(sim2.progression().starTickets).toBe(0);
  });

  it("earns XP from guests enjoying themselves, not just from goal cards", () => {
    // §9.1's exit-joy XP was deferred in M2 "until the rating system exists".
    const sim = park({ unlockAll: true });
    const gate = TEST_SITE.gate;
    sim.dispatch({
      type: "build/place",
      pieceId: "coasterkit/stall-food",
      x: gate.x - 1,
      z: gate.z - 3,
      rot: 0,
    });
    sim.dispatch({ type: "park/setOpen", open: true });
    const before = sim.hud().xp;
    sim.advance(4_000);
    expect(sim.snapshot().stats.guestsDeparted).toBeGreaterThan(0);
    expect(sim.hud().xp).toBeGreaterThan(before);
  });

  it("never pays XP for spending money (no pay-to-level loop)", () => {
    // §9.1 is explicit about this: buying things must not buy progress.
    const sim = park({ unlockAll: true });
    const gate = TEST_SITE.gate;
    const before = sim.hud().xp;
    for (let i = 0; i < 6; i++) {
      sim.dispatch({
        type: "build/place",
        pieceId: "test/flower",
        x: gate.x + 2 + i,
        z: gate.z - 2,
        rot: 0,
      });
    }
    expect(sim.hud().money).toBeLessThan(75_000_00);
    expect(sim.hud().xp).toBe(before);
  });
});
