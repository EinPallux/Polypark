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
];

// A funded park: plaza + 30 shops overrun the $75k sandbox start, so boost the
// bankroll through the public snapshot/resume seam (no sim internals touched).
const seedSim = createSim({
  seed: 4242,
  parkName: "Bench Park",
  site: MEADOWBROOK,
  pieceDefs,
});
const sim = createSim({
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

// Shops on the islands so needs get met and guests linger.
const shopIds = Object.keys(SHOP_DEFS);
let placed = 0;
for (let z = 8; z <= MEADOWBROOK.gate.z; z++) {
  for (let x = 8; x <= MEADOWBROOK.cells.w - 8; x++) {
    if (isIsland(x, z)) {
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
sim.advance(400); // let every test circuit finish
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
const openCoasters = sim
  .ridesView()
  .tracked.filter((ride) => ride.state === 2).length;
console.log(`shops placed        ${placed}`);
console.log(`plaza path cells    ${cells.length}`);
console.log(`coasters running    ${openCoasters}`);
console.log(`population timed    ${popAtStart} → peak ${popPeak} (target ${TARGET})`);
console.log(`avg tick            ${avg.toFixed(3)} ms`);
console.log(`worst tick          ${worstMs.toFixed(3)} ms`);
const LIMIT_MS = 6;
if (popAtStart >= TARGET && avg > LIMIT_MS) {
  console.error(`FAIL: avg ${avg.toFixed(3)} ms > ${LIMIT_MS} ms at ${popAtStart} guests`);
  process.exit(1);
}
console.log(avg <= LIMIT_MS ? "OK    within the 6 ms/tick budget" : "NOTE  under-populated run");
