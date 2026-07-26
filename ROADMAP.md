# Polypark — Roadmap

Phased plan from empty repo to polished 1.0 (+ the leaderboard finale). Each milestone has a
**demo statement** (what a human can do at its end), deliverables, and acceptance criteria.
A milestone is done only when its criteria pass — features never straddle an unfinished gate.

> ## ⛔ Phase gate: coding has NOT started
> Per the project brief, implementation begins **only after the user explicitly approves**.
> Everything below M‑1 is planned, not started. When approval lands, work begins at M0.

Estimates are working‑session ballparks for one focused developer/agent stream; they order and
scope the work rather than promise dates.

---

## M‑1 · Planning (this deliverable) — ✅ complete

Full documentation suite: GAME_DESIGN, TECHNICAL_ARCHITECTURE, UI_UX_DESIGN, ASSET_GUIDE,
GAME_BALANCE, ROADMAP, DECISIONS, CLAUDE/AGENTS, CHANGELOG, README. Open questions logged in
[docs/DECISIONS.md](docs/DECISIONS.md) §3 with safe defaults — answers refine, don't block.

## M0 · Foundations — "the empty stage" (≈1 week)

Next.js 15 + TS strict + Tailwind v4 + R3F scaffold · module boundaries + lint/dep‑cruiser
rules · CI pipeline (typecheck/lint/test/build + Vercel previews) · design tokens + fonts +
`/dev/uikit` shell · content pipeline v1 (`build-content.ts`: normalize→optimize→catalog for
~40 pilot pieces + thumbnails) · Vitest/Playwright harnesses · save‑format skeleton with
`formatVersion:1`.

**Demo:** deployed Vercel URL shows the title screen (static diorama, working menu shell) at
90+ Lighthouse; `pnpm test` green in CI.
**Accept:** budgets script wired (TECH §10 table encoded) · catalog zod‑validates · boundary
lint fails on a demo violation (proved by a red test then removed).

## M1 · The Tabletop — "walk the empty park" (≈2 weeks)

Island diorama + skybox time‑of‑day · camera rig (UI_UX §8) · grid/cells/chunks in sim ·
placement core (ghost validity, snap, rotate, undo/redo command bus) · path auto‑tiling +
plaza fill · scenery placement with variants · static‑chunk instanced rendering + selection
outline · HUD shell (vitals cluster, build dock, speed controls — fake data where needed) ·
save/load round‑trip of a decorated park.

**Demo:** build and decorate a pathed plaza on the island, save, reload, orbit it at 60 fps.
**Accept:** 10k placed pieces at 60 fps reference (perf smoke) · undo/redo 100‑step fuzz test ·
deterministic state hash test green.

## M2 · Life — "guests arrive" (≈2–3 weeks)

Guest spawner/archetypes · needs/mood/emotes (bubble billboards + cluster chips) · hierarchical
A* + congestion · crowd instanced rendering + hero pool · gate/entry fee · first shops (Snack
Shack, Sip Station, Restroom) with serve loops · litter/vomit + Janitor · money ledger + HUD
tickers · guest inspector card · monthly tick + first Monthly Report screen.

**Demo:** open the gate, watch 300 guests flow, eat, emote and complain; end a month in profit.
**Accept:** 1,200 simulated guests ≤6 ms/tick reference · balance invariants #3/#4 green ·
guest thought log matches sim causes (spot test).

## M3 · Rides & the track builder — "the marquee toy" (≈3 weeks)

Ride FSMs, queues, breakdown/repair + Mechanic · flat‑ride set v1 (Teacups, Carousel, Galleon,
Rocket, Pumpkin Drop) with parametric animation · **track builder** (ports/snapping/validation/
energy check) for Mousetrap + Steelwind, trains kinematics, E/I/N computation + live preview ·
ride inspector (pricing/ops/stats) · Build Catalog screen v1 (roster grid, UI_UX §6.6) ·
double‑click ride‑along camera.

