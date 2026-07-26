# Polypark — Technical Architecture

How we build a Steam‑quality 3D tycoon that runs in a browser tab and deploys on Vercel.

Related: [GAME_DESIGN.md](GAME_DESIGN.md) (what we're building) ·
[docs/ASSET_GUIDE.md](docs/ASSET_GUIDE.md) (content pipeline inputs) ·
[docs/GAME_BALANCE.md](docs/GAME_BALANCE.md) (numbers the sim implements) ·
[ROADMAP.md](ROADMAP.md) (build order) · [docs/DECISIONS.md](docs/DECISIONS.md) (ADRs).

---

## 1. Architecture goals

| Goal | Consequence |
|------|-------------|
| 60 fps with ~1,200 guests + ~15k placed pieces on a mid 2020s laptop | Instanced rendering, SoA sim data, worker‑ready sim, strict budgets (§10) |
| Deployable on Vercel, playable offline‑ish after load | Static‑exportable app shell; all game state client‑side; API routes only for the (final‑phase) leaderboard |
| Modular & expandable ("add a ride without touching the sim core") | Content‑as‑data catalog; systems behind interfaces; strict module boundaries (§3) |
| Deterministic simulation | Seeded RNG, fixed‑timestep integer‑friendly sim, replayable command log — enables tests, challenge seeds, save integrity |
| No accounts, no server dependency for play | IndexedDB saves, export/import files, share codes |
| A codebase agents can extend safely | Typed contracts, content schemas (zod), invariant tests, docs‑adjacent code (CLAUDE.md rules) |

## 2. Tech stack (decision + rationale)

**Framework: Next.js 15 (App Router) + React 19 + TypeScript (strict).**
Vercel‑native (zero‑config deploy, preview URLs), file‑based routing for shell screens, API
routes ready for the final‑phase leaderboard without re‑platforming. The game route mounts the
canvas client‑side only (`ssr: false`); everything else can be static.

**3D: three.js + React Three Fiber (R3F) v9 + drei.**
Mature, best‑documented WebGL stack; R3F gives declarative scene composition that matches React
UI mental models, drei supplies controls/instancing/loader utilities. Escape hatches to raw
three everywhere. `three-mesh-bvh` for fast raycasts (placement, selection);
`@react-three/postprocessing` for outline/selection FX, SMAA, subtle bloom (night lamps).
WebGPU is not required at 1.0; renderer stays behind our own `Renderer` seam.

**State: Zustand (UI/app state) + bespoke sim core (plain TS).**
The simulation is **not** React state: it's a plain‑TS module with typed stores (SoA arrays for
hot entities), ticked at fixed rate, exposing snapshots/deltas. Zustand handles app/UI state
(panels, selection, settings) with `subscribeWithSelector`; React never re‑renders per tick —
render layers read sim state imperatively (refs into instanced buffers) at 60 fps with
interpolation.

**Why not a game engine export (Unity/Godot→WASM)?** 50–150 MB payloads, poor Vercel fit, hostile
to the reference‑matching DOM UI, and CC0 GLB kits + React UI is exactly the web stack's home
turf. Why not pure ECS libs (bitecs/miniplex)? Our entity counts don't require archetype ECS;
a typed SoA store per entity family is simpler, debuggable, and swappable later.

**Supporting libraries** (all permissive licenses):

| Concern | Choice | Note |
|---------|--------|------|
| UI styling | Tailwind CSS v4 + CVA | Tokens from UI_UX_DESIGN §2 as CSS vars |
| UI primitives | Radix UI | Focus/keyboard/aria for panels, tabs, sliders |
| Animation | `motion` (Framer Motion) | Reduced‑motion aware |
| Schema/validation | `zod` | Save files, catalog, settings, API payloads |
| Persistence | `idb` (IndexedDB) + `fflate` (gzip) | Saves & export files |
| Audio | `howler` | Sprite‑based UI/SFX buses (assets pending, ASSET_GUIDE §6) |
| Icons | `lucide-react` + custom SVG | |
| RNG | mulberry32 + stream splitting (own 30‑line impl) | Seeded, serializable |
| Tests | Vitest + @testing-library/react + Playwright | §11 |
| Lint/format | ESLint (typescript‑eslint, react‑hooks) + Prettier | CI‑enforced |

