# Polypark — UI / UX Design Specification

The UI is a hard requirement of the brief: **match the style of the reference screenshots in
`/uiinspo`** (Overwatch 1 menus: `Example_UI_1–5`; Marvel Rivals screens: `Example_UI_6–11`).
This document extracts that language into a reusable **Polypark UI Kit** and specifies every 1.0
screen with it.

Related: [GAME_DESIGN.md](../GAME_DESIGN.md) (what screens must do) ·
[TECHNICAL_ARCHITECTURE.md](../TECHNICAL_ARCHITECTURE.md) §8 (how the UI layer is built).

---

## 1. Reference analysis — what defines the style

Common DNA across all 11 references, ranked by how much it carries the look:

1. **Mega display type, skewed.** Screen titles are huge, bold, condensed, UPPERCASE, italic/skewed
   (~−8° to −12°), white or ink‑navy, top‑left (`ARCADE`, `PLAY`, `CAREER`, `HERO PROFILE`).
2. **Flat color‑block cards** with white line‑iconography, sunburst/ray patterns and diagonal
   energy; content sits in a light slab footer with dark condensed text (UI_1, UI_2).
3. **Parallelogram / clipped corners everywhere.** Cards, tabs, buttons and banners are skewed or
   corner‑cut rather than rounded (UI_6–11). Radii are near‑zero; angles do the styling.
4. **Frosted light panels** — pale blue‑lavender translucent surfaces with a subtle faceted
   low‑poly pattern, dark ink text (UI_4, UI_6, UI_7, UI_10).
5. **Dark top bar with skewed tabs**; the active tab is filled accent (yellow/orange) with an
   underline notch (UI_6–10).
6. **Ribbon/tag chips** for status: `CHANGES DAILY`, `NEW!`, `LUXURY` — small skewed rectangles
   in accent colors with white caps text (UI_1, UI_2, UI_9).
7. **Stat tiles**: thin‑line circular icon + label + huge bold number (UI_6, UI_7).
8. **Player identity chip** top‑right (avatar block + name + currency counters) (UI_1–3, UI_8).
9. **Bottom hint rail**: bottom‑left feed/chat hint, bottom‑right keycap hints (`ESC BACK`) —
   keycaps drawn as small dark squares with white glyphs (all).
10. **Escalating value cards** for tiered offers, diagonal separators, price slab at bottom (UI_11).
11. **In‑game HUD** (UI_5): corner‑anchored clusters, a central circular % gauge, ability keycaps
    bottom‑right, objective + timer top‑center, feed top‑left. Diegetic space stays clean.