**Demo:** snap a custom Steelwind circuit, test it, open it, ride it, price it, break it, fix it.
**Accept:** track golden‑layout tests (5 canonical circuits validate & score in bands, invariant
#5) · builder rejects all invalid‑port fuzz cases · 60 fps with 6 running coasters + 800 guests.

## M4 · The tycoon layer — "real stakes" (≈2–3 weeks)

Full economy (per‑ride tickets, shop margins, upkeep, wages) · loans/credit/bankruptcy flow ·
event deck + weather system + forecast strip · inspections · Park Rating five sub‑scores +
management panels (Finance/Guests/Staff/Rating/Loans/Marketing) · staff zones for all four
roles · marketing campaigns · Park Level XP + track screen + A/B nodes · remaining rides/shops
(Flume, Poly Express, Karts, Putt Paradise, walkthroughs, Paddle Bay, Marble Cascade, Bistro…).

**Demo:** a full sandbox park from $50k to 4★ through a storm, a failed inspection and a
Consortium loan.
**Accept:** balance invariants #1–#9 all green · event deck 10k‑month statistical test ·
management panels answer the "two‑click rule" audit (UI_UX §7.1).

## M5 · The whole game — "shipping shape" (≈3 weeks)

Title/Hub complete (Career select, Sandbox setup, My Parks incl. export/import, Collection,
Profile) · all 8 scenarios authored + star objectives · tutorial (Sunny Meadows beats +
coach‑marks + Parkopedia + Advisor) · Options screens with rebinding + accessibility set
(GAME_DESIGN §22) · i18n externalization pass · save migrations test matrix · UI_UX §9
acceptance checklist.

**Demo:** a new player goes boot→tutorial→2★ without outside help; a save from M2 still loads.
**Accept:** UI_UX §9 all boxes · keyboard‑only tutorial run · axe‑core clean · scenario 1–3
playtested to target timings (GAME_BALANCE §1).

## M6 · Juice & performance — "feels like a Steam game" (≈2 weeks)

Audio system + sourced CC0 audio set (pending DECISIONS Q‑05) · celebration moments (level‑up
fireworks, star cards) · night lighting polish + photo key · perf hardening: worker migration
if profiling demands (TECH §4.4), LOD tuning, memory audit · quality presets + benchmarks
screen · error telemetry‑free crash guard (local error boundary + save‑rescue) · cross‑browser
pass (Chromium/Firefox/Safari tech preview).

**Demo:** megapark save runs ≥45 fps worst case with audio on; the game *sounds* alive.
**Accept:** all TECH §10 budgets green in CI perf smoke · zero console errors playthrough ·
save‑rescue proven by kill‑test.

## M7 · 1.0 release — "open the gates"

Release checklist: full career playthrough (internal) · docs refreshed (CHANGELOG 1.0.0, README
play link) · licenses/credits screen audited vs ASSET_GUIDE · production Vercel domain · tag
`v1.0.0`.

## M8 · Leaderboard finale (post‑1.0, per brief "very last step")

Share codes + local profile HMAC · `/api/leaderboard` (Vercel Postgres/KV — ADR‑10 decided
here) · publish/unpublish flows · friends compare screen (Rivals‑style stat tiles) · abuse
rate‑limits + sanity bounds · privacy note in‑UI. **Accept:** two fresh browsers exchange codes
and compare published parks on production; deleting unpublishes within one request.

## Post‑1.0 candidate pool (unscheduled, from GAME_DESIGN §24)

Challenge seeds · German localization · terrain height + caves · more kits from reserve packs
(Skate Plaza, Cave Depths…) · photo mode+ · mod/import pipeline · touch layout.

---

### Working agreement (all milestones)

- Every merged PR: green CI, updated CHANGELOG `[Unreleased]`, docs touched when behavior
  diverges from plan (see CLAUDE.md).
- Balance changes land in GAME_BALANCE first, then code.
- Any scope addition needs a DECISIONS entry naming what it displaces (P‑scope guard).