Node 22 LTS, pnpm, GitHub Actions CI (§11.4).

## 3. Project structure & module boundaries

```
src/
  app/            # Next.js routes: /, /hub/*, /play, /dev/uikit; api/ (leaderboard, final phase)
  sim/            # ★ Pure TS simulation. NO imports from react/three/ui/render.
    core/         #   loop, scheduler, RNG, command bus, event bus, serialization
    world/        #   grid, cells, land chunks, water, path graph
    guests/       #   spawner, needs, decisions, movement along paths
    rides/        #   ride FSMs, track graph, trains kinematics, reliability
    economy/      #   ledger, pricing, loans/credit, monthly report
    staff/        #   roles, patrol zones, jobs queue
    events/       #   event deck, weather, inspections
    rating/       #   sub‑scores, park level XP
    api.ts        #   SimFacade: the ONLY surface UI/render may call
  content/        # catalog types, manifest, piece/ride/shop/scenario/track definitions (data!)
  render/         # R3F scene: chunks, instancing, crowds, tracks, water, sky, FX, camera
  ui/             # DOM UI: kit/ (components), screens/, hud/, panels/, input/, theme/
  save/           # slots, autosave, migrations, export/import, thumbnails
  audio/          # buses, sprite maps, caption events
  shared/         # branded types (Money, CellIndex…), math, utils — importable by all
scripts/          # build-content.ts (ASSET_GUIDE §5), check-budgets.ts
public/           # models/, content/catalog.json, thumbs/, skyboxes/, fonts/
```

**Enforced boundaries** (ESLint `no-restricted-imports` + dependency‑cruiser in CI):
`sim` imports only `shared` + `content` types · `render`/`ui` talk to sim exclusively via
`SimFacade` (commands in, snapshots/events out) · `content` is data + types, no logic imports.
This keeps the sim testable headless and portable to a worker (§4.4) or future server.

## 4. Simulation core

### 4.1 Loop & time

- **Fixed timestep: 10 ticks/s** of *game time*; game speed multiplies ticks consumed per real
  frame (pause=0, 1×, 2×, 4×). Render interpolates entity transforms between ticks — sim cost
  is independent of frame rate.
- Time model: 1 real s = 2 game min at 1× (GAME_DESIGN §15) ⇒ 1 tick = 12 game‑seconds.
  Month = 3,000 ticks. All durations authored in game‑time units.
- Systems run in a **fixed order** each tick (determinism): commands → weather/events → guests
  (staged: decide→move→interact) → rides → staff → economy accrual → rating → XP → emitted
  events. Heavy systems (guest decide, pathfind) are **time‑sliced** across ticks with strict
  per‑tick budgets; correctness never depends on slice timing.

### 4.2 Data layout

Hot entity families (guests, ride trains, staff, litter) are **SoA typed arrays** with free‑list
indices (`Float32Array` positions, `Uint8Array` states…), sized to caps (guests 1,500). Cold
data (placed pieces, shops config) are plain object maps keyed by branded IDs. Grid: flat
`Uint16Array`s per layer (surface, occupancy, path‑id, zone). Money is integer cents
(`Money` branded number). No allocations in tick hot paths; scratch buffers reused.

### 4.3 Determinism & RNG

Single serialized `mulberry32` root seed → named child streams (`rng.guests`, `rng.events`…)
so system order changes don't reshuffle unrelated rolls. All sim mutations flow through the
**command bus** (`PlacePiece`, `SetPrice`, `HireStaff`…) — commands are validated, applied,
journaled (undo/redo, GAME_DESIGN §7.1) and replayable (debug + challenge seeds). Wall clock
never read inside `sim/`.

### 4.4 Worker readiness