**Polypark twist:** identical grammar, sunnier soul. We keep the geometry and layout rhythm but
shift hue to a park palette (sky, sun, grass), swap military iconography for park iconography
(coaster silhouette, balloon, ticket), and let the low‑poly faceted background pattern double as
our literal art style (the UI facets echo the Tabletop's polygons).

---

## 2. Design tokens

Implemented as CSS custom properties + Tailwind theme extension
(`src/ui/theme/tokens.css`). Values are the planning baseline; tune only via this file.

### 2.1 Color — core

| Token | Value | Role (from refs) |
|-------|-------|------------------|
| `--ink-900` | `#10151F` | Near‑black surfaces (dark top bars, store bg) |
| `--ink-700` | `#1E2A3A` | Primary text on light, slab footers text |
| `--ink-500` | `#3A4B61` | Secondary text |
| `--frost-100` | `#F2F5FA` | Card slab / panel top surface |
| `--frost-200` | `#E6EBF4` | Panel body (frosted light) |
| `--frost-300` | `#D8DFEE` | Panel alt rows, faceted bg base |
| `--frost-glass` | `rgba(230,235,244,0.86)` | Overlay panels above the 3D view |
| `--sun-500` | `#FF9F1C` | **Primary action** (orange CTA — `FIND GROUP` energy) |
| `--sun-600` | `#E88A00` | Primary hover/pressed |
| `--gold-400` | `#FFD249` | Active tab fill, selection outline (Rivals yellow) |
| `--sky-500` | `#2E9BFF` | Interactive accents, links, slider fills (OW blue) |
| `--grass-500` | `#37C871` | Success, valid ghost, money‑up |
| `--danger-500` | `#F0426C` | Danger, invalid ghost, money‑down |
| `--white` | `#FFFFFF` | Icons/text on color blocks |

### 2.2 Color — kit accents (card family)

Each Theme Kit owns a card color (used exactly like UI_1's arcade card family):

| Kit | Token | Value |
|-----|-------|-------|
| Boardwalk | `--kit-boardwalk` | `#2E62E8` (royal blue) |
| Pirate Cove | `--kit-pirate` | `#0FA3A8` (teal) |
| Cosmic Port | `--kit-cosmic` | `#7C5CFF` (violet) |
| Spooky Hollow | `--kit-spooky` | `#D6197F` (magenta) |
| Storybook Keep | `--kit-storybook` | `#8A6CE0`→reuse violet family `#5A48C7` |
| Winterfest | `--kit-winter` | `#3FB7E8` (ice) |
| Grand Prix | `--kit-gp` | `#E8452E` (racing red) |
| Rails & Trails | `--kit-rails` | `#1E9E4A` (forest) |
| Putt Paradise | `--kit-putt` | `#7CB518` (fairway) |
| Cuddle Corral | `--kit-cuddle` | `#F5A623` (amber) |
| Marble Gardens | `--kit-marble` | `#5E6C84` (slate) |

Rule: kit colors appear on **card headers, catalog filters and map overlays only** — never for
semantic states (success/danger stay reserved).

### 2.3 Typography

Self‑hosted via `next/font` (OFL licenses, no network fetch):

| Role | Font | Usage |
|------|------|-------|
| **Display** | *Archivo Black* + CSS `transform: skewX(-8deg)` | Mega titles (`SUNNY MEADOWS`), star numbers. The skew is applied by the `<DisplayTitle>` component, not baked into copy. |
| **Heading / UI** | *Barlow Semi Condensed* (500/600/700, real italics) | Tabs, card titles, buttons, panel headers |
| **Body** | *Barlow* (400/500) | Tooltips, Parkopedia, descriptions |
| **Numerals** | *Barlow Condensed* 600 `font-variant-numeric: tabular-nums` | Money ticker, stat tiles, tables |

Scale (rem): display 4.5/3.5 · h1 2.25 · h2 1.5 · h3 1.25 · body 1.0 · small 0.875 ·
micro‑caps 0.75 (letter‑spacing 0.08em, uppercase). Readable‑font accessibility toggle swaps
Display→Barlow Semi Condensed 700 unskewed (GAME_DESIGN §22).

### 2.4 Geometry & effects

| Token | Value | Notes |
|-------|-------|-------|
| `--skew-ui` | `-8deg` | Cards, tabs, buttons (counter‑skew inner content `+8deg` so text stays upright where needed — Rivals does both; we skew text on titles/tabs, keep body text upright) |
| `--skew-display` | `-10deg` | Mega titles |
| `--radius` | `2px` | Near‑sharp corners everywhere |
| `--cut` | `12px` | Corner‑cut size for clipped panels (`clip-path`) |
| Spacing | 4 px base grid | 4/8/12/16/24/32/48/64 |
| Elevation | `0 2px 0 rgba(16,21,31,.18)` + 1px ink border‑bottom | Flat "slab" shadow, no soft blurs on cards |
| Facet pattern | Generated SVG low‑poly triangulation, 4% ink opacity on `--frost-200/300` | Panel & hub backgrounds (UI_4/6/7); one shared asset, hue‑shiftable |
| Sunburst | Radial 12‑ray SVG, 12% white | Card headers (UI_1), celebration moments |
| Scrim | `linear-gradient(rgba(16,21,31,.55), transparent)` | Over 3D for title/hub legibility |

### 2.5 Motion

Framer Motion (`motion`) with global reduced‑motion switch (GAME_DESIGN §22).

| Pattern | Spec |
|---------|------|
| Panel in/out | 200 ms, `cubic-bezier(.2,.9,.25,1)`, slide 24 px along the skew axis + fade |
| Card hover | 120 ms: lift 2 px, white edge‑light 2 px on the leading skew edge (UI_2's selected card) |
| Tab switch | Underline notch slides 160 ms; content crossfade 120 ms |
| Toast | Slide from feed corner, 240 ms in, auto‑out 6 s, stack max 4 (UI_5 feed) |
| Mega title | On screen enter: clip‑reveal along skew, 320 ms, once per navigation |
| Celebration | Full‑width diagonal banner sweep + sunburst, 800 ms, park fireworks in 3D (no strobe) |
| Numbers | Money/XP tick via odometer roll 300 ms, tabular‑nums prevent jitter |

### 2.6 Sound hooks (see GAME_DESIGN §21)

`ui/snap`, `ui/hover` (subtle, ≤ −24 LUFS), `ui/confirm`, `ui/deny`, `ui/toast-good`,
`ui/toast-bad`, `ui/coin`, `ui/levelup`, `ui/star`. Every hook fires a caption event into the
toast log when captions are enabled.

---

## 3. Component library (Polypark UI Kit)

React components in `src/ui/kit/` — Radix primitives underneath for focus/keyboard/a11y.
Storybook‑style gallery page at `/dev/uikit` (dev builds only) renders every component in every
state for visual regression.

| Component | Anatomy / states | Ref |
|-----------|------------------|-----|
| `<DisplayTitle>` | Skewed Archivo Black, optional sub‑line; `reveal` on mount | UI_1/2 titles |
| `<KitCard>` | Color header (kit token) + sunburst + white icon; frost slab footer: eyebrow (`4V4`‑style micro‑caps), title, meta row; states: default/hover/selected (white edge‑light + scale 1.02)/locked (desaturate + lock chip)/`NEW!` ribbon | UI_1/2/8 |
| `<RibbonTag>` | Small skewed chip, accent bg, white caps; variants: new/daily/locked/luxury→"KIT" | UI_1/9 |
| `<TabBar>` | Dark ink bar, skewed tab cells, active = `--gold-400` fill + notch; keyboard ←→ | UI_4/6–10 |
| `<StatTile>` | Thin‑line circle icon + micro‑caps label + huge condensed number; optional delta arrow | UI_6/7 |
| `<RowControl>` | Full‑width frost bar: label left, control right (slider+value / stepper `‹ OFF ›` / dropdown); hover brightens; the Options workhorse | UI_4 |
| `<SlabButton>` | Skewed rectangle; variants: primary (sun), secondary (frost/ink outline), danger; sizes M/L; keycap slot | UI_2 `FIND GROUP`, UI_9 purchase |
| `<Keycap>` | Small dark square, white glyph (`ESC`, `Q`, `MMB`) | all refs bottom‑right |
| `<HintRail>` | Bottom‑right row of `<Keycap>`+label pairs, context‑sensitive | all |
| `<IdentityChip>` | Top‑right: park/player block avatar (low‑poly icon), name, wallet counters (🎟, $) | UI_1–3 |
| `<OfferCard>` | Tall parallelogram, tier color escalation, art zone, price slab bottom | UI_11 (→ Loans/Marketing) |
| `<TrackScreen>` | Horizontal reward track: node tiles, claim states, page dots, big showcase panel right | UI_9 (→ Park Level) |
| `<DetailPane>` | Left list (icon rows, selected = white card + gold outline) + right live preview panel + description slab | UI_10 (→ ride/piece detail with 3D turntable) |
| `<StatBars>` | E/I/N bars: label + segmented bar (10 segments) in fixed semantic hues (E gold, I danger‑orange, N green‑sick) with value | new, styled like UI_10 difficulty stars |
| `<Toast>` | Feed line: icon chip + text + optional action; good/bad/neutral left‑edge color | UI_5 feed |
| `<ObjectiveChip>` | Top‑center pill: current objective + progress notch bar | UI_5 objective |
| `<Gauge>` | Circular segmented % gauge (build‑meter, ride cycle) | UI_5 center gauge |
| `<EmoteBubble>` | In‑world billboard: white rounded‑square + tail + EmotesPack icon; clusters collapse to count chip | Planet‑Coaster readability, drawn in Polypark geometry |
| `<Modal>` | Corner‑cut frost panel over scrim; title bar w/ skewed header; max 1 at a time, ESC closes | UI_4 |
| `<DataTable>` | Frost rows, ink header caps, tabular numerals, sortable | Finance panel |
| `<MiniMap>` | Corner‑cut frame, kit‑color overlays, camera frustum diamond | new |

Iconography: single stroke‑weight white line icons (Lucide base + custom park set: coaster,
ticket, wrench, broom, mascot, loan, star). Filled silhouettes only inside `<KitCard>` headers.

---

## 4. Layout system

- **Safe frame:** 24 px outer margin at 1080p (scales with UI scale setting); HUD clusters pin
  to corners like UI_5 — center stays clear for the park.
- **Panel column widths:** management panels open as a right column 420 px (1 col) or 720 px
  (2 col); never full‑screen while the sim runs — the park stays visible (P2).
- **Full screens** (Title/Hub/Reports/Track) may cover 100% with the 3D diorama or facet bg
  behind a scrim.
- **Z‑layers:** 3D view → in‑world billboards (emotes) → HUD corners → panels → modals → toasts
  → tutorial coach‑marks.
- Breakpoints: desktop‑first 1280+; playable to 1024; below → "best at desktop" notice screen
  (mobile support is a post‑1.0 architecture requirement only).

---

## 5. Screen inventory & flows

```
Boot → Title ─ CONTINUE (last autosave)
        ├─ PLAY → Hub:Play cards (Career / Sandbox / My Parks / Collection / Profile)
        ├─ OPTIONS (tabs: Video · Audio · Controls · Gameplay · Accessibility)
        └─ EXTRAS (Parkopedia · Replay tutorials · Credits/licenses)
Hub:Career → Scenario detail → Loading vignette → In‑Game
Hub:Sandbox → Setup form → In‑Game
In‑Game overlays: Build Catalog · Inspector · Management (Finance/Guests/Staff/Rating/Loans/
Marketing) · Park Level Track · Monthly Report · Pause/Options · Photo key
```

Loading vignettes show a rotating 3D diorama slice + one gameplay tip; target < 4 s warm.

---

## 6. Screen specs (mapped to references)

### 6.1 Title Screen ← UI_3 (OW main menu)

Left‑aligned vertical menu in Display type: `CONTINUE` (largest, only if autosave exists),
`PLAY`, `OPTIONS`, `EXTRAS`. Background: live 3D vignette of the player's latest park (or a
bundled showcase diorama on first run) with slow orbit, morning light, guests strolling; scrim
left. Top‑left: Polypark logotype (Archivo Black, skew, coaster‑hill underline). Top‑right
`<IdentityChip>` (profile name + 🎟). Bottom‑right `<HintRail>`. Version tag bottom‑left.
First‑run: name prompt modal ("What's your builder name?") — feeds profile + leaderboard later.

### 6.2 Hub — Play ← UI_2 (OW Play cards)

`PLAY` mega title. Four `<KitCard>`s in a row: **CAREER** (blue, coaster icon, star progress
meta), **SANDBOX** (green, shovel icon), **MY PARKS** (amber, save icon, "12 parks" meta),
**COLLECTION** (violet, ticket icon, `NEW!` ribbon when affordable unlock exists). Below‑center:
`<SlabButton primary>` `CONTINUE LAST PARK`. Profile stats strip bottom (StatTiles: lifetime
guests, stars, best rating).

### 6.3 Career select ← UI_1 (Arcade grid)

Grid of scenario `<KitCard>`s (kit color per scenario, 2 rows × 4). Card meta: star pips ★★☆,
"NEW" ribbon, lock state with requirement ("Earn 4★ total"). Top‑right: total stars + 🎟 wallet +
next‑unlock pips (UI_1's weekly rewards slot). Selecting → **Scenario detail** overlay
(`<DetailPane>`): left objectives list (1★/2★/3★ rows), right diorama preview turntable +
`START` primary.

### 6.4 Sandbox setup — Setup form on frost facet bg

RowControls: plot size, starting cash slider, difficulty stepper, events toggle, all‑unlocked
toggle, weather profile dropdown, starting kits multi‑select (KitCard minis). Right column: live
summary card + `CREATE PARK`.

### 6.5 My Parks — save management

DataTable+cards hybrid: thumbnail (auto‑captured on save), name, mode, rating, cash, played,
`LOAD / DUPLICATE / EXPORT / DELETE` (delete = danger confirm modal). Import drop‑zone card for
`.polypark` files. Autosaves listed under a divider, per‑park.

### 6.6 Build Catalog (in‑game) ← UI_8 (roster grid)

Opens from HUD dock (`B`). Left `<TabBar>` (vertical): Rides · Shops · Facilities · Scenery ·
Paths · Blueprints. Top filter row: Theme Kit chips (kit colors) + search + "unlocked only"
toggle. Grid of portrait cards: piece render (auto‑generated thumbnail, ASSET_GUIDE §5), name,
cost, footprint chip, E/I/N micro‑bars for rides, lock state shows unlock source ("Park Level
14"). Hover = white edge‑light; selected → **placement mode** with bottom placement bar
(rotate ⟲ `R`, variant swatches, cost ticker, `ESC` cancel). Category hotkeys 1–6.

### 6.7 Park Level Track ← UI_9 (battle‑pass)

`<TrackScreen>`: horizontal nodes L1→L30 with piece thumbnails; claimed/claimable/locked states;
A/B choice nodes render as split tiles (pick one, other greys with "returns at L+3"). Right
showcase: selected node's 3D turntable + description. Header: park name, level, XP bar with
tabular numbers. Zero monetization language — the `LUXURY` slot of the ref becomes `MILESTONE`
(fireworks node every 5 levels).

### 6.8 Management panels ← UI_6/7 (Career stats) + UI_4 (rows)

One window, `<TabBar>` top: **Finance · Guests · Staff · Rating · Loans · Marketing**.
- *Finance:* StatTile row (cash, monthly net, park value) + income/expense DataTable + 12‑month
  sparkline cards.
- *Guests:* live counters by archetype (StatTiles), needs heat summary, thoughts feed (emote +
  quote lines, filterable).
- *Staff:* roster cards (portrait, trait chip, zone button, wage) + hire card; zone painting
  drops you to the map with a brush overlay.
- *Rating:* big 0–5.0 display + five sub‑score StatTiles with trend arrows; each expands to a
  "top 3 causes" list in plain language (P5).
- *Loans:* ← UI_11: three escalating `<OfferCard>`s (Piggy Bank / Park Trust / The Consortium),
  active loans table with payoff buttons, credit grade badge A–E with tooltip explaining it.
- *Marketing:* campaign OfferCards (Flyers/Online/Mascot Parade) with duration+reach+cost and a
  live "expected archetype" preview.

### 6.9 Inspector (click any placed thing) ← UI_10 (detail pane)

Right panel 420 px. Header: name (editable), kit chip, close. Tabs by type — Ride: Overview
(status light, uptime, E/I/N `<StatBars>`, synergy meter), Pricing (ticket slider with live
demand curve hint), Ops (test/open/close, refurb button with cost, staff assignment), Stats
(riders, income sparkline). Shop: menu price/portion rows + margin readout. Guest: identity card,
needs bars, thought log, "follow" camera toggle. Staff: trait, zone, energy, praise/raise button.

### 6.10 In‑game HUD ← UI_5 (OW HUD grammar)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ToastFeed(⤓)                ObjectiveChip ▾            IdentityChip │
│ (events, capped 4)      "★ Reach 3.5 rating 3.2/3.5"   name · 🎟 · ⚙ │
│                                                                      │
│                         ( clean 3D center )                          │
│                                                          MiniMap    │
│ $ 128,450 ▲ +2,310/mo   ┌ Build dock ────────────┐      ┌────┐     │
│ ★ 3.2 · 👥 642 · L14 ▓▓░ │ 🎢 🍔 🚻 🌳 🛤 📋 │ ▶▶ 2× ⏸ │      └────┘     │
└─ wallet & park vitals ──┴─ B: catalog ─ speed ────┴──── HintRail ──┘
```

- Bottom‑left **vitals cluster**: money (odometer, green/red delta), rating stars, guest count,
  Park Level mini‑bar. Click any → opens matching management tab.
- Bottom‑center **build dock**: 6 category buttons (opens Catalog filtered) + speed controls
  (⏸/1×/2×/4×, hotkeys `Space`, `1‑3`).
- Top‑center `<ObjectiveChip>`; top‑left toast feed; top‑right IdentityChip + settings; minimap
  above HintRail bottom‑right.
- Weather+clock strip attaches to the ObjectiveChip's left (icon, time, 3‑day forecast pips).
- Everything hides in Photo key (`P`) and tutorial can spotlight single clusters.

### 6.11 Monthly Report — full overlay on facet bg

Three‑panel: StatTile headline row (net, guests, rating delta with big arrows) → event recap
feed (icon lines) → **one suggested focus** card (Advisor) + `CONTINUE` primary (auto‑pauses
until dismissed; setting to disable pause).

### 6.12 Options ← UI_4 (rows, faithful)

Tabs: Video (quality preset, resolution scale, fps cap, bloom, VSync) · Audio (4 sliders,
captions toggle) · Controls (rebind table rows with Keycap cells, presets, invert, edge‑pan
toggle+speed) · Gameplay (autosave cadence, Advisor on/off, tooltips verbosity, currency format,
pause‑on‑report) · Accessibility (UI scale slider 80–140, readable font, reduced motion,
colorblind‑safe emote variants, hold‑to‑toggle alternatives). Footer: `RESTORE DEFAULTS` +
per‑tab reset, exactly like the ref.

### 6.13 Onboarding overlays (GAME_DESIGN §19)

Coach‑marks: corner‑cut frost cards with a skewed accent header, one paragraph max, anchored
with a notch to their target; dim‑spotlight cutout on the highlighted control; `NEXT` /
`SKIP TUTORIAL` (always available). Objective steps mirror in the ObjectiveChip. Parkopedia
opens as a Modal with TabBar sections and search.

---

## 7. UX rules (bindable, testable)

1. **Two‑click rule:** any management answer ("why is Value low?") reachable in ≤2 clicks from
   HUD; every stat expands to plain‑language causes.
2. **Never trap:** ESC always closes the top layer; no modal without a visible close; the sim
   never advances while a blocking modal is open (except toasts).
3. **Hover = truth:** every number, icon and lock state has a tooltip stating cause or unlock
   source. Tooltip delay 300 ms, instant while build‑ghosting.
4. **One popup at a time:** events arrive as toasts; only bankruptcy/inspection‑result and
   scenario stars may modal.
5. **Feedback triple:** every placement/purchase fires visual (ghost→pop), audio (snap/coin) and
   numeric (ticker) feedback within 100 ms.
6. **Undo everything buildable** (GAME_DESIGN §7.1); destructive UI actions (delete save,
   bulldoze occupied ride) require typed‑name or double‑confirm respectively.
7. **Keyboard parity** for all non‑pointer‑inherent actions; visible focus rings (gold, 2 px).
8. **Copy voice:** carnival‑barker warmth, ≤2 sentences per tooltip, verbs first ("Hire a
   janitor to clear litter"), never blame the player.

---

## 8. Camera & input (in‑game)

- **Camera:** orbital RTS cam. LMB select · RMB‑drag orbit · MMB/edge/WASD pan · wheel
  zoom‑to‑cursor (8 m → 220 m) · `Q/E` rotate 45° snapped (hold Shift = free) · pitch clamp
  15°–70° · `Home` frames the gate. Optional slow cinematic auto‑orbit when idle 60 s (toggle).
- **Build mode:** ghost follows cursor with grid highlight + footprint outline; `R` rotate,
  scroll‑click variant cycle, drag = run placement for paths/fences/queues; Shift‑drag rectangle
  fill for scenery; `Del` bulldoze brush; `Ctrl+Z/Y` undo/redo.
- **Selection:** click = inspector; double‑click ride = camera ride‑along (the juice moment);
  `Tab` cycles alerts (broken rides etc.).
- Full default keymap table maintained in Parkopedia and Options→Controls (single source:
  `src/ui/input/keymap.ts`).

---

## 9. Acceptance criteria (M5 "UI complete" gate, see ROADMAP)

- [ ] Every screen in §6 implemented with tokens from §2 only (no ad‑hoc colors/fonts).
- [ ] Side‑by‑side eyeball test against `/uiinspo` passes for: card grid, options rows, track
      screen, detail pane, HUD corners (internal review checklist).
- [ ] `/dev/uikit` gallery renders all components × states; Playwright visual snapshots stable.
- [ ] Keyboard‑only full playthrough of tutorial possible; axe‑core audit: 0 critical issues.
- [ ] Reduced‑motion + readable‑font + 140% scale modes verified on all §6 screens.
- [ ] All copy strings externalized (i18n‑ready), no lorem ipsum anywhere.
