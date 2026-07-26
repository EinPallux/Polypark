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

## M1 · The Valley — "walk the empty landscape" (≈2–3 weeks)

**Terrain system first** (TECH §6.4/§4.7): site descriptor format + Meadowbrook authored ·
heightmap terrain mesh with splat shader, water plane, vegetation scatter + wind, haze +
time‑of‑day skyboxes · slope‑classed grid projected onto terrain · camera rig (UI_UX §8) ·
placement core on terrain (ghost validity, auto‑foundations, snap, rotate, undo/redo command
bus) · path auto‑tiling as organic ribbons + plaza fill · scenery placement with variants ·
static‑chunk instanced rendering + selection outline · HUD shell (vitals cluster, build dock,
speed controls — fake data where needed) · save/load round‑trip of a decorated site.

**Demo:** wander a lush Meadowbrook at golden hour, lay a winding path over a hill, decorate,
save, reload, orbit at 60 fps — and it looks like the Aquapark reference, not a board game.
**Accept:** terrain+veg within budget (TECH §10) with 10k placed pieces at 60 fps reference ·
placement golden tests per slope class · undo/redo 100‑step fuzz · deterministic state hash ·
no visible grid outside build mode (eyeball checklist).

## M2 · Life — "guests arrive" (≈2–3 weeks)

Guest spawner/archetypes (gate‑side arrivals until Parking lands in M4; country‑road car
flavor) · needs/mood/emotes (bubble billboards + cluster chips) · hierarchical A* + congestion ·
crowd instanced rendering + hero pool · gate/entry fee · first shops (Snack Shack, Sip Station,
Restroom) with serve loops · litter/vomit + Janitor · money ledger + HUD tickers · guest
inspector card · monthly tick + first Monthly Report screen · **Goal Deck engine v1** (card
pools, dealing, progress — the guidance backbone arrives with the first guests).

**Demo:** open the gate, watch 300 guests flow, eat, emote and complain; complete three goal
cards; end a month in profit.
**Accept:** 1,200 simulated guests ≤6 ms/tick reference · balance invariants #3/#4/#11 green ·
guest thought log matches sim causes (spot test) · goal cards never block or force (API has no
"required" concept — reviewed).

## M3 · Rides & the track builder — "the marquee toy" (≈3 weeks)

Ride FSMs, queues, breakdown/repair + Mechanic · flat‑ride set v1 (Teacups, Carousel, Galleon,
Rocket, Pumpkin Drop) with parametric animation · **track builder** (ports/snapping/validation/
energy check) for Mousetrap + Steelwind, trains kinematics, E/I/N computation + live preview ·
ride inspector (pricing/ops/stats) · Build Catalog screen v1 (roster grid, UI_UX §6.6) ·
double‑click ride‑along camera.

**Demo:** snap a custom Steelwind circuit, test it, open it, ride it, price it, break it, fix it.
**Accept:** track golden‑layout tests (5 canonical circuits validate & score in bands, invariant
#5) · builder rejects all invalid‑port fuzz cases · 60 fps with 6 running coasters + 800 guests.

## M4 · The tycoon layer — "real stakes" (≈3 weeks)

Full economy (per‑ride tickets, shop margins, upkeep, wages) · loans/credit + **Receivership**
(no game‑over) flow · event deck + weather system + forecast strip · inspections · Park Rating
five sub‑scores + management panels (Finance/Guests/Staff/Rating/Loans/Marketing/Districts) ·
staff zones for all four roles · marketing campaigns · Park Level XP + track screen + A/B
nodes · **districts framework + Parking Grounds + Resort Row** (arrival capacity, hotels,
flavor traffic) · remaining rides/shops (Flume, Poly Express, Karts, Putt Paradise,
walkthroughs, Paddle Bay, Marble Cascade, Bistro…).

**Demo:** a full sandbox park from $50k to 4★ through a storm, a failed inspection and a
Consortium loan; sink into Receivership on purpose and climb back out; hotels fill for night
hours behind a busy parking lot.
**Accept:** balance invariants #1–#12 all green · event deck 10k‑month statistical test ·
management panels answer the "two‑click rule" audit (UI_UX §7.1).

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