`SimFacade` is message‑shaped from day one: commands/queries in, immutable snapshots + event
batches out (transferable‑friendly buffers for hot arrays). M1 runs the sim on the main thread
(same interface); M6 perf milestone moves it to a Web Worker via the identical protocol if
profiling demands (expected yes at 1k guests). No SharedArrayBuffer dependency (Vercel headers
complexity); double‑buffered transfers instead.

### 4.5 Pathfinding & movement

- Path cells form a graph; **hierarchical A***: region graph (16×16 cell clusters) → in‑region
  A*; LRU path cache keyed (fromRegion,toRegion,goal) invalidated by build edits.
- Guests follow cell‑center splines with per‑guest lateral offset + speed jitter (crowd look),
  congestion slowdown from a per‑cell density counter (also feeds Flow rating).
- Queues are explicit lanes (ordered slots on queue pieces); transport rides (Poly Express)
  register stations as portal edges in the region graph — pathfinding naturally routes guests
  through train rides (GAME_DESIGN §8).

### 4.6 Ride logic

Rides are FSMs (`closed→testing→open→(breakdown)→repair→open`, refurb states). Tracked rides:
the builder produces a **track graph** of pieces with typed ports (ASSET_GUIDE catalog
`trackPorts`); validation = closed circuit + station + energy check (piecewise constant
accel model per piece class: chain/launch adds energy, friction drains, hills trade PE/KE —
cheap, deterministic, tuned via GAME_BALANCE §5.3). Trains advance along piece arc‑lengths;
E/I/N stats computed from composition metrics (speed variance, drop count, inversion count,
lateral‑G proxy from curve radius @ speed, airtime pieces, scenery proximity sampled at build
time). Flat rides: parametric animation programs (spin/swing/drop curves) driven by ride FSM
phase — no physics.

## 5. Content pipeline

Implemented per ASSET_GUIDE §5: `scripts/build-content.ts` selects allow‑listed pieces from
`/assets`, normalizes to GLB (Y‑up, meters, footprint‑bottom origin), optimizes
(gltf‑transform: dedupe/prune/weld/quantize+meshopt), emits `public/content/catalog.json`
(zod‑validated at build AND at runtime load) + webp thumbnails + size report. Definitions in
`src/content/*` (rides, shops, kits, scenarios, events, track pieces) are **TypeScript data
files** referencing catalog IDs — adding content = adding data, not code (architecture goal).
CI regenerates and fails on drift (committed catalog must match sources) and on budget breach.

## 6. Rendering

### 6.1 Scene organization

World renders from sim snapshots via three layers: **static chunks** (placed pieces merged per
16×16‑cell chunk per material → few draw calls; rebuilt async on edit with 1‑frame ghost
retention), **instanced dynamics** (guests, trains, marbles, litter, emote billboards — one
`InstancedMesh` per family with per‑instance attributes), and **uniques** (selected ghost,
gate, water surface, sky). Target ≤300 draw calls at max park (§10).

### 6.2 Lighting & look

Single directional sun + hemisphere ambient, color‑graded per time‑of‑day curve
(morning/day/night lerp using the Skyboxes pack); flat‑shaded materials honor kit colormaps
(`KHR_materials_unlit` fallback path if PBR cost bites). Cascaded shadow map only from the sun
at medium+ quality; blob shadows for guests at low. Night = emissive lamp sprites + restrained
bloom. Selection/hover = outline pass on the postprocessing chain. Water: single animated
plane per basin (vertex ripple + fresnel‑lite), no simulation.

### 6.3 Crowd rendering

Guests: **rigid instancing, procedural animation in shader** (bob/waddle/lean from per‑instance
phase+speed; emote index in an atlas for the bubble billboard). 18 palette variants via texture
array index (BlockyCharacters palettes). Nearest ~24 guests swap to a **hero pool** of real
skinned models (idle/walk/sit/cheer clips) for close‑ups and guest‑follow camera. LOD: bubbles
cluster to count chips beyond 40 m (UI_UX_DESIGN §3 `<EmoteBubble>`).

