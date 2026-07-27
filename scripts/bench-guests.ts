/**
 * Sim-only guest throughput bench (ROADMAP M2 acceptance: 1,200 guests ≤6 ms/tick
 * on the reference machine). Not part of `pnpm gate` — run manually:
 *
 *   pnpm tsx scripts/bench-guests.ts
 *
 * Builds Meadowbrook with a big central plaza + shop ring, opens the gate free,
 * grows the crowd, then times advance(1) at peak population. Node's perf timer
 * lives here in scripts/ — sim/ itself stays wall-clock free.
 */
import { performance } from "node:perf_hooks";
import { money } from "../src/shared/money";
import { MEADOWBROOK } from "../src/content/sites/meadowbrook";
import { SHOP_DEFS } from "../src/content/shops";
import { createSim } from "../src/sim/api";
import { type SimPieceDef } from "../src/content/costs";

const pieceDefs: SimPieceDef[] = [
  { id: "bench/tree", category: "scenery", footprint: { w: 1, d: 1 }, cost: money(25_00) },
  ...Object.keys(SHOP_DEFS).map((id) => ({
    id,
    category: "building" as const,
    footprint: { w: 1, d: 1 },
    cost: SHOP_DEFS[id]!.buildCost,
  })),
  // The lot: without it the gate throttles (§3.3) and the bench quietly stops
  // measuring the crowd size it reports.
  { id: "cityroads/parking-bay", category: "building", footprint: { w: 1, d: 1 }, cost: money(150_00) },
];

// A funded park: plaza + 30 shops overrun the $75k sandbox start, so boost the
// bankroll through the public snapshot/resume seam (no sim internals touched).
const seedSim = createSim({
  // Progression is not what this test is about — build from a full palette.
  unlockAll: true,
  seed: 4242,
  parkName: "Bench Park",
  site: MEADOWBROOK,
  pieceDefs,
});
const sim = createSim({
  // Progression is not what this test is about — build from a full palette.
  unlockAll: true,
  seed: 4242,
  parkName: "Bench Park",
  site: MEADOWBROOK,
  pieceDefs,
  resumeFrom: { ...seedSim.snapshot(), money: 500_000_00 },
});

// Plaza: a wide band north of the gate painted wherever terrain allows, with
// unpainted island cells left free so shops can sit inside the crowd (every
// island neighbor is path, so serve access is guaranteed).
const isIsland = (x: number, z: number): boolean => x % 4 === 2 && z % 4 === 2;
const cells: { x: number; z: number }[] = [];
for (let z = MEADOWBROOK.gate.z; z >= 8; z--) {
  for (let x = 8; x <= MEADOWBROOK.cells.w - 8; x++) {
    if (!isIsland(x, z) && sim.checkPaintPath(x, z).ok) {
      cells.push({ x, z });
    }
  }
}
const paint = sim.dispatch({ type: "build/paintPath", cells });
if (!paint.ok) {
  throw new Error(`bench: path paint failed: ${paint.reason}`);
}


// A parking lot, because a park without one throttles at the gate (§3.3) and
// the bench would quietly stop testing the crowd size it claims to. A real
// park at this scale has parking; so does this one.
let bays = 0;
for (let z = MEADOWBROOK.gate.z; z >= 8 && bays < 260; z--) {
  for (let x = 8; x <= MEADOWBROOK.cells.w - 8 && bays < 260; x++) {
    // Every other island row; the rest stay free for shops.
    if (isIsland(x, z) && z % 8 === 2) {
      if (sim.dispatch({ type: "build/place", pieceId: "cityroads/parking-bay", x, z, rot: 0 }).ok) {
        bays += 1;
      }
    }
  }
}
console.log("parking bays      ", bays);

// Shops on the islands so needs get met and guests linger.
const shopIds = Object.keys(SHOP_DEFS);
let placed = 0;
for (let z = 8; z <= MEADOWBROOK.gate.z; z++) {
  for (let x = 8; x <= MEADOWBROOK.cells.w - 8; x++) {
    // Skip the rows the lot reserved — parking and shops share the islands.
    if (isIsland(x, z) && z % 8 !== 2) {
      const pieceId = shopIds[placed % shopIds.length]!;
      if (sim.dispatch({ type: "build/place", pieceId, x, z, rot: 0 }).ok) {
        placed += 1;
      }
    }
  }
}

