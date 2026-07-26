# Polypark — Asset Guide

Inventory, licensing, gameplay mapping and pipeline plan for the CC0 packs in `/assets`.

Related: [GAME_DESIGN.md](../GAME_DESIGN.md) §8–10 (what the content becomes) ·
[TECHNICAL_ARCHITECTURE.md](../TECHNICAL_ARCHITECTURE.md) §5 (pipeline implementation).

---

## 1. Inventory snapshot

Verified against the repo (2026‑07): **50 packs**, ~4,100 GLB/GLTF models total, plus PNG/SVG
2D packs. Primary format is GLB with shared `colormap.png` palette textures (tiny, atlas‑style)
— ideal for instancing and draco/meshopt compression. Some packs ship OBJ/FBX/DAE duplicates
(ignored by the pipeline); `Kenney_PlatformKit` is OBJ‑only (converted at build time);
`KayKit_RestaurantBits` is `.gltf` (converted to GLB).

| Category | Packs (model count) |
|----------|---------------------|
| Park core | CoasterKit (183) · NatureKit (329) · FoodKit (200) · MinigolfKit (126) · TrainKit (103) · RacingKit (112) · ToyCarKit (157) · WatercraftKit (46) · MarbleKit (162) |
| Buildings & city | ModularBuildingsKit (108) · BuildingKit (79) · CityKitCommercial (41) · CityKitIndustrial (25) · CityKitSuburban (40) · CityKitRoads (72) · KayKit CityBits (41) |
| Themes | PirateKit (72) · SpaceKit (153) · ModularSpaceKit (40) · KayKit SpaceBase (57) · GraveyardKit (91) · Spooktober (48) · CastleKit (76) · KayKit Dungeon (185) · Medieval Hexagon (221) · ModularDungeonKit (39) · Minidungeon (25) · ModularCaveKit (40) · HolidayKit (99) · FantasyWeaponsBits (31) · RPGToolsBits (49) |
| Characters | BlockyCharacters (18 rigs + 18 palette textures) · CuteCharacters (27, incl. wheelchair, cane, aid props) · CubePets (24 animals) · KayKit Skeletons (19) |
| Props & misc | FurnitureKit (140) · KayKit FurnitureBits (53) · FactoryKit (143) · SurvivalKit (80) · TDKit (160) · MiniArena (22) · MiniForest (22) · MiniMarketKit (20) · MiniSkateKit (20) · PrototypeKit (145) · PlatformKit (OBJ) |
| 2D | **Skyboxes** (5 PNG: morning/day/night/space/alien) · **EmotesPack** (530 PNG, 4 styles) · **PatternPack** (254 PNG/SVG) |

Key verified details the design relies on:

- `Kenney_NatureKit` contains a complete **`ground_path*` auto‑tile family** (straight, bend,
  corner, cross, end) → the path system's art source.
- `Kenney_CoasterKit` contains **steel / hanging / mouse / flume** track families with hills and
  loops, **stations, supports, queue pieces and trains** → the track builder vocabulary.
- `Kenney_FoodKit` includes oversized‑ready food props (teacups → Teacup Twirl) and 200 menu
  items for shop dressing.
- `Kenney_BlockyCharacters` ships one body rig with **18 swap textures** → guest palette variety
  via per‑instance texture index, not extra meshes.
- `Kenney_CuteCharacters` includes **wheelchair users and mobility props** → inclusive guests by
  default (GAME_DESIGN §11.1).
- `Kenney_EmotesPack` ships 530 emote glyphs in 4 styles → `<EmoteBubble>` source
  (UI_UX_DESIGN §3); pick ONE style ("Vector"/flat) for consistency.

> Piece‑level availability beyond the samples verified above must be confirmed by the generated
> catalog (see §5) at implementation start — docs mark speculative mappings with *(verify)*.

## 2. Licensing

- **Kenney packs:** CC0 1.0 (public domain) — stated per‑pack.
- **KayKit packs:** License.txt verified: *"License: (Creative Commons Zero, CC0)"*.
- Obligations: none, but we credit both creators prominently in Extras→Credits (and the README)
  because it's right. **Rule:** nothing enters `/assets` or the shipped bundle unless CC0;
  record every addition in this file's §7 log. Fonts are OFL (bundled via `next/font`), which is
  compatible with static self‑hosting.

## 3. Repository rules

1. `/assets` is the **immutable source library** — never edit, rename or delete inside packs;
   never import from it at runtime.
2. Shipped models live in `/public/models/**` and are produced only by the pipeline (§5) from
   `/assets`; regenerate, don't hand‑edit.
3. Unused packs stay in the repo (free future content) but are excluded from builds by default
   via the manifest allow‑list.
4. Big‑file hygiene: no new binary >20 MB without a DECISIONS entry; prefer regenerating.

## 4. Pack → gameplay mapping

Authoritative mapping (GDD is the "what", this is the "from where"):

