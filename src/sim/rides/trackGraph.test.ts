import { describe, expect, it } from "vitest";
import {
  advancePose,
  energyWalk,
  evaluateTrack,
  openEndPose,
  pieceCells,
  samePose,
  type TrackPieceState,
  type TrackPose,
} from "./trackGraph";

const START: TrackPose = { mx: 0, mz: 0, level: 0, heading: 0 };
const p = (kind: TrackPieceState["kind"], flipped = false): TrackPieceState => ({
  kind,
  flipped,
});

describe("pose math", () => {
  it("straight advances 4 m forward, flipped identical", () => {
    expect(advancePose(START, p("straight"))).toEqual({ mx: 0, mz: 4, level: 0, heading: 0 });
    expect(advancePose(START, p("straight", true))).toEqual({ mx: 0, mz: 4, level: 0, heading: 0 });
  });

  it("corner-small turns left; flipped turns right", () => {
    expect(advancePose(START, p("corner-small"))).toEqual({ mx: -2, mz: 2, level: 0, heading: 3 });
    expect(advancePose(START, p("corner-small", true))).toEqual({
      mx: 2,
      mz: 2,
      level: 0,
      heading: 1,
    });
  });

  it("left then flipped-left chains into an S returning to the original heading", () => {
    const after = openEndPose(START, [p("corner-small"), p("corner-small", true)]);
    expect(after).toEqual({ mx: -4, mz: 4, level: 0, heading: 0 });
  });

  it("hill climbs +2 levels; flipped drops −2", () => {
    expect(advancePose(START, p("hill")).level).toBe(2);
    expect(advancePose(START, p("hill", true)).level).toBe(-2);
  });

  it("loop shifts one meter left in either traversal (mirror symmetry)", () => {
    expect(advancePose(START, p("loop"))).toEqual({ mx: -1, mz: 4, level: 0, heading: 0 });
    expect(advancePose(START, p("loop", true))).toEqual({ mx: -1, mz: 4, level: 0, heading: 0 });
  });

  it("four left corners close a diamond", () => {
    const pieces = [p("corner-small"), p("corner-small"), p("corner-small"), p("corner-small")];
    expect(samePose(openEndPose(START, pieces), START)).toBe(true);
  });

  it("heading rotation covers all four directions", () => {
    let pose = START;
    const seen = new Set<number>();
    for (let i = 0; i < 4; i++) {
      seen.add(pose.heading);
      pose = advancePose(pose, p("corner-large"));
    }
    expect(seen.size).toBe(4);
    expect(samePose(pose, START)).toBe(true);
  });
});

describe("occupancy", () => {
  it("straight covers a 1×2-cell strip", () => {
    const cells = pieceCells(START, p("straight"));
    const keys = cells.map((c) => `${c.cellX},${c.cellZ}`).sort();
    expect(keys).toEqual(["-1,0", "-1,1", "0,0", "0,1"]);
  });

  it("flipped pieces cover the same world area as their forward twin from the far end", () => {
    // Forward corner from START ends at (-2,2,h3). A flipped corner entered
    // where the forward one EXITS (heading reversed) must cover the same cells.
    const fwd = pieceCells(START, p("corner-small"));
    const exit = advancePose(START, p("corner-small"));
    const back = pieceCells(
      { ...exit, heading: ((exit.heading + 2) % 4) as 0 | 1 | 2 | 3 },
      p("corner-small", true),
    );
    const key = (c: { cellX: number; cellZ: number }): string => `${c.cellX},${c.cellZ}`;
    expect(new Set(back.map(key))).toEqual(new Set(fwd.map(key)));
  });
});

describe("energy model", () => {
  it("a chain hill carries a slow train up", () => {
    const walk = energyWalk([p("station"), p("hill"), p("hill")]);
    expect(walk.fail).toBeUndefined();
    expect(walk.runs[1]!.chained).toBe(true);
    expect(walk.runs[2]!.vOut).toBeGreaterThan(3);
  });

  it("an unpowered climb valleys out", () => {
    // bump-up crest of 0.5 m repeated with no speed source drains the launch.
    const walk = energyWalk([p("station"), p("bump-up"), p("bump-up"), p("bump-up"), p("bump-up")]);
    expect(walk.fail?.reason).toBe("valleyed");
  });

  it("a loop straight out of the station is too slow", () => {
    const walk = energyWalk([p("station"), p("loop")]);
    expect(walk.fail?.reason).toBe("loop-too-slow");
  });

  it("drops trade height for speed", () => {
    const walk = energyWalk([p("station"), p("hill"), p("hill"), p("hill", true), p("hill", true)]);
    expect(walk.fail).toBeUndefined();
    const drop = walk.runs[3]!;
    expect(drop.vOut).toBeGreaterThan(drop.vIn);
  });
});

/**
 * The five canonical circuits (ROADMAP M3 acceptance, GAME_BALANCE inv #5).
 * Each closes by construction: lateral/forward/level deltas sum to zero and
 * headings return to north. The looper's two loops shift +2 m combined
 * (heading south), canceled by the north-leg S-curve's −2 m.
 */
