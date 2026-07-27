# Changelog

All notable changes to Polypark are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) ·
versioning: [SemVer](https://semver.org/) once code exists (pre‑1.0 minor bumps may break saves
only where a migration ships — see TECHNICAL_ARCHITECTURE §8).

## [Unreleased]

### M5‑A — Progression: the level track, unlocks and Star Tickets
- **The park now has a shape over time.** Everything was buildable from minute one; the Park
  Level track (GAME_BALANCE §9.2) hands content over as the park grows — L1 Snack Shack + Sip
  Station through L14 Pumpkin Drop, with Mousetrap at L6 and Steelwind at L12. Gating covers
  `build/place`, `build/placeFlatRide` and `ride/startTrack`, failing with a `locked` reason
  that reads as "not yet", never "you failed to" (ADR‑15).
- **Locked ≠ hidden.** The palette shows every ride greyed, wearing the level it arrives at, so
  the palette *is* the roadmap — and a new Progress tab lays out the whole ladder in one place.
  Hiding locked content would make the palette feel arbitrary instead of anticipatory.
- **Two guardrails the tests pin.** Paths and scenery are never gated — they are how a park
  exists at all. And an id the track never mentions defaults to *buildable*, so a missing node
  can never silently remove something from the palette.
- **`unlockAll` is a real park setting, not a test backdoor** (`?unlockAll=1`). It landed in
  the same change as the gate, which is what kept 177 existing tests from going red at once,
  and it means the suite exercises a path players can actually take.
- **XP finally comes from running a park.** §9.1's exit‑joy XP (1/2/4/6 by departing mood) and
  the monthly rating bonus (rating × 60) were deferred in M2 "until the rating system exists" —
  it does now, so the level curve advances from guests enjoying themselves rather than only
  from ticking goal cards. Spending money still pays nothing: no pay‑to‑level loop, asserted.
- **Star Tickets** are banked at every milestone level and shown in the identity chip, which
  had been hardcoded to `0` since M0.
- The level curve moved from `goals/` to `content/progression.ts` — it is balance data, and
  unlocks read it too.

### M5‑B — Districts: the park becomes a resort
- **Polypark stops being only a ride park.** Districts (GAME_DESIGN §6) are plots you buy once;
  **Parking Grounds** and **Resort Row** ship their buildables, and all six are authored so the
  remaining four are a content file each and no framework change. The unshipped four are listed
  as "coming soon" rather than hidden — the shape of the resort is part of the pitch.
- **Arrival capacity is a taper, not a ceiling.** §3.3 reads as a hard 60‑concurrent cap; taken
  literally that deletes a game which benches at 1,200–1,500 guests. Shipped as
  `max((capacity/live)^0.6, 0.15)` — continuous, monotonic and floored, so a full lot slows the
  gate but can never shut it. Tests pin monotonicity and the floor, because a taper that let
  more guests *speed up* the gate would make the park oscillate.
- **Buying a plot is the only way land value grows**, and land value feeds the valuation that
  sets borrowing headroom — without it The Consortium is permanently unreachable however well
  the park does. That connection is now closed and tested.
- **Resort Row** rooms pay nightly against the park's rating and cost upkeep whether or not
  they sold, so over‑building is a real mistake rather than a free bet.
- **Fixed: the valuation cache never saw a land purchase.** `computeValuation` is memoized on
  `worldVersion`, which only `build/`, `ride/` and `shop/` commands bumped — so buying a plot
  raised land value while the valuation kept serving a stale number, and borrowing headroom
  would not widen until some unrelated build happened to invalidate the cache. Caught by the
  test written for the feature, not by inspection.
- **+6 kit pieces** (parking bay, lot road, lot light, cabin, hotel block, hedge) from
  CityKitRoads and CityKitSuburban → 104 pieces, 2.3 MB shipped.
- **Save migration matrix** (ROADMAP M5 acceptance): `save.test.ts` only ever exercised the
  runner against a *fabricated* table, so nothing proved a real v1 save still opens. The real
  chain now runs v1→v5 and validates against the live schema — the only test that would notice
  a field added without a migration to seed it. It passes, which means five format versions of
  additions have all been complete.
