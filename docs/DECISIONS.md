# Polypark — Decision Log & Open Questions

Lightweight ADR log. Append‑only: new decisions get new numbers; reversals reference the old
entry. Agents: never silently contradict an Accepted entry — add a superseding one.

## 1. How to use

- **Accepted** = binding until superseded. **Default** = chosen to unblock planning; user can
  overturn cheaply before its milestone starts (listed in §3 too).
- Format: context → decision → consequence. Keep entries short; link docs for detail.

## 2. Decisions

| # | Status | Decision |
|---|--------|----------|
| ADR‑01 | Accepted | **Game direction: low‑poly theme‑park tycoon ("toybox diorama")** unifying the four reference games' loops; theme chosen because the asset library (CoasterKit, kits per theme, guests, emotes) supports it end‑to‑end. → GAME_DESIGN §1. |
| ADR‑02 | Accepted | **Stack: Next.js 15 + React 19 + TS strict + R3F/three + Zustand + bespoke sim core.** Vercel‑native, DOM UI matches uiinspo refs, sim testable headless. Rejected: engine‑WASM exports, archetype ECS libs. → TECH §2. |
| ADR‑03 | Accepted | **Grid construction (2×2 m cells) + piece‑snap track builder**, not free splines/terraforming. Matches toy identity, bounds scope, CoasterKit pieces are the vocabulary. Post‑1.0 may add terrain height (save format reserves it). → GAME_DESIGN §7, TECH §13. |
| ADR‑04 | Accepted | **Deterministic fixed‑timestep sim (10 Hz) with seeded RNG + command journal**; worker‑shaped facade from day one, physical worker move deferred to M6 profiling. → TECH §4. |
| ADR‑05 | Accepted | **No accounts, no server for gameplay.** IndexedDB saves + file export; leaderboard is final‑phase, share‑code + honor‑system with sanity bounds (per brief). → TECH §8/§12. |
| ADR‑06 | Accepted | **UI as DOM overlay** (React/Tailwind/Radix), not in‑canvas; tokens/components codified from the 11 uiinspo refs. → UI_UX_DESIGN. |
| ADR‑07 | Accepted | **Content‑as‑data**: generated `catalog.json` from CC0 packs + TS data definitions; `/assets` immutable source, shipped models only via pipeline. → ASSET_GUIDE §3/§5. |
| ADR‑08 | Accepted | **Three‑layer progression** (Park Level track / scenario stars / Star‑Ticket Collection) with zero monetization; battle‑pass *aesthetic* only. → GAME_DESIGN §17. |
| ADR‑09 | Default | **No offline Service Worker at 1.0** (cache‑invalidation risk vs benefit); PWA‑lite manifest only. Revisit post‑1.0. |
| ADR‑10 | Open (M8) | Leaderboard storage: Vercel Postgres vs KV vs Blob — decide at M8 with real payload shapes; API contract already fixed in TECH §12 so the choice is contained. |
| ADR‑11 | Default | **English‑only at 1.0, i18n externalized from day one**; German = first post‑1.0 locale (user Q‑03). |
| ADR‑12 | Default | Difficulty triad Relaxed/Standard/Tycoon with GAME_BALANCE §2 modifiers; no custom‑rule sliders at 1.0 (sandbox toggles cover the big ones). |

## 3. Open questions for the user (answers welcome any time; defaults unblock work)

| Q | Question | Default until answered |
|---|----------|------------------------|
| Q‑01 | The plan interprets "Polypark" as a **multi‑theme amusement park** (not a single‑theme water/zoo park), with Theme Kits as content chapters. Confirm? | Yes — GAME_DESIGN §10 roster |
| Q‑02 | Custom **track builder** for 4 coaster families at 1.0 is the plan's centerpiece and biggest cost. Keep, or trade Inverted/Flume customization for more flat rides? | Keep all four (ROADMAP M3/M4 split de‑risks) |
| Q‑03 | UI language at launch **English only** (i18n‑ready, German next)? | Yes (ADR‑11) |
| Q‑04 | Session length bias: current pacing targets ~8–10 h to L30/5★ per big park. Cozier/faster preferred? | Keep (GAME_BALANCE §9.2) |
| Q‑05 | Repo has **zero audio assets**. OK to add Kenney CC0 audio/music packs into `/assets` during M6 (listed in ASSET_GUIDE §6)? | Yes, CC0‑only, logged in ASSET_GUIDE §7 |
| Q‑06 | Leaderboard integrity: friends‑only honor system with sanity bounds (no anti‑cheat arms race) acceptable? | Yes (TECH §12) |
| Q‑07 | Any naming/branding vetoes? ("Polypark" logotype, ride/kit names in GAME_DESIGN §8/§10, orange `#FF9F1C` as primary accent) | Proceed as planned |
