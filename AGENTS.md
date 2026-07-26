# AGENTS.md — Rules for AI agents in this repo

This file mirrors [CLAUDE.md](CLAUDE.md) for non‑Claude tooling. **CLAUDE.md is the canonical
agent guide** — if the two ever disagree, CLAUDE.md wins and this file needs a fix.

## Project

Polypark: browser‑based 3D low‑poly resort tycoon — theme park + districts on real terrain,
sandbox‑first, no hard end. Single player, no accounts, Vercel deployment, friends leaderboard
as the final phase. Start with [README.md](README.md) for the doc index and
[GAME_DESIGN.md](GAME_DESIGN.md) for the game itself.

## Phase

✅ **Implementation approved (owner, 2026‑07‑26). ROADMAP M0 in progress.** All engineering
rules in CLAUDE.md are in force; docs stay load‑bearing (update them with behavior changes).

## Non‑negotiable rules (full detail in CLAUDE.md)

1. Behavior/number/scope changes update the authoritative doc + `CHANGELOG.md` in the same
   change. Balance numbers change in `docs/GAME_BALANCE.md` before code.
2. Never silently contradict an Accepted entry in `docs/DECISIONS.md` — supersede it explicitly.
3. `/assets` (CC0 source packs) and `/uiinspo` (UI references) are immutable; shipped content
   comes only from the generated pipeline output.
4. CC0‑only assets, permissive‑only dependencies, family‑friendly content, no monetization, no
   analytics/telemetry, no accounts.
4b. **Kit‑only law:** every game element is assembled from `/assets` packs — no custom or
   external game models, ever (ADR‑16). **Never forced, no hard end:** no mandatory steps, no
   save‑ending fail states (ADR‑15).
5. Once coding: TS strict; `sim/` stays pure (no react/three/UI imports, no wall clock, seeded
   RNG only, commands for all mutations); UI uses design tokens from `docs/UI_UX_DESIGN.md`;
   performance budgets in `TECHNICAL_ARCHITECTURE.md` §10 are hard requirements; Conventional
   Commits; tests green before push.
6. Work on the designated session branch; `git push -u origin <branch>`; no PRs unless asked;
   no new remote services without user OK.

## Doc map

| File | Owns |
|------|------|
| `GAME_DESIGN.md` | Game vision, systems, districts, content, stories, tone |
| `TECHNICAL_ARCHITECTURE.md` | Stack, sim/render architecture, saves, budgets, testing, deploy |
| `ROADMAP.md` | Milestones M0–M8, acceptance criteria, phase gate |
| `docs/UI_UX_DESIGN.md` | Tokens, UI kit, screen specs (must match `/uiinspo` style) |
| `docs/ASSET_GUIDE.md` | Pack inventory, licenses, pipeline, asset change log |
| `docs/GAME_BALANCE.md` | All tunable numbers + CI invariants |
| `docs/DECISIONS.md` | ADRs + open user questions with defaults |
| `CHANGELOG.md` | Keep‑a‑Changelog history |