function circuits(): Record<string, TrackPieceState[]> {
  return {
    // 1. Starter oval: two 8 m legs joined by U-turns.
    oval: [
      p("station"),
      p("straight"),
      p("corner-small"),
      p("corner-small"),
      p("straight"),
      p("straight"),
      p("corner-small"),
      p("corner-small"),
    ],
    // 2. Lift-and-drop oval — one story up, dive back down on the far side.
    liftDrop: [
      p("station"),
      p("hill"),
      p("corner-small"),
      p("corner-small"),
      p("hill", true),
      p("straight"),
      p("corner-small"),
      p("corner-small"),
    ],
    // 3. Airtime out-and-back with a hump on the descending return leg.
    airtime: [
      p("station"),
      p("hill"),
      p("hill"),
      p("corner-small"),
      p("corner-small"),
      p("hill", true),
      p("hill-half", true),
      p("bump-up"),
      p("hill-half", true),
      p("corner-small"),
      p("corner-small"),
      p("straight"),
    ],
    // 4. Double-loop marquee: 5-hill chain lift, full dive, two loops home.
    looper: [
      p("station"),
      p("hill"),
      p("hill"),
      p("hill"),
      p("hill"),
      p("hill"),
      p("curve"),
      p("corner-small"),
      p("corner-small"),
      p("hill", true),
      p("hill", true),
      p("hill", true),
      p("hill", true),
      p("hill", true),
      p("loop"),
      p("loop"),
      p("corner-small"),
      p("corner-small"),
    ],
    // 5. Mousetrap ladder: two-stage climb, switchback S-pairs, two dives
    //    and an airtime hump on the run home (mouse builds run ≥18 pieces).
    mouse: [
      p("station"),
      p("hill"),
      p("hill-half"),
      p("corner-small"),
      p("corner-small", true),
      p("corner-small", true),
      p("corner-small"),
      p("corner-small"),
      p("corner-small"),
      p("hill", true),
      p("corner-small"),
      p("corner-small", true),
      p("corner-small", true),
      p("corner-small"),
      p("hill-half", true),
      p("bump-up"),
      p("corner-small"),
      p("corner-small"),
    ],
  };
}

describe("golden layouts (invariant #5: canonical circuits validate and score in bands)", () => {
  it("all five circuits close and validate", () => {
    for (const [name, pieces] of Object.entries(circuits())) {
      const evaln = evaluateTrack(START, pieces, 0.2);
      expect(evaln.valid, `${name}: ${evaln.reason ?? "ok"} at ${evaln.failAt ?? "-"}`).toBe(true);
    }
  });

  it("scores land in their designed excitement bands", () => {
    const c = circuits();
    const score = (pieces: TrackPieceState[]): ReturnType<typeof evaluateTrack> =>
      evaluateTrack(START, pieces, 0.2);
    const oval = score(c.oval!);
    const liftDrop = score(c.liftDrop!);
    const airtime = score(c.airtime!);
    const looper = score(c.looper!);
    const mouse = score(c.mouse!);
    // Gentle starter stays mild.
    expect(oval.eStat).toBeLessThan(4);
    expect(oval.nStat).toBeLessThan(3);
    // Adding a drop beats the flat oval.
    expect(liftDrop.eStat).toBeGreaterThan(oval.eStat);
    // Airtime bumps raise excitement further.
    expect(airtime.eStat).toBeGreaterThan(liftDrop.eStat);
    // The looper is the thrill peak: inversions push E and I up.
    expect(looper.inversions).toBe(2);
    expect(looper.eStat).toBeGreaterThan(airtime.eStat);
    expect(looper.iStat).toBeGreaterThan(5);
    expect(looper.nStat).toBeGreaterThan(2);
    // The mouse ladder is twisty: lateral snap without loop-level nausea.
    expect(mouse.drops).toBeGreaterThanOrEqual(1);
    expect(mouse.eStat).toBeGreaterThan(3);
    expect(mouse.nStat).toBeLessThan(looper.nStat + 1);
    // Everything scores inside 0..10 by construction.
    for (const s of [oval, liftDrop, airtime, looper, mouse]) {
      for (const v of [s.eStat, s.iStat, s.nStat]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(10);
      }
    }
  });

  it("scenery proximity raises excitement, all else equal", () => {
    const bare = evaluateTrack(START, circuits().liftDrop!, 0);
    const lush = evaluateTrack(START, circuits().liftDrop!, 1);
    expect(lush.eStat).toBeGreaterThan(bare.eStat);
  });
});

describe("invalid-layout rejection (builder fuzz)", () => {
  it("an open track is not a circuit", () => {
    const evaln = evaluateTrack(START, [p("station"), p("straight")], 0);
    expect(evaln.valid).toBe(false);
    expect(evaln.reason).toBe("not-closed");
  });

  it("random piece soup never validates as a closed circuit by accident — and never crashes", () => {
    // Deterministic LCG fuzz: 300 random layouts; the checker must reject any
    // that do not return exactly to the station (pose equality is exact).
    let seed = 1234567;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    const kinds: TrackPieceState["kind"][] = [
      "straight",
      "corner-small",
      "corner-large",
      "curve",
      "hill",
      "hill-half",
      "bump-up",
      "loop",
    ];
    let validCount = 0;
    for (let i = 0; i < 300; i++) {
      const pieces: TrackPieceState[] = [p("station")];
      const len = 3 + Math.floor(rand() * 12);
      for (let j = 0; j < len; j++) {
        pieces.push(p(kinds[Math.floor(rand() * kinds.length)]!, rand() < 0.5));
      }
      const evaln = evaluateTrack(START, pieces, 0);
      if (evaln.valid) {
        validCount += 1;
        expect(samePose(openEndPose(START, pieces), START)).toBe(true);
      }
    }
    // Random soup closing a circuit AND passing energy is astronomically rare.
    expect(validCount).toBeLessThanOrEqual(1);
  });
});
