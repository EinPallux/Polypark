# Changelog

All notable changes to Polypark are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) ·
versioning: [SemVer](https://semver.org/) once code exists (pre‑1.0 minor bumps may break saves
only where a migration ships — see TECHNICAL_ARCHITECTURE §8).

## [Unreleased]

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