| Game content | Primary packs | Notes |
|--------------|---------------|-------|
| Paths/plazas/queues | NatureKit `ground_path*`, PrototypeKit surfaces, CoasterKit `queue-*` | Path skins per Theme Kit via colormap variants *(verify per kit)* |
| Track builder pieces | CoasterKit (steel/hanging/mouse/flume, supports, stations, trains) | Piece graph metadata generated in catalog |
| Poly Express | TrainKit (track incl. ramps/corners, locos, wagons, stations) | Damaged variants = "unrefurbished" visual state |
| Poly 500 Karts | RacingKit (track, barriers, flags) + ToyCarKit (karts, items) | |
| Putt Paradise | MinigolfKit (holes, bumps, obstacles, balls, flags) | Hole‑par metadata authored per piece |
| Paddle Bay / water | WatercraftKit (paddle/row boats, buoys) + water cells | |
| Marble Cascade | MarbleKit (tracks, funnels, bumpers) | Animated marbles = instanced spheres on baked paths |
| Flat rides | FoodKit (teacups) · PirateKit (ship, cannons) · SpaceKit (rockets) · Spooktober (pumpkins) · CubePets (carousel mounts) · HolidayKit (sleds) | Assembled prefabs + procedural animation (TECH §4.6) |
| Walkthroughs | GraveyardKit+Spooktober+Skeletons (Haunted Manor) · CastleKit+KayKit Dungeon (Castle Quest) | Interior scenes = curated prefab rooms |
| Shops/facilities | FoodKit, MiniMarketKit, RestaurantBits, FurnitureKit(+Bits), ModularBuildingsKit, CityBits (ATM) | Toilets verified in FurnitureKit/RestaurantBits |
| Guests/staff | BlockyCharacters (+18 palettes), CuteCharacters, Skeletons (Spooky entertainers), CubePets (mascot heads, Cuddle Corral) | |
| Scenery per kit | See GAME_DESIGN §10 table | TDKit/MedievalHexagon feed Storybook props; FactoryKit/SurvivalKit = backstage |
| Park surroundings | CityKit* roads/buildings vignette outside the gate, MiniForest island rim | Non‑interactive dressing |
| Skybox & time | Skyboxes pack (5) | morning/day/night cycle; alien+space for Cosmic scenario |
| Emote bubbles | EmotesPack (one style) | Mapping table in GAME_BALANCE §10 |
| UI patterns | PatternPack (facet/burst source), custom SVG | Used only as source material for generated UI SVGs |
| Post‑1.0 reserves | PlatformKit, ModularCaveKit, MiniSkateKit, MiniArena extras, PirateKit ships (sea rides), Medieval Hexagon terrain | Documented so nobody "cleans them up" |

## 5. Content pipeline (planned — implemented in M0/M1)

`scripts/build-content.ts` (run locally + CI; deterministic output):

1. **Select** — read `content/manifest.ts` (allow‑list of pack/piece IDs actually used).
2. **Normalize** — convert OBJ/GLTF→GLB, Y‑up, meters, origin at footprint center‑bottom,
   merge duplicate materials, strip unused nodes.
3. **Optimize** — `gltf-transform`: dedupe, prune, weld, quantize + meshopt; palette PNGs
   verified ≤64 KB; report per‑file before/after sizes.
4. **Catalog** — emit `public/content/catalog.json`: per piece `{id, pack, file, footprint,
   anchor, tags, kit, category, variants, trackPorts?}` (footprints from AABB + hand overrides in
   `content/overrides/*.ts`). The catalog is the single source of truth the sim/UI/renderer read.
5. **Thumbnails** — headless render (playwright + three) of every catalog piece → webp grid for
   the Build Catalog UI.
6. **Budget gate** — CI fails if: any single GLB >1.5 MB, theme bundle >8 MB, total shipped
   models >60 MB (budgets: TECH §10).

## 6. Gaps & risks (needs sourcing or custom work)

| Gap | Impact | Plan |
|-----|--------|------|
| **Audio: none in repo** | Blocks §21 audio direction | Add Kenney CC0 audio packs (UI Audio, Interface Sounds, Music Jingles) + CC0 music loops; needs user OK → DECISIONS Q‑05 |
| No balloon/firework/carousel‑horse models | Minor flavor | Fireworks = shader particles; carousel uses CubePets mounts; balloons post‑1.0 custom |
| No ride‑specific mechanical parts (swing arms, spin hubs) | Flat rides need armatures | Build tiny generic "mech" set from PrototypeKit/FactoryKit pieces at assembly time *(verify)* |
| UI icons (park‑specific) | Catalog/HUD clarity | Lucide (MIT) + hand‑drawn SVG set in repo style |
| Fonts | UI identity | Archivo Black / Barlow family via `next/font` (OFL) |
| Guest animations | Rigs exist; clips minimal | Procedural crowd animation (TECH §6.3) — no external animation packs needed |

## 7. Asset change log

| Date | Change | By |
|------|--------|----|
| 2026‑07‑26 | Initial inventory of 50 packs documented; no files modified | planning |
