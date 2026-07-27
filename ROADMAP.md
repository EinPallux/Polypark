# Polypark — Roadmap

Phased plan from empty repo to polished 1.0 (+ the leaderboard finale). Each milestone has a
**demo statement** (what a human can do at its end), deliverables, and acceptance criteria.
A milestone is done only when its criteria pass — features never straddle an unfinished gate.

> ## ✅ Phase gate opened 2026‑07‑26
> The owner approved implementation ("Yes Start M0"). **M0 is in progress** on branch
> `claude/new-session-9m1bb2`. Milestone status is tracked here as work lands.

Estimates are working‑session ballparks for one focused developer/agent stream; they order and
scope the work rather than promise dates.

---

## M‑1 · Planning — ✅ complete (incl. owner Q&A 2026‑07‑26)

Full documentation suite: GAME_DESIGN, TECHNICAL_ARCHITECTURE, UI_UX_DESIGN, ASSET_GUIDE,
GAME_BALANCE, ROADMAP, DECISIONS, CLAUDE/AGENTS, CHANGELOG, README. Owner answers to Q‑01…Q‑07
and four directives (kit‑only content law, districts scope, real terrain, sandbox‑first with no
hard end) are incorporated — see [docs/DECISIONS.md](docs/DECISIONS.md) ADR‑13…17.

## M0 · Foundations — "the empty stage" — ✅ complete 2026‑07‑26

Shipped: Next.js 15 + TS strict + Tailwind v4 + R3F scaffold · module boundaries enforced by
ESLint AND dependency‑cruiser · CI workflow (content drift → typecheck → lint → boundaries →
unit → build → budgets → e2e) · design tokens + self‑hosted fonts + `/dev/uikit` gallery ·
content pipeline v1 (42 pilot pieces optimized + zod‑validated catalog + 42 thumbnails via
`/dev/thumbs`) · Vitest (28 tests: money, RNG, stepper, golden‑seed determinism, save
round‑trip/migrations) + Playwright (7 smoke tests) · save format `formatVersion:1` with
migration chain · title screen with live 3D diorama + hub/options/extras shells.

**Acceptance verified:** budgets script encodes TECH §10 (title route 104.6 KB gz of 300 KB
budget) · catalog zod‑validates (42 pieces) · boundary rules proven red on a demo violation in
both enforcers, then removed · full local gate green.
**Owner step:** connect the repo to Vercel (framework auto‑detected) for preview/production
URLs; Lighthouse pass lands with the first preview.

## M1 · The Valley — "walk the empty landscape" — ✅ complete 2026‑07‑26

Shipped: landform‑descriptor terrain system (ADR‑19) with Meadowbrook authored (rolling meadow,
NE hill, SW pond, treeline rim) · vertex‑colored heightfield (grass patchiness, sandy shores,
rocky steeps, gravel halos under paths) + pond water + time‑of‑day sun/fog/sky · deterministic
vegetation scatter (instanced, site‑seeded) · slope‑classed grid (flat/gentle/steep per
GAME_DESIGN §5) · placement core with ghost validity + reasons, R‑rotation, per‑tile terrain
tilt, drag path painting with `ground_path*` auto‑tiling (incl. T/cross/plaza tiles), bulldoze
with the §3.2 refund policy, full undo/redo (exact‑inverse commands with pinned‑id replay) ·
camera rig (LMB‑free MapControls, WASD/Q/E/Home) · in‑game HUD v1 (money/clock/speed/dock/
toasts/hints), scenery palette with pipeline thumbnails, pause menu · IndexedDB quicksave +
autosave + save‑on‑hide; save format v2 with v1 migration; title CONTINUE + hub My Parks live ·
save formatVersion 2 migration chain · `?bench=N` perf harness.