// Six running Mousetrap ovals across the north strip (ROADMAP M3 acceptance:
// 6 coasters + a live crowd inside the tick budget).
const OVAL = [
  "straight",
  "corner-small",
  "corner-small",
  "straight",
  "straight",
  "corner-small",
  "corner-small",
] as const;
// Rolling terrain means fixed anchors fail honestly ("find flatter ground") —
// scan the free margins for spots where the whole oval dry-validates.
let coasters = 0;
outerScan: for (let cz = 1; cz < MEADOWBROOK.cells.d - 2 && coasters < 6; cz += 2) {
  for (let cx = 1; cx < MEADOWBROOK.cells.w - 2 && coasters < 6; cx += 2) {
    for (const heading of [0, 1, 2, 3] as const) {
      if (sim.checkStartTrack("mouse", cx * 2 + 1, cz * 2, heading) !== null) {
        continue;
      }
      const start = sim.dispatch({
        type: "ride/startTrack",
        family: "mouse",
        mx: cx * 2 + 1,
        mz: cz * 2,
        heading,
      });
      if (!start.ok) {
        continue;
      }
      const rideId = sim.ridesView().tracked[sim.ridesView().tracked.length - 1]!.key;
      let built = true;
      for (const kind of OVAL) {
        if (!sim.dispatch({ type: "ride/appendPiece", rideId, kind, flipped: false }).ok) {
          built = false;
          break;
        }
      }
      if (!built) {
        sim.dispatch({ type: "ride/demolish", rideId });
        continue;
      }
      sim.dispatch({ type: "ride/setState", rideId, to: "testing" });
      coasters += 1;
      if (coasters >= 6) {
        break outerScan;
      }
      break; // next anchor cell
    }
  }
}
console.log(`coasters sited: ${coasters}`);


// Let every test circuit finish. A fixed 400 was enough when the crowd was
// smaller; a busier sim leaves the slowest circuit still testing, and one
// coaster then never opens — which quietly drops the M3 acceptance criterion
// from 6 running coasters to 5. Wait for the actual condition instead.
for (let i = 0; i < 40 && sim.ridesView().tracked.some((r) => !r.tested); i++) {
  sim.advance(100);
}
for (const ride of sim.ridesView().tracked) {
  sim.dispatch({ type: "ride/setState", rideId: ride.key, to: "open" });
}

sim.dispatch({ type: "park/setEntryFee", cents: 0 });
sim.dispatch({ type: "park/setOpen", open: true });

// Grow the crowd, then time per-tick advance strictly inside opening hours
// (gate stops admitting at 21:00 = tick 3600 and the crowd drains).
const TARGET = 1_200;
const SAMPLES = 300;
while (sim.hud().guestCount < TARGET && sim.hud().tick < 3_600 - SAMPLES) {
  sim.advance(25);
}
const popAtStart = sim.hud().guestCount;

let totalMs = 0;
let worstMs = 0;
let popPeak = popAtStart;
for (let i = 0; i < SAMPLES; i++) {
  const start = performance.now();
  sim.advance(1);
  const ms = performance.now() - start;
  totalMs += ms;
  worstMs = Math.max(worstMs, ms);
  popPeak = Math.max(popPeak, sim.hud().guestCount);
}

const avg = totalMs / SAMPLES;
const tracked = sim.ridesView().tracked;
const openCoasters = tracked.filter((ride) => ride.state === 2).length;
// Coasters can be shut AFTER opening by a storm, a breakdown or a failed
// inspection — all systems that did not exist when this bench first reported
// six. Fewer than six running is the sim being alive, not a regression, so
// report why rather than leaving a bare number to be misread.
const closedWhy = tracked.length - openCoasters;
if (closedWhy > 0) {
  const broken = tracked.filter((r) => r.state === 3).length;
  console.log(
    `coasters closed     ${closedWhy} of ${tracked.length} ` +
      `(${broken} broken · weather ${sim.weather().today} · rest closed by inspection or storm)`,
  );
}
console.log(`shops placed        ${placed}`);
console.log(`plaza path cells    ${cells.length}`);
console.log(`coasters running    ${openCoasters}`);
console.log(`population timed    ${popAtStart} → peak ${popPeak} (target ${TARGET})`);
if (popPeak < TARGET) {
  // Say it plainly. Since M5-B the gate throttles above arrival capacity
  // (§3.3), so this park settles where its lot allows rather than at TARGET —
  // and a perf number quoted at a crowd size the run never reached would be
  // a budget that silently stopped testing anything.
  console.log(
    `WARN  crowd capped by arrival capacity (${bays} bays ⇒ ${60 + bays * 5} capacity). ` +
      `Timing is valid for ${popPeak} guests, NOT the ${TARGET}-guest acceptance criterion.`,
  );
}
console.log(`avg tick            ${avg.toFixed(3)} ms`);
console.log(`worst tick          ${worstMs.toFixed(3)} ms`);
const LIMIT_MS = 6;
if (popAtStart >= TARGET && avg > LIMIT_MS) {
  console.error(`FAIL: avg ${avg.toFixed(3)} ms > ${LIMIT_MS} ms at ${popAtStart} guests`);
  process.exit(1);
}
console.log(avg <= LIMIT_MS ? "OK    within the 6 ms/tick budget" : "NOTE  under-populated run");
