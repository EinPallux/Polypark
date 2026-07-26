# Polypark — Decision Log & Open Questions

Lightweight ADR log. Append‑only: new decisions get new numbers; reversals reference the old
entry. Agents: never silently contradict an Accepted entry — add a superseding one.

## 1. How to use

- **Accepted** = binding until superseded. **Default** = chosen to unblock work; owner can
  overturn cheaply before the affected milestone starts.
- Format: context → decision → consequence. Keep entries short; link docs for detail.

## 2. Decisions

| # | Status | Decision |
|---|--------|----------|
| ADR‑01 | Accepted (owner‑confirmed Q‑01) | **Game direction: low‑poly resort tycoon** — multi‑theme park + supporting districts, unifying the four reference games' loops; chosen because the asset library supports it end‑to‑end. → GAME_DESIGN §1. |
| ADR‑02 | Accepted | **Stack: Next.js 15 + React 19 + TS strict + R3F/three + Zustand + bespoke sim core.** Vercel‑native, DOM UI matches uiinspo refs, sim testable headless. Rejected: engine‑WASM exports, archetype ECS libs. → TECH §2. |
| ADR‑03 | Accepted, partially superseded by ADR‑13 | **Grid construction (2×2 m cells) + piece‑snap track builder** (owner‑confirmed Q‑02: all four coaster families custom‑buildable at 1.0), not free splines. The original "flat board" world model is superseded by ADR‑13 (real terrain); the logical grid itself stands. → GAME_DESIGN §8. |
| ADR‑04 | Accepted | **Deterministic fixed‑timestep sim (10 Hz) with seeded RNG + command journal**; worker‑shaped facade from day one, physical worker move deferred to M6 profiling. → TECH §4. |
| ADR‑05 | Accepted (owner‑confirmed Q‑06) | **No accounts, no server for gameplay; leaderboard is final‑phase, share‑code honor system** with sanity bounds only — no anti‑cheat. → TECH §8/§12. |
| ADR‑06 | Accepted | **UI as DOM overlay** (React/Tailwind/Radix); tokens/components codified from the 11 uiinspo refs. → UI_UX_DESIGN. |
| ADR‑07 | Accepted | **Content‑as‑data**: generated `catalog.json` + TS data definitions; `/assets` immutable source; shipped models only via pipeline. → ASSET_GUIDE §3/§5. |
| ADR‑08 | Accepted | **Three‑layer progression** (Park Level track / story stars / Star‑Ticket Collection), zero monetization; battle‑pass *aesthetic* only. → GAME_DESIGN §18. |
| ADR‑09 | Default | **No offline Service Worker at 1.0** (cache‑invalidation risk vs benefit); PWA‑lite manifest only. Revisit post‑1.0. |
| ADR‑10 | Open (M8) | Leaderboard storage: Vercel Postgres vs KV vs Blob — decide at M8 with real payload shapes; API contract fixed in TECH §12 so the choice is contained. |
| ADR‑11 | Accepted (owner Q‑03) | **English only at 1.0.** Strings still externalized through the i18n layer from day one; no committed second locale. |
| ADR‑12 | Default | Difficulty triad Relaxed/Standard/Tycoon (GAME_BALANCE §2); no custom‑rule sliders at 1.0 beyond the sandbox toggles. |
| ADR‑13 | Accepted (owner directive 2026‑07‑26) | **Real terrain.** Parks live on authored, high‑quality landscape Sites (heightmap + splat + scatter + water) in the Aquapark‑reference spirit — no flat boards, no visible checkerboard; grid is logic projected onto terrain with slope classes; player terraforming stays post‑1.0. Supersedes the "flat Tabletop island" of the original plan. → GAME_DESIGN §5, TECH §4.7/§6.4. |
| ADR‑14 | Accepted (owner directive) | **Districts.** Polypark is not only the fenced park: Parking Grounds, Arrival Station, Resort Row, Staff Village, Commerce Quarter and Works Yard use the city/building/industry packs with real economic hooks (arrival capacity, multi‑day guests, staff housing, rent, ops discounts). → GAME_DESIGN §6, GAME_BALANCE §3.3. |
| ADR‑15 | Accepted (owner directive, Q‑04) | **Sandbox‑first, guided never forced, no hard end.** My Parks is the primary mode; guidance = optional Goal Deck cards + coach‑marks; Stories are curated starts whose parks persist after completion; insolvency → Receivership (recoverable), never game‑over; optional "classic bankruptcy" sandbox toggle. → GAME_DESIGN §4/§14.3/§18/§20. |
| ADR‑16 | Accepted (owner directive) | **Kit‑only content law (P7).** Every game element is assembled from `/assets` packs; if pieces don't exist (ferris wheel, buses, bumper cars), the element is out — no custom or external models. Permitted generated visuals: terrain/water shaders, particles, foundation skirts, UI/SVG. → GAME_DESIGN §2 P7, ASSET_GUIDE §6. |
| ADR‑17 | Accepted (owner Q‑05) | **Audio: Kenney CC0 audio/music packs approved** for addition to `/assets` when audio work starts (M6; core placeholders may land earlier). Every added pack logged in ASSET_GUIDE §7. |
| ADR‑18 | Accepted (owner Q‑07) | **Branding proceeds as planned:** "Polypark" logotype, ride/kit naming per GAME_DESIGN §9/§11, primary accent `#FF9F1C`. |
| ADR‑19 | Accepted (M1) | **Terrain authored as landform descriptors, not PNG maps.** Sites define hand‑placed hills/basins + low‑amplitude seeded noise in code (`src/content/sites/*`); the sim precomputes cell heights/slope classes/water and the renderer samples the same function. Diffable, deterministic, no binary authoring tooling; refines the implementation detail of ADR‑13 (its "real terrain" mandate stands unchanged). → TECH §4.7/§6.4. |

## 3. Owner Q&A record (2026‑07‑26) — all answered

| Q | Question (short) | Answer | Landed in |
|---|------------------|--------|-----------|
| Q‑01 | Multi‑theme park direction? | **Yes** | ADR‑01 |
| Q‑02 | Keep 4‑family custom track builder? | **Keep all four** | ADR‑03, ROADMAP M3/M4 |
| Q‑03 | Launch language | **English only** | ADR‑11 |
| Q‑04 | Pacing / mode bias | **Sandbox‑first; light guidance everywhere; never force; no hard end for your park** | ADR‑15 |
| Q‑05 | Add Kenney CC0 audio? | **Yes** | ADR‑17 |
| Q‑06 | Honor‑system leaderboard? | **Yes, no anti‑cheat** | ADR‑05 |
| Q‑07 | Naming/branding | **Proceed as planned** | ADR‑18 |

Additional owner directives from the same message: build strictly from the asset packs
(→ ADR‑16) · use all fitting packs incl. parking/living/offices (→ ADR‑14) · real
high‑quality terrain per the Aquapark Tycoon reference screenshot (→ ADR‑13) · overall bar:
"very well developed and thought through" (pillar P6).

## 4. Open items

None blocking. Next deliberate decision points: ADR‑09 revisit (post‑1.0), ADR‑10 (M8
leaderboard storage).
