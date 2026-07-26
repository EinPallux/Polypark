# CLAUDE.md — Working in the Polypark repo

Guidance for Claude Code (and the canonical rule set mirrored by [AGENTS.md](AGENTS.md)).
Read this first; it tells you what the project is, where truth lives, and the rules that keep
50 CC0 asset packs, a deterministic sim and a reference‑matched UI coherent.

## What this project is

**Polypark** — a browser‑based 3D low‑poly **resort tycoon**: a theme park plus its districts
(parking, hotels, staff village, offices, works yard) on real, handcrafted terrain. Sandbox‑
first, guided but never forcing, no hard end. Single player, no accounts, deployed on Vercel,
friends leaderboard as the very last phase. Full pitch: [GAME_DESIGN.md](GAME_DESIGN.md).

## ✅ Current phase

**Implementation approved by the owner on 2026‑07‑26 ("Yes Start M0").** ROADMAP **M0
(Foundations) is in progress**. The engineering rules below are now in force. Keep this
section current as milestones complete.

## Where truth lives (read before changing anything)

| Topic | Authoritative doc |
|-------|-------------------|
| Game systems, content roster, tone | [GAME_DESIGN.md](GAME_DESIGN.md) |
| Stack, module boundaries, budgets, testing | [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) |
| Build order + acceptance criteria | [ROADMAP.md](ROADMAP.md) |
| UI tokens/components/screens (match `/uiinspo`!) | [docs/UI_UX_DESIGN.md](docs/UI_UX_DESIGN.md) |
| Asset packs, licensing, pipeline | [docs/ASSET_GUIDE.md](docs/ASSET_GUIDE.md) |
| Every tunable number | [docs/GAME_BALANCE.md](docs/GAME_BALANCE.md) |
| Past decisions + open questions | [docs/DECISIONS.md](docs/DECISIONS.md) |

Precedence on conflict: DECISIONS (latest entry) → the topic's authoritative doc → other docs.
If you find a real contradiction, fix the docs in the same change and note it in CHANGELOG.

## Hard rules

1. **Docs are load‑bearing.** Any change that alters behavior, numbers, scope or architecture
   updates the authoritative doc *in the same commit/PR*, plus a `CHANGELOG.md` entry under
   `[Unreleased]`. Balance numbers change in GAME_BALANCE **first**, then code.
2. **Decision discipline.** Contradicting an Accepted ADR requires a new superseding entry in
   docs/DECISIONS.md — never a silent drift. Scope additions name what they displace.
3. **`/assets` is immutable** (source library): never edit/rename/delete pack contents; runtime
   never imports from it; shipped models come only from the content pipeline. `/uiinspo` is
   reference material — never shipped, never deleted.
4. **CC0 or it doesn't ship.** New assets (audio pending, DECISIONS Q‑05) must be CC0 and
   logged in ASSET_GUIDE §7. Code deps: permissive licenses only (MIT/ISC/BSD/OFL/Apache‑2).
5. **Family‑friendly always** (GAME_DESIGN §24): no injury/gore, no gambling, no monetization,
   no dark patterns — including in copy, names and test fixtures.
6. **No accounts, no tracking.** Nothing phones home except the M8 leaderboard API as specced
   (TECH §12). No analytics/telemetry libraries.
7. **Kit‑only content law** (ADR‑16, GAME_DESIGN P7): every game element is assembled from the
   packs in `/assets` — never model, generate or source new game objects (no ferris wheel: no
   pieces, no ride). Generated visuals are limited to terrain/water shaders, particles,
   foundation skirts and UI/SVG.
8. **Guided, never forced; no hard end** (ADR‑15): never design or implement a mandatory step,
   a timed forced choice, or a fail state that ends a save. Insolvency flows through
   Receivership (GAME_DESIGN §14.3).

## Engineering rules (in force since M0)

- TypeScript strict; no `any`/`as any` outside a justified `// why:` comment; branded types for
  Money/ids per TECH §4.2 (money is integer cents — never floats).
- **Module boundaries are law** (TECH §3): `sim/` imports nothing from react/three/ui/render;
  UI/render talk to sim only via `SimFacade`. The dep‑cruiser CI check must stay green.
- Determinism: no `Date.now()`, `Math.random()`, or wall‑clock in `sim/`; all randomness via
  the seeded RNG streams; all mutations via the command bus (undo/redo depends on it).
- Performance budgets (TECH §10) are acceptance criteria, not aspirations — check the perf
  smoke locally before pushing render/sim hot‑path changes.
- Every PR: typecheck, lint, tests green locally; new systems land with unit tests; sim/balance
  work keeps GAME_BALANCE §11 invariants green; UI kit changes update `/dev/uikit` gallery.
- All user‑facing strings through the i18n layer; UI uses tokens from UI_UX §2 only (no ad‑hoc
  hex values/fonts).
- Conventional Commits (`feat(sim): …`, `fix(ui): …`, `docs: …`); small focused PRs per
  ROADMAP work item.

## Git & workflow

- Current working branch: `claude/new-session-9m1bb2` (push with `git push -u origin <branch>`;
  retry on network failure with backoff). Never force‑push shared branches; never commit
  secrets (there are none — keep it that way; leaderboard secrets live in Vercel env).
- Do not create PRs unless the user asks. Do not add new remote services, GitHub Apps or CI
  secrets without an ADR + user OK.
- Keep commits scoped: asset‑pipeline output (`public/content`, `public/models`) regenerates —
  commit the generator change and the regenerated output together so CI drift checks pass.

## When unsure

Prefer the smallest change that satisfies the authoritative doc; if the doc is silent, decide
in the spirit of the six pillars (GAME_DESIGN §2), record it (DECISIONS or doc edit), and flag
it to the user in your summary. Questions that genuinely need the user are listed with safe
defaults in DECISIONS §3 — don't block on them.