**Acceptance:** placement golden tests per slope class + water · auto‑tile resolution tests ·
100‑step undo/redo fuzz (undo‑all ≡ initial modulo monotonic ids; redo‑all ≡ exact final) ·
golden‑seed determinism with build commands · save round‑trip + v1→v2 migration · e2e: build →
money oracle → save → continue restores state · no grid outside build modes (build‑mode‑only
overlay by construction). **Frame‑rate note:** container GL is software‑rendered, so the
60 fps/10k‑piece check runs on real GPUs via the Vercel preview + `?bench=10000` (owner
eyeball); CI asserts everything else.

## M2 · Life — "guests arrive" — ✅ complete 2026‑07‑26

Shipped: guest sim on SoA typed arrays (cap 1,500) with the five archetypes, wallets, seeded
variants and staggered decision ticks · needs/mood per GAME_BALANCE §4.3 with thought log +
emote bubbles (EmotesPack billboards) · A* routing on path cells with LRU cache invalidated on
edits; gate‑forecourt walkability so day‑one parks route · gate open/close + entry fee
steppers (fee → ledger on entry; §4.1 M2 interim arrivals/elasticity model) · Snack Shack /
Sip Station / Restroom serve loops with per‑serving margins and litter · Janitors
(hire/fire, nearest‑litter pursuit, month‑end wages) · double‑entry‑lite money ledger + monthly
tick + Monthly Report modal · guest inspector card (needs bars + recent thoughts) · **Goal Deck
engine v1** (12 cards across guidance/growth/mastery, deal‑to‑3, dismiss+cooldown, prereq
stats, XP + level curve §9.2) with the HUD goal panel · crowd instanced rendering (per‑variant
pools, interpolated positions, walk bob, click‑to‑inspect) + janitor uniforms + litter bits ·
save format v3 (guests/ledger/goals/stats) with v2→v3 migration; HUD v2 (guest ticker, XP
chip, staff popover).

**Acceptance:** bench `scripts/bench-guests.ts` — 1,229→1,500 live guests at **1.19 ms/tick
avg (3.2 ms worst)** on the software‑GL container, vs the 6 ms budget · invariants #3/#4/#11
green in `src/sim/m2.test.ts` (need‑decay floor, default‑price stall profitable, goals never
block/force — the card type has no "required" concept) · determinism hash + save v3 round‑trip
with a living crowd · thought‑log spot test via the guest inspector (browser session) · e2e:
open gate → guests counted in HUD → hire janitor. **Deferred, named:** hierarchical A* +
congestion (plain A* + cache ships; revisit at M6 perf pass) · vomit + First Aid (with rides,
M3) · emote cluster chips + hero guest pool (M6 polish) · country‑road car flavor (M4 Parking) ·
shop price editing UI ✅ **shipped in the M4→M5 debt pass**.

## M3 · Rides & the track builder — ✅ complete 2026‑07‑26

Shipped: **the track builder** for Steelwind (steel) + Mousetrap (mouse) — measured port
metadata for 12 piece kinds (`src/content/track.ts`), 1 m pose lattice with 0.5 m levels,
attach‑by‑either‑end flipping (drops and right turns are mirrored twins for free), occupancy
rasterization with terrain/clearance/track‑stacking rules, piecewise‑constant energy model
(chain lifts engage on would‑stall climbs; loops demand entry speed; valleys/overspeed reject
with builder‑readable reasons) and live E/I/N per GAME_BALANCE §5.3 · ride FSMs
closed→testing→open→broken with test‑before‑open, virtual FIFO entrance queues, boarding/
fares/fun payouts by archetype E‑band, breakdown rolls (MTBF × age × coverage) · Mechanics
(hire/fire, nearest‑job dispatch, 20–60 game‑min repairs, $950/mo wages) · trains playing back
the measured speed profile (interpolated cars, hill pitch, full 360° loop sweep) · flat‑ride
set v1 — Teacup Twirl, Critter Carousel, Galleon Swing, Rocket Orbit, Pumpkin Drop — as pure
kit compositions with parametric spin/swing/drop programs (P7: pad tiles, supports, pirate
ship, rockets, pumpkins, CubePets mounts) · builder UI (piece palette filtered by live
dry‑runs, mirror toggle, circuit status, cost ticker), ride inspector (test/open/close, ±price,
stats, queue/riders/cycles, edit/demolish), RIDES dock palette with roster · double‑click
ride‑along chase camera (Esc hops off) · rides join arrivals appeal + fairEntry (§4.1 M3 note)
and the ledger (ride income category, per‑piece upkeep, mechanic wages) · save v4 with v3
migration · 5 new goal cards.