### 6.4 Frame budget management

`three-mesh-bvh` for picking; frustum + per‑chunk occlusion‑ish culling (chunk AABBs);
`renderer.info` surfaced in a dev perf HUD (`F3`): fps, draw calls, tick ms, worker lag,
instance counts vs budgets. Dynamic resolution scale option; quality presets map to shadow
res/postFX/crowd hero count.

## 7. UI integration

DOM overlay (no in‑canvas UI): React tree beside the canvas, reading Zustand app state + sim
snapshots via typed selector hooks throttled to 10 Hz (HUD tickers) or event‑driven (toasts
from sim event bus). Build‑mode input runs a small FSM in `ui/input/` translating
pointer/keys → sim commands + ghost state; raycasts against grid/BVH stay in `render` but are
requested through the facade (keeps UI testable). Keymap single‑source `ui/input/keymap.ts`
drives both handling and the Options rebind table (UI_UX_DESIGN §8).

## 8. Persistence & saves

- **Slots** in IndexedDB (`idb`): manual slots + ring of 3 autosaves per park (month boundary +
  quit). Save = gzipped JSON (`fflate`): `{formatVersion, appVersion, seed, tick, world,
  entities (SoA arrays encoded), economy, progression, settings‑subset, thumbnail(webp,
  ≤64KB)}`. Typical target ≤2 MB.
- **Zod‑validated on load** with `formatVersion` migration chain (`save/migrations/*`, tested —
  every released version must load forward forever).
- **Export/import**: same payload as a `.polypark` file (drag‑drop import in My Parks).
  Profile/Collection stored separately (small doc) so wiping a park never wipes meta progress.
- localStorage: settings + last‑session pointer only. Everything survives with **no account**
  (per brief); "clear site data" warning surfaced in My Parks.

## 9. App shell & screens

Routes: `/` (title), `/hub/(play|career|sandbox|parks|collection|profile)`, `/play` (game,
client‑only), `/dev/uikit` (dev). Shell screens are server‑renderable but the app ships as a
**static export**; the 3D title diorama lazy‑mounts. Asset loading: boot loads shell + fonts
(<300 KB gz JS budget for title); entering a park streams its kit manifests with a loading
vignette (<4 s warm target, §10); further kits prefetch on unlock in idle time. PWA‑lite
(manifest + icon; no offline SW at 1.0 to avoid cache‑invalidation risk — DECISIONS ADR‑09).

## 10. Performance budgets (CI‑ and dev‑HUD‑enforced)

| Budget | Target |
|--------|--------|
| Frame rate reference machine (2021 mid laptop, 1080p, Medium) | ≥60 fps steady state; ≥45 fps worst case megapark |
| Sim tick (1,200 guests, 96×96) | ≤6 ms average on reference; ≤10 ms p99 |
| Draw calls / triangles | ≤300 / ≤2.5 M at Medium |
| Title route JS (gz) | ≤300 KB; game chunk lazy ≤900 KB |
| Shipped models total / per kit bundle / single GLB | ≤60 MB / ≤8 MB / ≤1.5 MB |
| Save size / save+load time | ≤2 MB / ≤500 ms save, ≤1.5 s load (excl. first model fetch) |
| Memory (JS heap + GPU) | ≤1.2 GB total on reference |
| Input→ghost response / placement→feedback | ≤16 ms / ≤100 ms (UI_UX rule 5) |

Budgets are numbers in `scripts/check-budgets.ts` + Playwright perf smoke (§11.3); breaching a
budget fails CI the same as a failing test.

## 11. Quality: testing, CI, tooling

### 11.1 Unit/system (Vitest)

Sim runs headless: golden‑seed determinism tests (same seed+commands ⇒ identical state hash),
system tests per module (needs decay, loan schedules, event weights sanity), **balance
invariants** from GAME_BALANCE §11 (e.g., "tutorial build order breaks even by month 3",
"no need hits critical from full in <45 game‑min"), save round‑trip + migration matrix, catalog
schema validation. Target: sim core ≥80% line coverage, 100% of money math.

