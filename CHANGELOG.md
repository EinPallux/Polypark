# Changelog

All notable changes to Polypark are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) ·
versioning: [SemVer](https://semver.org/) once code exists (pre‑1.0 minor bumps may break saves
only where a migration ships — see TECHNICAL_ARCHITECTURE §8).

## [Unreleased]

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