**Acceptance:** golden‑layout tests — 5 canonical circuits (starter oval, lift‑and‑drop,
airtime out‑and‑back, double‑loop marquee, mouse switchback ladder) validate and score in
designed E/I/N bands (invariant #5) · 300‑layout invalid‑port fuzz: nothing invalid ever
validates, nothing crashes · bench: **6 running coasters + 1,261–1,500 live guests at
2.26 ms/tick avg (7.3 ms worst)** vs the 6 ms budget (`scripts/bench-guests.ts`; frame‑rate on
real GPUs via Vercel preview, owner eyeball — same posture as M1) · e2e: snap a Mousetrap
circuit through the real UI → circuit closes with live stats → test → open · live probe:
teacups placed/tested/opened via roster + inspector, guests admitted, fares collected.
**Deferred, named:** painted queue‑path pieces (virtual queues ship; CoasterKit queue tiles
land M4) · banked "skew" pieces + Sky Serpent/Splashlog families (M5 coaster depth) · Build
Catalog screen v1 (M4, with the tycoon layer's unlock surface) · refurbishment + visible aging
(M4 economy pass) · staff pathfinding on paths (mechanics beeline; M4 staff polish).

## M4 · The tycoon layer — "real stakes" (≈3 weeks)

Full economy (per‑ride tickets, shop margins, upkeep, wages) · loans/credit + **Receivership**
(no game‑over) flow · event deck + weather system + forecast strip · inspections · Park Rating
five sub‑scores + management panels (Finance/Guests/Staff/Rating/Loans/Marketing/Districts) ·
staff zones for all four roles · marketing campaigns · Park Level XP + track screen + A/B
nodes · **districts framework + Parking Grounds + Resort Row** (arrival capacity, hotels,
flavor traffic) · remaining rides/shops (Flume, Poly Express, Karts, Putt Paradise,
walkthroughs, Paddle Bay, Marble Cascade, Bistro…).

**Scope call (owner‑approved 2026‑07‑27):** M4 ships as **money, rating and risk** — the
"real stakes" identity — and the rest moves to M5. The original line was more than one
coherent milestone; the precedent M1/M2/M3 set is to ship the coherent core and name the
deferrals with reasons.

**Shipping in M4:** full economy · loans/credit + Receivership · Park Rating (five sub‑scores
with plain‑language causes) · marketing campaigns · difficulty presets · weather chain +
3‑day forecast strip · event deck (7 cards) · safety inspections · the management window
(Finance/Rating/Loans/Marketing).

**Deferred, named, with reasons:**
- **Districts framework + Parking Grounds + Resort Row** → M5. Needs the land‑value writer and
  arrival‑capacity model; Resort Row is load‑bearing on night hours, which is itself M5.
- **Park Level track + unlock gating + A/B nodes + Star Tickets** → M5. Gating breaks every
  existing test and the bench until an `unlockAll` sandbox flag lands; that is a milestone's
  worth of churn on its own.
- **Staff zones for all four roles** → M5. The v4→v5 staff migration merges two id spaces *and*
  changes a coordinate unit.
- **Remaining rides/shops** → M5. Shipping nine ride families on top of four new subsystems is
  exactly what breaks a milestone. The shops half (Bistro et al.) goes with them.
- **Guests/Staff/Districts management panels** → M5, with the systems they would report on.
- **4 event cards** (vandal night, hygiene scare, lost kid, refurb subsidy) → M5; each needs a
  system that does not exist, and a card with no visible effect is worse than no card.
- **Night hours** → M5 (needs the lamps rule + a lighting rig ROADMAP already puts in M6). The
  demo statement below is amended accordingly.

**Demo:** a sandbox park from $75k to 4★ through a storm, a failed inspection and a Consortium
loan; sink into Receivership on purpose and climb back out.
**Accept:** balance invariants #1–#12 all green · event deck 10k‑month statistical test ✅ ·
management window answers the "two‑click rule" audit (UI_UX §7.1) ✅.

## M5 · The whole game — "shipping shape" (≈3 weeks)

Title/Hub complete (My Parks with Site select + settings incl. hard‑fail toggle, Story select,
export/import, Collection, Profile) · remaining Sites (Riverbend, Hillcrest) + all 8 Stories
authored with star objectives · **Guidance layer** (opening card chains, coach‑marks,
Parkopedia, Advisor — never forcing, GAME_DESIGN §20) · remaining districts (**Arrival
Station, Staff Village, Commerce Quarter, Works Yard**) · Options screens with rebinding +
accessibility set (GAME_DESIGN §23) · i18n externalization pass · save migrations test
matrix · UI_UX §9 acceptance checklist.

**Demo:** a new player goes boot→first park→2★ guided only by goal cards they could have
ignored; a save from M2 still loads; a story park keeps living after its 3rd star.
**Accept:** UI_UX §9 all boxes · keyboard‑only guided‑opening run · axe‑core clean · Stories
1–3 playtested to target timings (GAME_BALANCE §1) · "never forced" audit: zero blocking
steps outside modals listed in UI_UX §7.4.

## M6 · Juice & performance — "feels like a Steam game" (≈2 weeks)

Audio system + Kenney CC0 audio packs added to `/assets` (owner‑approved Q‑05, logged in
ASSET_GUIDE §7) · celebration moments (level‑up
fireworks, star cards) · night lighting polish + photo key · perf hardening: worker migration
if profiling demands (TECH §4.4), LOD tuning, memory audit · quality presets + benchmarks
screen · error telemetry‑free crash guard (local error boundary + save‑rescue) · cross‑browser
pass (Chromium/Firefox/Safari tech preview).

**Demo:** megapark save runs ≥45 fps worst case with audio on; the game *sounds* alive.
**Accept:** all TECH §10 budgets green in CI perf smoke · zero console errors playthrough ·
save‑rescue proven by kill‑test.

## M7 · 1.0 release — "open the gates"

Release checklist: full Stories playthrough + a 10‑hour sandbox park (internal) · docs
refreshed (CHANGELOG 1.0.0, README play link) · licenses/credits screen audited vs ASSET_GUIDE
· production Vercel domain · tag `v1.0.0`.

## M8 · Leaderboard finale (post‑1.0, per brief "very last step")

Share codes + local profile HMAC · `/api/leaderboard` (Vercel Postgres/KV — ADR‑10 decided
here) · publish/unpublish flows · friends compare screen (Rivals‑style stat tiles) · abuse
rate‑limits + sanity bounds · privacy note in‑UI. **Accept:** two fresh browsers exchange codes
and compare published parks on production; deleting unpublishes within one request.

## Post‑1.0 candidate pool (unscheduled, from GAME_DESIGN §25)

Challenge seeds · player terraforming + caves · additional Sites · more kits from reserve packs
(Skate Plaza, Cave Depths…) · photo mode+ · mod/import pipeline · touch layout · localization
(English‑only at 1.0 per Q‑03).

---

### Working agreement (all milestones)

- Every merged PR: green CI, updated CHANGELOG `[Unreleased]`, docs touched when behavior
  diverges from plan (see CLAUDE.md).
- Balance changes land in GAME_BALANCE first, then code.
- Any scope addition needs a DECISIONS entry naming what it displaces (P‑scope guard).