- **⚠️ Open: the perf budget no longer reaches its 1,200-guest criterion.** The capacity taper
  is doing exactly what it should, and the consequence is that a park with a modest lot settles
  near 480 concurrent guests instead of ~1,250. The bench now says so out loud rather than
  quoting a timing at a crowd size the run never reached. Two things need an owner call: whether
  ~430 is the right ceiling for a park with **no** parking at all, and how the perf criterion
  should be exercised now that the economy governs population.

### M4 — The tycoon layer (🚧 in progress)
- **Finance spine (`src/sim/economy/finance.ts`, `amortize.ts`):** three loan products with
  APRs locked at origination off an A–E credit grade (GAME_BALANCE §8.2), a park valuation
  (rides + pieces + paths + land, depreciating 2%/mo to a 45% floor) that gates borrowing at a
  65% debt ratio, and a 7‑phase month close — accrue, sweep, amortize, arrears, grade, sweep
  profit, settle. `minPaymentCents` rounds **up** and monthly interest rounds **down**, and the
  doc comment carries the induction proof that a loan therefore always amortizes to exactly $0
  within term (invariant #6, 20k‑case fuzz).
- **Receivership, not game over (ADR‑15, GAME_DESIGN §14.3):** N insolvent months open an
  administration that freezes marketing, caps construction at $1,000/item, sweeps half of each
  profitable month against the oldest debt and halves interest — for at most 6 months, exiting
  when debts are current and cash ≥ $0. No save can end. A new `refocusForReceivership()`
  returns non‑recovery goal cards to the pool on entry, because three full slots would
  otherwise mean the recovery chain never deals.
- **Park Rating (`src/sim/rating/rating.ts`):** Fun 30 · Value 20 · Care 20 · Wonder 15 ·
  Flow 15 over O(1) exponentially‑weighted month windows, each sub‑score reporting structured
  top causes (`fun.noRides`, `care.litter`, optionally a ride key) that the UI turns into
  sentences. **Confidence blending** — `50 + confidence × (raw − 50)` with confidence maxing at
  25 guest‑months — means an empty park reads 2.5★ instead of 0★, so a slow opening can never
  spiral (pillar P3). Rating feeds arrivals (×0.6–1.6); a live Consortium loan caps the
  displayed stars at 4.5.
- **Marketing + difficulty:** three campaigns that buy arrivals and skew *which* archetypes
  arrive (GAME_BALANCE §8.3), and Relaxed/Standard/Tycoon presets whose 9 modifiers are derived
  on load, never serialized, so retuning reaches existing parks (§8.4).
- **Management window (`src/ui/game/ManagementWindow.tsx`):** MANAGE dock button and `M` open
  one tabbed window — Finance (cash, park value, debt, asset breakdown), Rating (stars, five
  weighted bars, each expanding to its top‑3 causes in plain language), Loans (credit grade,
  live loans with payoff, three offers with the blocking reason on the button), Marketing. A
  receivership banner explains what the administrator is doing. HUD vitals now show real stars,
  outstanding debt and a receivership pill. Escape closes the window before the pause menu.
- **Commands & save v5:** `finance/takeLoan`, `finance/payLoan`, `marketing/start` as
  operational (non‑undoable) commands with replay pins so redo reproduces identical state;
  receivership spend denial at five sites, bypassed when internal pins are present so undoing
  a pre‑receivership build still works. Save v5 migrates v4 forward (standard difficulty, empty
  finance, $20,000 land, zeroed rating windows). `ledgerCore.ts` extracted as a leaf module to
  break a real finance↔ledger runtime cycle.
- **Fixed: the rating was written by a read query.** `facade.rating()` — which the management
  window polls on every sync — wrote the persisted `rating.stars`, and stars feeds
  `ratingMult` → arrivals. Two identical parks diverged (hash `13eca40b` vs `662cb637`) purely
  because one had the panel open. `tickRating` is now the sole writer, refreshing every 25
  ticks off the sim tick; `evaluateRating` is pure. Related: a fresh park's stars were seeded
  at 0, so a park nobody had opened a panel on took a permanent ×0.6 arrivals penalty — the
  exact death spiral confidence blending exists to prevent. Seeded at neutral 2.5★ in both
  creation and the v4→v5 migration. Three regression tests, each verified failing first.
- **Fixed: blank copy from unchecked i18n keys.** Keys built from content ids reach `t()`
  through a cast, so 17 were missing with no compiler complaint — M3's five ride goal cards
  had been rendering as empty goal titles since it shipped, and M4's loan and campaign names
  were blank. All added; `t()` now echoes an unknown key instead of rendering nothing; and
  `src/ui/i18n/i18n.test.ts` proves every goal card, loan, campaign, ride and rating cause
  resolves to real copy. Month counts pluralize ("1 month", not "1 months").
- **One coherent calendar:** the code carried `TICKS_PER_GAME_DAY = 7200` next to a 3,000‑tick
  month, so a "day" outlasted a "month" and the report fired ~2.4× per displayed day — visible
  in the HUD, harmless only because the constant was dead code. GAME_DESIGN §16 already said
  four day/night cycles per month, so a park day is 750 ticks. What was missing from the docs
  is *why* the hands may sweep 24 h across 750 ticks: Polypark runs a literal **duration**
  clock (needs, cycles, repairs) and a stylised **park** clock (the HUD, anything
  day‑quantised). §16 now says so, and `parkClock()` is the single source of truth.
- **Weather (`src/sim/weather/`):** a five‑kind Markov chain over park days — sunny, overcast,
  rain, storm, heatwave — drawn three days ahead and *persisted*, so the forecast strip is a
  promise the sim keeps rather than a guess it re‑rolls (P5). Storms never brew from a clear
  sky, a new park always opens sunny, and long‑run shares are asserted against §8.1a. Weather
  multiplies arrivals (the `weatherMult` term §4.1 always specified and nothing supplied); a
  heatwave multiplies Thirst decay **and nothing else** — the extra drink income follows from
  thirstier guests, so the doc's ×1.8 income bonus is deliberately not implemented. Storms shut
  open coasters and reopen only what they closed.
- **Event deck + inspections (`src/sim/events/`):** 7 cards at the difficulty's advertised rate,
  cooldowns and prerequisites respected over a 10k‑month run (the ROADMAP's named M4 acceptance
  criterion). `eventsPerMonth` is an expectation, not a count. Nothing compounds: timed effects
  expire, Care penalties decay through `addCitations`, and the deck goes **silent during
  Receivership** — a rescue, not a pile‑on. Inspections every 2–4 months fine the park and close
  its busiest ride until the player reopens it.
- **Two doc readings that could not be implemented as written**, both now recorded in
  GAME_BALANCE rather than left as silent divergence: inspection jitter of "±2 weeks" rounds to
  exactly zero on a month‑close boundary (so it is ±1 month), and First Aid is 20% of the
  inspection score but does not exist yet (so that share reads mechanic coverage until M5).
- **Adding an RNG stream no longer breaks saves.** `deserializeRngStreams` threw on a stream a
  save predated, which would have bricked every park the moment `weather` landed; it now derives
  a missing stream from the root seed — exactly what a fresh park does.
- **Quality:** 158 unit tests (8 amortization, 17 finance, 12 rating, 12 weather, 11 deck,
  10 i18n, 5 park clock); new e2e opens the management window, borrows, and reads the rating
  through the real UI. Bench 1.83 ms/tick at 1,251–1,500 guests with 6 coasters (6 ms budget).

### Debt pass — overdue deferrals from M2/M3, paid before M5
- **Per‑shop pricing** (M2 → M3 → shipped, two milestones late). Shops charged a content
  constant: no state, no command, no UI. That left a real hole, not a missing nicety —
  Value's `value.shopPrice` cause hardcoded `ratio: 1`, so the tycoon layer scored the player
  on a lever they had no way to touch, and GAME_BALANCE §4.3's archetype price tolerance had
  been specified since M2 without a single reader. Price now lives on the placed piece, so two
  Snack Shacks can differ and demolish/undo carry it. Guests weigh price against archetype
  tolerance and need pressure; a gouging stall provably serves fewer guests at the same seed.
  Free facilities stay free (GAME_DESIGN §24). Click a shop in inspect mode to price it, with
  the "guests think $9 is steep" hint GAME_BALANCE §6 always asked for.
- **Ride refurbishment** (M3 → shipped). 25% of build cost buys back novelty (to ×1.15, §4.1's
  own number, decaying again from there) and clears accumulated wear. It deliberately does
  **not** restore book value: depreciation floors at 45%, so resetting the age would turn a 25%
  spend into a 55% valuation gain — and park value sets borrowing headroom, making that an
  infinite‑credit loop.
- **Staff pathfinding** (M3 → shipped). Mechanics walked straight lines across the grass. They
  now follow the path network, with the beeline surviving as a deliberate fallback so a ride
  with no route to it can never strand a mechanic — tested by bulldozing every path in the park
  and asserting repairs still complete. `findPath` moved from `guests/` to `world/pathfind.ts`;
  it is a property of the grid, and its old home is exactly why `rides.ts` could not use it.
- **Two bugs found by looking at the result, not the tests.** `shop/setPrice` did not bump
  `worldVersion`, so the command succeeded while the panel showed a stale number — invisible to
  unit tests, obvious in a screenshot. And routing mechanics by aiming at cell centres made them
  converge half a cell short of an arrival check measured against the cell origin, so they
  walked forever and repairs silently stopped. Both now have tests.
- **Aliasing bug found on the way:** `restoreState` reused the snapshot's own piece objects.
  Harmless while every field was readonly; with a mutable price it meant a resumed park could
  write back into the save it loaded from. Restore now clones.

### M3 — Rides & the track builder (✅ completed 2026‑07‑26)
- **Track model (`src/content/track.ts`, `src/sim/rides/trackGraph.ts`):** the CoasterKit
  library measured piece by piece (M3 survey) into authored port metadata — 12 kinds
  (straight/corners/S‑curve/hills/climbing turns/humps/dip/loop/station) on a 1 m pose lattice
  with 0.5 m levels; pieces attach by either end, so every left turn and climb doubles as its
  mirrored right turn or drop. Occupancy rasterizes swept rects with terrain‑collision,
  head‑clearance (2.5 m) and track‑stacking (2 m) rules.
- **Energy model + scoring:** piecewise‑constant v² walk (TECH §4.6) — launch 4.2 m/s, chain
  lifts grab would‑stall climbs at 3.8 m/s, friction 0.55 v²/m, loops demand 9 m/s entry;
  valleys/overspeed reject with reasons the builder shows. E/I/N per GAME_BALANCE §5.3 from
  drops, inversions, speed variance, airtime, corner lateral‑G and build‑time scenery
  proximity; five golden circuits pin the scoring bands (invariant #5) and a 300‑layout fuzz
  proves invalid layouts never validate.
- **Ride simulation (`src/sim/rides/rides.ts`):** tracked + flat ride FSMs
  (closed→testing→open→broken, test‑before‑open), virtual FIFO entrance queues with patience,
  boarding/fares (ride income category), archetype‑matched fun payouts, breakdown rolls
  (MTBF × age^1.3 × coverage) and Mechanics — hire/fire commands, nearest‑job dispatch,
  20–60 game‑min repairs, $950/mo wages, palette‑g uniforms. Trains play back the measured
  speed profile deterministically; guests seek rides on low Fun (thrill archetypes chase
  coasters while content) and rides feed arrivals appeal + fairEntry (§4.1 M3 note).
- **Commands & undo:** ride/startTrack·appendPiece·popPiece·demolish·setState·setPrice,
  build/placeFlatRide·removeFlatRide, staff/hire+fireMechanic — append/pop and flat‑ride
  place/remove are exact‑inverse undoable (tested via hash round‑trips); builder dry‑runs
  (`checkStartTrack`/`checkAppendPiece`) power ghost validity and the live preview.
- **Flat rides (`src/content/rides.ts`):** Teacup Twirl, Critter Carousel, Galleon Swing,
  Rocket Orbit, Pumpkin Drop as pure kit compositions (P7) — MiniArena pad tiles, CoasterKit
  supports, giant FoodKit teacups, CubePets mounts, PirateKit ship, SpaceKit rockets,
  Spooktober pumpkins — animated by parametric spin/carousel/swing/drop programs.
- **Render:** instanced track pieces anchored at forward‑frame ports with per‑meter support
  stacks; station runs composed from 1 m rail segments + platform slabs + entry gate;
  interpolated train cars with hill pitch and full 360° loop sweep; flat‑ride scene graphs
  easing up/down with ride phase; double‑click ride‑along chase camera (Esc releases);
  mechanics rendered in the crowd system; riding guests vanish into the train.
- **UI:** RIDES dock palette (coaster starters, flat rides, live roster), track builder panel
  (piece buttons gated by live dry‑runs with E/I/N tooltips, mirror toggle, circuit status,
  cost ticker, remove‑last/test/done/demolish), ride inspector (state controls, ±ticket price,
  stats, queue/riders/cycles, edit track, demolish), staff popover gains Mechanics, ride
  break/repair/test toasts, Escape layering (ride‑along → palettes → build mode → selection →
  menu).
- **Save v4:** rides + mechanics + guest rideId lane with v3 migration; evaluation is derived
  and recomputed on load; round‑trip determinism proven with a live coaster mid‑circuit.
- **Content:** +34 pieces (full steel/mouse track families, station gate, large support, queue
  corner, flat‑ride parts, mechanic character) → 98 pieces, 2.1 MB shipped; `ride-part`
  catalog category keeps composition pieces out of build palettes.
- **Quality:** 82 unit tests (18 track‑graph incl. golden layouts + fuzz, 9 M3 integration);
  bench extended — **6 running coasters + 1,261–1,500 guests at 2.26 ms/tick avg** (6 ms
  budget); new e2e snaps a circuit through the real UI, tests and opens it; 5 new goal cards.

### M2 — Life (✅ completed 2026‑07‑26)
- **Guest simulation (`src/sim/guests`):** SoA typed‑array crowd (cap 1,500) with the five
  GAME_BALANCE §4.3 archetypes (weights/wallets), needs decay + mood, staggered decisions, A*
  on path cells with an LRU route cache (invalidated on path edits), thought log and emote
  state; arrivals via the §4.1 M2 interim appeal/elasticity model with gate hours and day
  rhythm; the gate forecourt (±4 cells, dry + non‑steep) is walkable so freshly painted parks
  route from day one.
- **Shops & economy:** Snack Shack / Sip Station / Restroom serve loops
  (`src/content/shops.ts`) with per‑serving unit costs, satisfaction and litter chance; money
  ledger (`src/sim/economy/ledger.ts`) tracking entry/food/drink/facility income vs
  goods/wages/upkeep/construction; monthly tick posts wages + shop upkeep and emits the first
  Monthly Report (modal in the HUD).
- **Staff:** Janitors — hire/fire commands ($150 fee, $620/mo month‑end wages), nearest‑litter
  claiming, A* pursuit, cleaning stat.
- **Goal Deck v1 (`src/sim/goals`, `src/content/goals.ts`):** 12 cards over
  guidance/growth/mastery tiers with stat prereqs, deal‑to‑3, dismiss with 2‑month cooldown,
  XP rewards + §9.2 level curve; invariant #11 upheld — no "required" concept anywhere, every
  card dismissible, deck refills. HUD goal panel with live progress bars + XP chip.
- **Render & UI:** instanced crowd renderer (per‑variant pools, fixed‑step interpolation, walk
  bob, heading, click‑to‑inspect), janitor uniforms (palette f), emote billboard bubbles from
  the EmotesPack, litter bits; park OPEN/CLOSED toggle + entry‑fee steppers, guest ticker,
  staff popover, guest inspector card (needs bars + thoughts), Monthly Report modal; dock gains
  SHOPS/STAFF.
- **Save format v3:** guests/ledger/goals/stats/park‑open/entry‑fee with v2→v3 migration and
  round‑trip tests; determinism hash covers the living crowd.
- **Content:** +8 pieces (5 guest character variants, 3 coasterkit stalls) → 64 pieces
  · 11 emote PNGs shipped via the pipeline (`public/emotes`).
- **Quality:** unit tests 57 → 55+M2 suites (guests, ledger, janitors, goals, m2 integration =
  new); `scripts/bench-guests.ts` sim throughput bench — 1,229–1,500 live guests at 1.19 ms/tick
  avg (limit 6 ms); depcruise `no-circular` now scopes to runtime cycles only (type‑only
  back‑edges are erased by `verbatimModuleSyntax`; rule re‑proven red on a value cycle); new e2e
  covering open‑gate → guests arrive → hire janitor.
- **Balance doc sync:** §3.1 sandbox entry preset $5 (pre‑rides), §4.1 M2 interim
  arrivals/elasticity note, §4.3 strolling Fun replenishment, §6/§7 M2 shipped subsets,
  §9.1 M2 XP sources note.

### M1 — The Valley (✅ completed 2026‑07‑26)
- **Terrain system (ADR‑19):** sites authored as landform descriptors + seeded noise
  (`src/content/sites/meadowbrook.ts`); sim precomputes cell heights, slope classes
  (flat/gentle/steep) and water; renderer builds a vertex‑colored heightfield (grass patchiness,
  sandy shores, rocky steeps, gravel path halos) plus pond water, time‑of‑day sun/fog/sky and
  deterministic instanced vegetation scatter with a decorative surround ring.
- **Placement core:** ghost preview with denial reasons, rotation, slope rules per
  GAME_DESIGN §5, occupancy/footprints, money costs per GAME_BALANCE §3.2, bulldoze refunds
  (100% grace → 70%), drag‑painted paths with `ground_path*` auto‑tiling (ends, straights,
  bends, T‑splits, crossings, plaza interiors) tilted flush onto terrain, and full undo/redo
  built on exact‑inverse commands with pinned‑id replay (100‑step fuzz‑tested).
- **Play session:** `/play` route with sim driver (fixed timestep, speeds 0/1/2/4, menu pauses),
  HUD v1 (money ticker, clock/day, build dock with honest M2/M3 stubs, toasts, context hints),
  scenery palette using pipeline thumbnails, pause menu, quiet autosave + save‑on‑hide into
  IndexedDB (`idb`), continue flow from title/hub; `?bench=N` renderer load harness.
- **Save format v2:** adds money + world (placed pieces, path cells) with a v1→v2 migration and
  round‑trip/migration tests; quantization‑safe instanced rendering (node‑matrix composition —
  fixes black models from baking transforms into quantized attributes).
- **Content:** +14 pilot pieces (path T/plaza tiles, fences, grass tufts, tree/flower/rock
  variants) → 56 pieces, 947 KB shipped; play‑route JS budget line (≤900 KB gz) added to the
  budget gate; unit tests 45 → 57 and new Playwright play‑route suite.

### M0 — Foundations (✅ completed 2026‑07‑26)
- Phase gate opened: owner approved implementation start ("Yes Start M0"); CLAUDE.md/AGENTS.md/
  README/ROADMAP updated to reflect the in‑development status; repo hygiene added
  (`.gitignore`, `.nvmrc`).
- **Toolchain:** Next.js 15.5 + React 19.2 + TypeScript 5.9 strict + Tailwind v4 + R3F 9 /
  three 0.185 + zustand + zod; ESLint 9 (type‑checked) + Prettier + dependency‑cruiser;
  Vitest 4 + Playwright; pnpm. Module boundaries (TECH §3) enforced by both ESLint
  `no-restricted-imports` layers and dependency‑cruiser rules (sim purity, facade‑only,
  /assets import ban) — proven red on a demo violation, then removed.
- **Sim spine (`src/sim`):** seeded named RNG streams (mulberry32 + fnv1a), fixed 10 Hz stepper
  with speed multipliers + backlog clamp, command bus with journal, event collector,
  snapshot/restore, structural state hash. 28 unit tests incl. golden‑seed determinism.
- **Save format v1 (`src/save`):** zod schema, forward‑only migration chain with version
  errors, deterministic gzip codec (fflate), round‑trip + migration matrix tests.
- **Content pipeline v1 (`scripts/build-content.ts`):** 42 pilot pieces from 16 packs
  optimized (gltf‑transform dedup/prune/weld/quantize; meshopt deferred to M6) into
  `public/models/**` + zod‑validated `public/content/catalog.json` (AABB→footprints, pack
  provenance per the kit‑only law) + 5 skyboxes; byte‑deterministic, `content:check` fails CI
  on drift; 867 KB shipped from 1.4 MB source. Thumbnails: `scripts/gen-thumbnails.ts`
  renders all 42 pieces to `public/thumbs` via the `/dev/thumbs` stage.
- **UI foundation:** design tokens (`src/ui/theme/tokens.css`) mapped into Tailwind; self‑hosted
  OFL fonts (Archivo Black, Barlow family); typed `t()` i18n layer (English, ADR‑11); UI kit
  components (DisplayTitle, SlabButton, KitCard, RibbonTag, Keycap/HintRail, TabBar,
  RowControl/Slider/Toggle, IdentityChip) with the `/dev/uikit` gallery.
- **Screens:** title screen with live R3F park diorama (pilot pieces, reduced‑motion aware,
  keyboard‑navigable menu), hub shell (mode cards with honest "arrives in Mx" ribbons),
  options shell (5 tabs of working row controls, draft‑only until M5), extras (CC0 credits),
  friendly 404.
- **Quality gates:** `scripts/check-budgets.ts` encodes TECH §10 (title route first‑load JS
  104.6 KB gz of 300 KB budget; model budgets green); GitHub Actions CI runs content drift,
  typecheck, lint, boundaries, unit, build, budgets and 7 Playwright smoke tests.

### Changed — planning revision after owner Q&A (2026‑07‑26)
- **Real terrain (ADR‑13):** replaced the flat "Tabletop island" world with authored landscape
  Sites (heightmap, splat surfaces, vegetation, water) per the owner's Aquapark Tycoon
  environment reference; grid became a logical layer projected onto terrain with slope classes.
  Reworked GAME_DESIGN §5, TECHNICAL_ARCHITECTURE §4.7/§6.4, ROADMAP M1.
- **Districts (ADR‑14):** new GAME_DESIGN §6 — Parking Grounds, Arrival Station, Resort Row,
  Staff Village, Commerce Quarter, Works Yard built from the city/building/industry packs, with
  arrival capacity, multi‑day hotel guests, staff housing, rent and ops hooks; numbers in
  GAME_BALANCE §3.3; scheduled in ROADMAP M4/M5.
- **Sandbox‑first, never forced, no hard end (ADR‑15):** My Parks is the primary mode; Career
  scenarios became persistent "Park Stories"; the forced tutorial became the optional Guidance
  layer + adaptive Goal Deck (GAME_DESIGN §18/§20, GAME_BALANCE §9.4); bankruptcy became
  recoverable Receivership with an optional classic hard‑fail sandbox toggle.
- **Kit‑only content law (ADR‑16):** every game element must be assembled from `/assets` packs
  (no ferris wheel — no pieces); codified as pillar P7, CLAUDE/AGENTS hard rule, ASSET_GUIDE §6
  and balance invariant #10.
- Owner answers recorded: multi‑theme direction confirmed, all four coaster families kept,
  English‑only at 1.0, Kenney CC0 audio approved (ADR‑17), honor‑system leaderboard confirmed,
  branding as planned (ADR‑18). DECISIONS restructured with ADR‑13…18 and the Q&A record.

### Added
- Complete planning documentation suite (milestone M‑1, see ROADMAP.md):
  - `GAME_DESIGN.md` — vision, pillars, systems, content roster, scenarios, tutorial, tone.
  - `TECHNICAL_ARCHITECTURE.md` — stack, sim core, rendering, saves, budgets, testing, deploy.
  - `ROADMAP.md` — milestones M0–M8 with acceptance criteria and the coding phase gate.
  - `docs/UI_UX_DESIGN.md` — design tokens, component kit and screen specs derived from `/uiinspo`.
  - `docs/ASSET_GUIDE.md` — CC0 pack inventory, licensing, gameplay mapping, pipeline plan, gaps.
  - `docs/GAME_BALANCE.md` — v0 numbers for economy, rides, guests, events, progression + CI invariants.
  - `docs/DECISIONS.md` — ADR log and open questions with defaults.
  - `CLAUDE.md` / `AGENTS.md` — working rules for AI agents in this repo.
  - `README.md` — project front door and documentation index.

### Notes
- No source code yet by design: implementation starts at M0 only after explicit user approval.
- `/assets` (50 CC0 packs) and `/uiinspo` (11 reference images) were provided by the project
  owner in the initial commits and are catalogued, not modified.