### 11.2 UI (Vitest + Testing Library)

Kit components (states/aria/keyboard), panel logic against a mocked facade, i18n key coverage
(no hardcoded strings rule).

### 11.3 E2E & visual (Playwright, Chromium pre‑installed)

Boot→title→new sandbox→place path+shop+ride→open park→guests spawn→save→reload→state matches.
Tutorial first 6 beats. Visual snapshots of `/dev/uikit` and each §6 screen (UI_UX acceptance).
Perf smoke: scripted megapark save, measure fps/tick against §10 on CI hardware
(relative thresholds).

### 11.4 CI (GitHub Actions)

On PR: typecheck · lint · dep‑cruiser boundaries · unit · UI · content build (catalog drift +
budgets) · Playwright smoke. On main: full E2E + visual + perf smoke; Vercel preview per PR,
production deploy on main after CI green. Conventional Commits enforced (see CLAUDE.md).

## 12. Leaderboard (final phase — after 1.0 polish, per brief)

Kept out of every earlier phase; designed now so nothing blocks it:

- **No accounts.** Local profile = display name + generated keypair‑ish `profileId` (random
  UUID + HMAC secret stored locally).
- **Share codes:** `POLY-XXXX-XXXX` per profile; friends exchange codes to form a local friends
  list (codes resolvable via API, no discovery/search of strangers).
- **Submission:** explicit "Publish park stats" action posts a compact snapshot `{profileId,
  name, parkName, mode/scenario, stars, rating, guests, parkValue, playTime, appVersion,
  statsHash}` to `/api/leaderboard` (Next.js API route + Vercel Postgres/KV — final choice at
  implementation, ADR‑10 placeholder). Payload zod‑validated; HMAC with local secret prevents
  trivial third‑party spoofing of someone's profileId.
- **Integrity posture:** friends‑only honor system (per brief). Server sanity bounds (rating ≤5,
  value vs playtime plausibility) + rate limits; no anti‑cheat beyond that — documented
  openly in‑UI ("friendly bragging, not esports").
- **Privacy:** display name + stats only; no emails/IPs stored beyond transient logs; delete via
  "unpublish" (removes rows by profileId). GDPR‑friendly by construction.
- UI: Profile screen gains Rivals‑style leaderboard tab (UI_6 aesthetic) comparing friends'
  stat tiles.

## 13. Future‑proofing (explicit non‑blockers)

Touch/mobile: input layer isolates pointer abstractions; HUD clusters are relocatable — no
desktop‑only assumptions in sim/render. i18n: all strings through a `t()` layer from day one
(English shipped; German first candidate — DECISIONS Q‑03). Mods/user content: catalog is
data‑driven; a future "custom kit" importer slots into the same pipeline. Terrain height &
caves: grid reserves a height field per cell (unused at 1.0) so save format won't break.
WebGPU: renderer seam + no three internals leaked outside `render/`.

## 14. Technical risk register

| Risk | L×I | Mitigation |
|------|-----|------------|
| Crowd perf misses 60 fps target | M×H | Budgets from M1, perf smoke in CI, worker escape hatch (§4.4), LOD/cluster fallbacks, guest cap slider |
| Track builder combinatorics (ports/validation) balloon | M×H | Catalog‑generated port metadata, golden layout tests, constrain 1.0 piece set, prefab blueprints as pressure valve |
| Chunk rebuild hitches on big edits | M×M | Async rebuild + ghost retention, edit batching, per‑chunk caps |
| Save format churn during dev | H×M | `formatVersion` from first save ever written; migration tests in CI from M2 |
| Asset heterogeneity (scales/origins across 50 packs) | H×M | Pipeline normalization + per‑piece overrides + visual catalog review page |
| Browser storage eviction loses saves | L×H | `navigator.storage.persist()`, export nudges, autosave ring |
| Scope creep vs 1.0 | H×H | GAME_DESIGN §24 non‑goals + ROADMAP phase gates + DECISIONS process |
