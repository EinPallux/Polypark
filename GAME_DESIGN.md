# Polypark — Game Design Document

> **Snap together the park of your dreams.**
> A 3D low‑poly theme‑park tycoon for the browser. Build rides from toy‑kit pieces, delight blocky
> guests, survive storms, loans and inspections, and grow a roadside lot into a five‑star wonderland.

**Status:** Planning approved deliverable — no code yet (see [ROADMAP.md](ROADMAP.md), Phase gate).
**Companion docs:** [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) ·
[docs/UI_UX_DESIGN.md](docs/UI_UX_DESIGN.md) · [docs/GAME_BALANCE.md](docs/GAME_BALANCE.md) ·
[docs/ASSET_GUIDE.md](docs/ASSET_GUIDE.md) · [docs/DECISIONS.md](docs/DECISIONS.md)

---

## Table of contents

1. [Vision](#1-vision)
2. [Design pillars](#2-design-pillars)
3. [Inspiration mapping](#3-inspiration-mapping)
4. [Game structure & modes](#4-game-structure--modes)
5. [The world: the Tabletop](#5-the-world-the-tabletop)
6. [Core loops](#6-core-loops)
7. [Construction system](#7-construction-system)
8. [Attractions](#8-attractions)
9. [Shops & facilities](#9-shops--facilities)
10. [Theme Kits](#10-theme-kits)
11. [Guests](#11-guests)
12. [Staff](#12-staff)
13. [Economy, debt & risk](#13-economy-debt--risk)
14. [Events, incidents & inspections](#14-events-incidents--inspections)
15. [Weather & time](#15-weather--time)
16. [Park Rating](#16-park-rating)
17. [Progression & unlocks](#17-progression--unlocks)
18. [Career scenarios](#18-career-scenarios)
19. [Onboarding & tutorial](#19-onboarding--tutorial)
20. [Session design & the "one more month" loop](#20-session-design--the-one-more-month-loop)
21. [Audio direction](#21-audio-direction)
22. [Accessibility](#22-accessibility)
23. [Content safety & tone](#23-content-safety--tone)
24. [Out of scope for 1.0](#24-out-of-scope-for-10)
25. [Glossary](#25-glossary)

---

## 1. Vision

Polypark is a **toybox theme‑park tycoon**. Every park is a diorama on a floating island — "the
Tabletop" — built from chunky CC0 low‑poly kits that snap together like a toy set. The player is
part architect, part shopkeeper, part ringmaster: they lay paths, snap coaster track piece by piece,
price the churros, hire the janitor, take the risky loan, and watch a thousand little blocky guests
think in emoji bubbles.

The fantasy: **"I built this, it's alive, and it's mine."**

Polypark is a real management game, not a decorating toy. Money is earned and lost. Rides break.
Storms close the drop tower. The bank calls. The safety inspector shows up unannounced. But the tone
stays warm and funny — failures produce cartoon smoke, never harm — and every problem has a
readable cause and a fix.

Target player & platform:

- Desktop browser first (mouse + keyboard), deployed on Vercel. Single player.
- Fans of Planet Coaster / Planet Zoo / Two Point / Aquapark Tycoon who want a "real one" in the
  browser: sessions of 20–90 minutes, save anywhere, no account, no monetization.
- A post‑1.0 friends leaderboard via share codes — no login ever.

---

## 2. Design pillars

Every feature must serve at least one pillar. When in doubt, cut against these.

| # | Pillar | What it means in practice |
|---|--------|---------------------------|
| P1 | **Toybox tactility** | Placement is the core joy: satisfying snaps, chunky ghosts, click‑clack feedback, undo without fear. If building feels like Lego, we win. |
| P2 | **A legible living park** | Every guest tells you how they feel (emotes, color, posture). Every problem is visible in the world before it's a number in a panel. |
| P3 | **Real stakes, warm tone** | Debt, breakdowns, inspections and weather create genuine tension — consequences are financial and reputational, never gruesome. |
| P4 | **Always a next goal** | At any second the player can name their current goal in one sentence. Objectives, unlock tracks and monthly reports keep three horizons visible: *now / soon / dream*. |
| P5 | **Explain everything** | Every system has a plain‑language tooltip, a Parkopedia page, and an in‑world cue. No wiki required, ever. |
| P6 | **Modern‑game polish** | Title screen, hub, options, juice, audio, save slots, accessibility. It should feel like a Steam release that happens to run in a tab. |

---

## 3. Inspiration mapping

| Source | What we take | What we deliberately don't take |
|--------|--------------|---------------------------------|
| **Planet Coaster** | Guest emote readability, coaster pride, park rating pressure, scenario stars | Free‑form spline coasters & terraforming (piece‑snap instead — see §7) |
| **Planet Zoo** | Animal corner charm (Cuddle Corral), staff with jobs & morale‑lite | Deep animal welfare sim |
| **Two Point Museum / Hospital** | Humor in copy, room/prefab clarity, escalating scenario chain that teaches one system at a time | Wall‑by‑wall room drawing |
| **Aquapark Tycoon** | Small‑lot start → visible growth, per‑attraction pricing, quick session satisfaction | Water‑physics slides (Log Flume + Paddle Bay cover the splash fantasy) |
| **Overwatch / Marvel Rivals (uiinspo)** | The entire UI language: skewed bold headers, card grids, stat tiles, track screens, row‑based options — see [docs/UI_UX_DESIGN.md](docs/UI_UX_DESIGN.md) | Nothing — UI style is a hard requirement |

---

## 4. Game structure & modes

Structure of a modern game, front to back:

```
Boot (loading, autosave check)
 └─ Title Screen ─ CONTINUE / PLAY / OPTIONS / EXTRAS
     └─ Hub ("Park Gate")
         ├─ CAREER  — scenario select (stars, unlock chain)
         ├─ SANDBOX — new custom park (plot size, cash, difficulty, toggles)
         ├─ MY PARKS — save slots: load / duplicate / export / import / delete
         ├─ COLLECTION — Theme Kits, blueprints, milestones (Star Ticket spending)
         └─ PROFILE — lifetime stats, records (leaderboard lives here post‑1.0)
             └─ In‑Game (HUD + build mode + management panels + pause)
```

### Modes at 1.0

- **Career** — 8 hand‑built scenarios (§18). Each is a distinct plot, starting condition and
  objective set with 1★/2★/3★ tiers. Scenario 1 *is* the tutorial. Career order teaches systems
  one at a time; later scenarios can be entered with any earlier park's lessons but gate on stars.
- **Sandbox** — any unlocked plot, configurable: starting cash ($25k–$500k or ∞), difficulty
  (§13.4), events on/off, all‑content‑unlocked toggle (off by default so sandbox still has
  progression), weather profile, starting Theme Kits.

### Post‑1.0 (explicitly not in 1.0)

- Weekly **Challenge seeds** (fixed seed + fixed ruleset, compare results).
- **Leaderboard** — the very last roadmap phase, friends‑compare via share codes (see
  TECHNICAL_ARCHITECTURE §12).

---

## 5. The world: the Tabletop

- Each park sits on a **floating island diorama** in a skybox — the visual signature of Polypark
  (and a performance win: bounded world, no horizon to fill). Skybox variants: morning / day /
  night (cycle), plus *alien* and *space* for Cosmic Port scenario flavor.
- The buildable area is a **grid of 2×2 m cells**. Career plots range 24×24 → 64×64 cells;
  Sandbox up to 96×96 (see perf budgets, TECHNICAL_ARCHITECTURE §10).
- **Land expansion:** adjacent 8×8‑cell chunks can be purchased; the island visibly *grows* —
  new tabletop sections slide in and snap on with dust poofs (P1). Cost scales per chunk (see
  GAME_BALANCE §3).
- **Terrain:** flat build surface at 1.0 with cosmetic surface painting (grass, sand, pavement,
  snow) and water cells (dug 1 level down) for Log Flume / Paddle Bay / scenery. No height
  sculpting at 1.0 (post‑1.0 candidate; the decorative island rim fakes elevation charm).
- The **Park Gate** sits on one edge (relocatable in sandbox): spawn point, ticket booths, and the
  connection to the outside world (a tiny road vignette from the City kits sells the "somebody
  drove here" fiction).

---

## 6. Core loops

### Minute loop — build & react (P1, P2)

```
Place / price something → guests respond visibly (queues, emotes, coins)
→ spot a problem in the world (litter, long queue, sad bubble)
→ fix it (build / staff / price) → immediate visible improvement
```

### Session loop — the month (P3, P4)

Every in‑game month (≈10 real minutes at 1×) ends with a **Monthly Report**: income vs costs,
rating delta, standout events, and *one suggested focus* ("Guests want more thrill rides").
Payday, loan interest, wages and inspections all land on month boundaries, giving sessions a
heartbeat and a natural save/quit point that still tempts "one more month".

### Park loop — from lot to landmark (P4)

```
Open a modest park → hit guest/rating milestones → Park Level up → unlock content
→ invest (cash or loan) in a marquee ride → appeal jumps → more guests, more strain
→ expand land, staff up, diversify themes → 5★ park / scenario ★★★
```

### Meta loop — the Collection

Career stars and milestones award **Star Tickets 🎟** spent in the Hub **Collection** to
permanently unlock Theme Kits and blueprints across all future parks. One playthrough's triumph
seeds the next park's toybox.

---

## 7. Construction system

The heart of the game. Everything placeable is a **piece** from a kit (mirroring the real CC0
packs — see docs/ASSET_GUIDE.md).

### 7.1 Placement rules

- **Grid snap** with 90° rotation for buildings/rides; scenery props additionally support 45°
  rotation and free nudge within a cell (¼‑cell offsets) for organic dressing.
- **Footprints:** every object defines cells occupied + required clearance + entrance cell(s)
  that must touch path. Ghost preview shows green (valid) / red (invalid) with a one‑line reason
  ("Needs path at entrance").
- **Paths** are first‑class: drag to paint, auto‑tiling (straight/corner/T/cross from the
  `ground_path*` tile family), 1‑cell wide standard, plazas by area‑fill. Queues are a special
  path type snapped to a ride entrance (from CoasterKit queue pieces).
- **Delete/refund:** bulldoze returns 70% of build cost (100% within 30 s of placement — guilt‑free
  experimentation, P1). Full **undo/redo** stack for all build actions.
- **Blueprints:** any owned selection can be saved as a blueprint and re‑stamped (cost = sum of
  pieces). Unlockable pre‑made blueprints ship per Theme Kit for players who don't want to design.

### 7.2 Track builder (signature feature)

Coasters and tracked rides are built **piece by piece, like the physical toy kits** — not splines.
The CC0 CoasterKit pieces literally are the vocabulary: straight, curve, bank, hill‑up/down,
loop, corkscrew‑adjacent skews, station, brake, chain lift.

- Snap the next piece to the open end; the builder shows valid next pieces only (pieces whose
  entry pose matches the current exit pose). Rotate through options with scroll/Tab.
- A track is **valid** when it forms a closed circuit through ≥1 station with a chain/launch able
  to return the train home (simple energy check, TECHNICAL_ARCHITECTURE §7.4).
- Live **stat preview** while building: Excitement / Intensity / Nausea recompute per piece from
  composition (speed variance, drops, inversions, airtime pieces, scenery proximity) — numbers
  the player can chase without physics degree (formula in GAME_BALANCE §5.3).
- Track families at 1.0: **Steel**, **Wild Mouse**, **Inverted**, **Log Flume** (flume requires
  water‑adjacent splash sections), plus **Railroad** and **Go‑Kart** circuits (gentler rules, no
  energy check).
- Supports auto‑generate under elevated pieces (CoasterKit support pieces) — free, automatic,
  pretty.

### 7.3 Build UX promises (P1)

- Click‑clack snap sound + subtle scale "pop" on placement; camera‑shake OFF by default.
- Hold‑drag places path/fence runs; Shift‑drag rectangles for scenery fills.
- Eyedropper (pick placed object as brush), quick‑duplicate, move‑without‑refund.
- Color variants: kits with texture variants (e.g., 18 guest palettes, flag colors) expose a
  swatch row in the placement panel.

---

## 8. Attractions

Attractions are the appeal engine. Each has: build cost, ticket price (player‑set), capacity,
cycle time, **E/I/N stats** (Excitement / Intensity / Nausea, 0–10), appeal by guest archetype,
reliability curve, upkeep, footprint, and Theme Kit affinity (scenery synergy bonus, §16).

Full stat tables live in [docs/GAME_BALANCE.md](docs/GAME_BALANCE.md) §5. The 1.0 roster
(names are player‑renamable; every model maps to owned CC0 packs — see ASSET_GUIDE §4):

### Tracked rides (custom‑buildable)

| Ride | Kit source | Fantasy | Notes |
|------|-----------|---------|-------|
| **Steelwind Coaster** | Kenney CoasterKit (steel) | The marquee custom coaster | Full track builder |
| **Mousetrap** (Wild Mouse) | CoasterKit (mouse) | Compact, whippy, cheap | Small‑park star |
| **Sky Serpent** (Inverted) | CoasterKit (hanging) | Feet‑dangling thrill, loops | High E/I, high upkeep |
| **Splashlog Flume** | CoasterKit (flume) + water | Family splash ride | Needs water cells; heatwave magnet |
| **Poly Express** | Kenney TrainKit | Park railroad | Transport ride: stations act as path shortcuts; scenic bonus from scenery seen en route |
| **Poly 500 Karts** | Kenney RacingKit + ToyCarKit | Go‑kart circuit | Guests drive; throughput from track length |
| **Putt Paradise** | Kenney MinigolfKit | Build‑your‑own minigolf | Hole‑by‑hole course builder; rating from par variety |

### Flat rides (prefab footprint, procedurally animated)

| Ride | Kit source | Fantasy |
|------|-----------|---------|
| **Teacup Twirl** | Giant FoodKit teacups on a spin platform | Classic spinner, toybox humor |
| **Galleon Swing** | PirateKit ship on swing arm | Pirate ship pendulum |
| **Rocket Orbit** | SpaceKit rockets on rotor arms | Aerial spinner |
| **Pumpkin Drop** | Spooktober pumpkin gondola tower | Drop tower (closes in storms) |
| **Critter Carousel** | CubePets animals as mounts | Gentle icon ride, family appeal |
| **Sled Slide** | HolidayKit sleds on a slope | Winterfest gravity ride |

### Experiences (walk‑through / free‑roam)

| Attraction | Kit source | Fantasy |
|------------|-----------|---------|
| **Haunted Manor** | GraveyardKit + Spooktober + Skeletons | Spooky walkthrough; scare level slider |
| **Castle Quest** | CastleKit + KayKit Dungeon | Storybook adventure walkthrough |
| **Cuddle Corral** | CubePets + MiniForest | Petting zoo; the Planet‑Zoo wink |
| **Paddle Bay** | WatercraftKit + water cells | Free‑roam paddle boats |
| **Marble Cascade** | Kenney MarbleKit | Kinetic marble‑run exhibit; watchable spectacle that boosts nearby queue happiness |
| **Poly Arena** | Kenney MiniArena + Skeletons/mascots | Scheduled live shows; pulses crowd joy |

Ride lifecycle: **reliability** decays with cycles → breakdown chance rises → Mechanic repairs →
periodic **refurbishment** (cost, downtime) resets the curve; a never‑refurbished ride ages
visually (decals, smoke puffs) and drags the Care score. Ride age also slowly decays *novelty*
appeal — refurbish or re‑theme to restore it (§16, anti‑stagnation).

---

## 9. Shops & facilities

Shops satisfy needs and print margin; facilities prevent misery. All staff‑free (vendors are part
of the shop; no per‑shop hiring micro).

| Building | Type | Satisfies | Source kits |
|----------|------|-----------|-------------|
| Snack Shack | Food stall | Hunger (light) | FoodKit + ModularBuildings |
| Grill Garden | Food stall | Hunger (heavy) | FoodKit (burgers, skewers) |
| Sweet Scoop | Food stall | Hunger + Fun bump | FoodKit (desserts, ice cream) |
| Sip Station | Drink stall | Thirst | FoodKit (drinks) |
| Poly Bistro | Sit‑down restaurant | Hunger+Energy, high margin, low throughput | KayKit RestaurantBits interior |
| Gift Kiosk | Retail | Fun + souvenir income (scales with park rating) | Kenney MiniMarketKit |
| Restroom | Facility | Bladder | FurnitureKit fixtures |
| First Aid | Facility | Nausea recovery | CuteCharacters aid props |
| ATM | Facility | Refills guest wallet (fee) | CityBits |
| Info Kiosk | Facility | Reduces "lost" state, boosts Value | ModularBuildings |
| Benches / Bins / Lamps | Props | Energy / litter prevention / night safety | NatureKit, CityKitRoads, FurnitureKit |

Shop levers: menu price, portion size (cost vs satisfaction), and one upgrade slot each
(e.g., "Combo deals": +margin, slower service). Balance tables: GAME_BALANCE §6.

---

## 10. Theme Kits

Theme Kits are Polypark's content chapters — in‑fiction toy kits that mirror the actual CC0 packs.
Each Kit = a catalog filter + scenery set + path/fence skins + 1–3 signature attractions + a kit
color used across UI (see UI_UX_DESIGN §4.4).

| Kit | Identity | Backing packs (primary) |
|-----|----------|------------------------|
| **Boardwalk** (starter) | Cheerful seaside fair | ModularBuildingsKit, FoodKit, NatureKit, CityKitRoads |
| **Pirate Cove** | Salt, cannons, gold | PirateKit, WatercraftKit |
| **Cosmic Port** | Retro‑future spaceport | SpaceKit, ModularSpaceKit, KayKit SpaceBase |
| **Spooky Hollow** | Halloween forever | GraveyardKit, Spooktober, Skeletons, ModularDungeon/Cave |
| **Storybook Keep** | Castles & knights | CastleKit, KayKit Dungeon, Medieval Hexagon, FantasyWeaponsBits |
| **Winterfest Village** | Cozy snow holiday | HolidayKit |
| **Grand Prix Garage** | Motor mania | RacingKit, ToyCarKit |
| **Rails & Trails** | Steam & forest | TrainKit, NatureKit, MiniForest |
| **Putt Paradise** | Minigolf resort | MinigolfKit |
| **Cuddle Corral** | Petting‑zoo meadow | CubePets, MiniForest |
| **Marble Gardens** | Kinetic wonder garden | MarbleKit |

Backstage flavor (staff rooms, generators, crates) draws from FactoryKit/SurvivalKit and is part
of the base catalog. Remaining packs (TDKit, MiniSkateKit, PlatformKit, MiniArena, CityKits…)
feed props, plaza dressing and post‑1.0 kits — full mapping in ASSET_GUIDE §4.

**Theme synergy:** attractions gain up to +15% appeal when surrounded by matching‑kit scenery
(counted in a radius, shown as a meter in the ride panel). This is the economic reason to
decorate (P1×P3: beauty pays).

---

## 11. Guests

Guests are the park's bloodstream and its conscience. Target: **up to ~1,200 concurrent guests**
feel individually alive through emotes and behavior, not deep interiority
(TECHNICAL_ARCHITECTURE §6 for the crowd tech).

### 11.1 Spawning & demographics

Arrival rate is driven by **Park Appeal** (attraction portfolio + rating + marketing + weather +
entry price sensitivity) with a soft daily rhythm (morning ramp, afternoon peak, night tail).
Guests arrive as singles/pairs/family clumps of an **archetype**:

| Archetype | Wants | Wallet | Notes |
|-----------|-------|--------|-------|
| **Family** | E 2–6, facilities, Critter/gentle rides | $$ | Larger groups, slower walk |
| **Thrill‑seeker** | E 6+, I 5–9, coasters | $$ | Teens; queue‑tolerant, litter‑prone |
| **Foodie** | Food variety, Bistro, low nausea | $$$ | Spends 2× at shops |
| **Sightseer** | Scenery, shows, transport rides | $ | Big Wonder contributor, photos |
| **Superfan** | Everything, brand new rides | $$$$ | Rare; blogs → mini reputation events |

Guest bodies use the BlockyCharacters/CuteCharacters models (18+ palette variants) including
wheelchair users; paths and queues are step‑free by design so inclusion is default, not a system.

### 11.2 Needs & mood

Needs (0–100, decay over time & activity): **Fun, Hunger, Thirst, Bladder, Energy, Comfort**
(Comfort absorbs nausea, weather exposure, crowding). Mood = weighted aggregate → four visible
states: *Delighted / Content / Grumpy / Miserable* — reflected in walk posture, walk speed, and
**emote bubbles** (EmotesPack): burger = hungry, drop = thirsty, zzz = tired, swirl = nauseous,
heart = delighted, red ! = angry, ? = lost. Click any guest for their card (name, archetype,
thoughts log, wallet, current goal).

Miserable guests leave early, spend nothing, and dent the rating on exit. Delighted guests stay
longer, buy souvenirs, and generate word‑of‑mouth appeal. The park literally *looks* like how
it's doing (P2).

### 11.3 Behavior loop

`decide (utility: strongest need × proximity × price sense) → pathfind → queue (patience meter)
→ ride/eat/rest → re‑evaluate → eventually exit` — with flavor states: watch Marble Cascade,
photograph scenery clusters, get lost (no signage), drop litter (bins nearby prevent), vomit if
Nausea caps (Janitor cleanup), kids drag families to mascots.

---

## 12. Staff

Four hireable roles, deliberately lean (no beverage micromanagement — P5 over sprawl):

| Role | Job | Failure it prevents | Source models |
|------|-----|---------------------|---------------|
| **Mechanic** | Patrols, repairs breakdowns, refurbs | Ride downtime, safety citations | BlockyCharacters (overall skin) |
| **Janitor** | Litter, vomit, restroom upkeep | Care score collapse, rat event | BlockyCharacters |
| **Entertainer** | Mascot patrols, queue entertainment, Poly Arena shows | Queue rage‑quits | Skeletons (Spooky), CubePets mascot heads |
| **Guide** | Info point staffing, escorts lost guests, deters troublemakers | Lost/vandal incidents | CuteCharacters |

Staff have wage, a patrol zone (paint cells), energy (need a Staff Room — FactoryKit/FurnitureKit
backstage), and one **trait** on hire (e.g., "Night owl": faster after 18:00). One upgrade each
("Certified": Mechanic repairs 30% faster). No skill trees at 1.0 — depth lives in *zoning*
decisions, not menus. Wages & counts: GAME_BALANCE §7.

---

## 13. Economy, debt & risk

Money is the tension instrument (P3). All values integer cents internally; UI shows whole `$`.

### 13.1 Income

Entry ticket (park‑wide, price‑sensitivity curve) · per‑ride tickets · shop margins · souvenir
sales (rating‑scaled) · ATM fees · sponsorship events (event deck) · scenario stipends.

### 13.2 Costs

Construction · staff wages (monthly) · ride upkeep + refurbs · marketing campaigns · loan
interest · inspection fines · event costs (storm cleanup) · land expansion.

### 13.3 Loans & credit

- Up to **3 concurrent loans** from tiered offers (small/medium/large — presented as offer cards
  in the Loans panel, UI_UX_DESIGN §6.8).
- **Credit grade A–E** from payment history, debt ratio and park value; sets available offers and
  rates. Interest charges monthly; minimum payment auto‑drafts; missed payment → grade drop +
  warning month → collections event (repossess a ride's trains = ride closed until paid!).
- **Bankruptcy** (career): negative cash + missed obligations for 2 consecutive months → one
  rescue offer ("The Consortium": harsh terms, park rating cap while active) → refusal or second
  failure = scenario failed (retry with modifiers). Sandbox: optional "no‑fail" toggle.

### 13.4 Difficulty

| | Relaxed | Standard | Tycoon |
|---|---------|----------|--------|
| Starting cash / loan rates | +50% / −2pt | baseline | −25% / +3pt |
| Guest forgiveness, event frequency | gentle | baseline | harsh |
| Breakdown & inspection cadence | −50% | baseline | +50% |
| Star Ticket earnings | ×0.75 | ×1 | ×1.25 |

Exact numbers: GAME_BALANCE §2.

---

## 14. Events, incidents & inspections

A weighted **event deck** (seeded RNG, cooldowns, prerequisites) keeps months from blurring
together. Events are toasts + world effects, never popup walls. Representative deck at 1.0
(full list & weights: GAME_BALANCE §8):

- **Weather chain:** storm forecast → storm (tall rides auto‑close, attendance dip, post‑storm
  litter) · heatwave (thirst ↑, Splashlog/Sip Station boom).
- **Fame:** VIP critic visit (rating swing ±, secret until verdict) · influencer swarm (guest
  surge for 2 days) · "Coaster‑of‑the‑month" nomination (submit your best track).
- **Trouble:** breakdown streak (morale story on a ride) · litter wave · vandal night (Guides
  deter) · food‑hygiene scare (if shops unmaintained) · lost kid (find via camera ping → reward).
- **Money:** sponsor offer (branded ride wrap for monthly cash — accept/decline, small Wonder
  hit) · tax audit (books clean? flat fee vs fine) · surprise refurb subsidy.
- **Safety Inspection:** scheduled window each ~3 months + random spot checks. Inspector walks
  the park like a guest; score from ride reliability, First Aid coverage, path crowding.
  Pass = small rating bump; fail = fine + forced closure of worst ride until repaired.
  Incidents themselves are **cartoon‑safe**: a breakdown mid‑ride strands guests (grumpy, not
  hurt) until a Mechanic escorts them down; "mishap" = smoke poof + refunds + Care hit.

---

## 15. Weather & time

- **Clock:** 1 real second = 2 game minutes at 1×. Speeds: pause / 1× / 2× / 4×. Park hours
  09:00–21:00; night runs (21:00–24:00) unlock via Park Level (lamps required — night parks are
  gorgeous and lucrative but strain Energy/Care).
- **Calendar:** 1 month = one report cycle ≈ 10 real minutes at 1×; four visual day/night cycles
  per month (skybox morning/day/night blend).
- **Weather states:** Sunny · Overcast · Rain (attendance −, Comfort −, indoor/covered rides +) ·
  Storm (tall/fast rides auto‑close, rare) · Heatwave (Thirst ↑↑, splash rides +) ·
  Snow (Winterfest scenario profile: Sled Slide opens, cocoa boom). Forecast strip shows the next
  3 days — weather is a plannable system, not a slot machine (P5).

---

## 16. Park Rating

The public 0–5.0★ score, recomputed continuously from five visible sub‑scores (each 0–100, shown
as an Overwatch‑style stat card row — UI_UX_DESIGN §6.8):

| Sub‑score | Fed by | Starved by |
|-----------|--------|------------|
| **Fun** | Ride E‑scores × variety × uptime, shows | Stale portfolio, downtime, novelty decay |
| **Value** | Price fairness vs delivered fun (entry + tickets + food) | Gouging, ATM dependence |
| **Care** | Cleanliness, restrooms, First Aid, safety record | Litter, vomit, citations, breakdowns |
| **Wonder** | Scenery density/variety, theme synergy, night lighting, Marble Cascade‑type spectacles | Bare concrete plazas |
| **Flow** | Queue times, path crowding, signage/Guides, transport coverage | 45‑min queues, lost guests, dead ends |

Rating gates: scenario objectives, some unlock nodes, guest cap growth, souvenir margins, and
the finale "5★ Polypark Grande" fantasy. Formulas: GAME_BALANCE §4.

---

## 17. Progression & unlocks

Three interlocking layers (P4's *now / soon / dream*):

1. **Park Level (per park)** — XP from guest joy, milestones, objectives. Levels 1→30 unlock
   catalog breadth on a visible **track screen** (battle‑pass‑style UI, purely earnable —
   UI_UX_DESIGN §6.7). Some nodes are **A/B choices** ("Galleon Swing *or* Pumpkin Drop next") —
   picks differentiate a run; the other side unlocks a few levels later.
2. **Scenario stars (career)** — 1★ core objective, 2★ stretch, 3★ mastery; stars gate later
   scenarios and pay Star Tickets.
3. **Collection (account‑wide)** — Star Tickets buy permanent Theme Kit & blueprint unlocks in
   the Hub. Sandbox depth grows as career progresses. (Stored locally like everything else — no
   account; see TECHNICAL_ARCHITECTURE §9.)

XP curve, ticket payouts and the full 30‑level track: GAME_BALANCE §9.

---

## 18. Career scenarios

Eight scenarios, each a themed lesson wrapped in a story told through objectives and event
scripting. (Names/copy draft; 2–4 h total career length target.)

| # | Scenario | Kit focus | Teaches | Twist |
|---|----------|-----------|---------|-------|
| 1 | **Sunny Meadows** | Boardwalk | Everything basic (tutorial, §19) | Scripted gentle rain beat |
| 2 | **Cove of Fortune** | Pirate Cove | Loans & credit, flat rides | Start in debt to a "generous" uncle |
| 3 | **Crater Lights** | Cosmic Port | Night ops, marketing, lamps | Alien skybox; attendance is nocturnal |
| 4 | **Hollow Eve** | Spooky Hollow | Events & inspections, Entertainer staff | Halloween month = guest flood + inspector sweeps |
| 5 | **Once Upon a Queue** | Storybook Keep | Flow: queues, transport, Guides | Inherited beloved-but-broken castle park |
| 6 | **Frostival** | Winterfest | Weather & seasonality | Snow profile; heaters/cocoa economy |
| 7 | **Full Throttle Fair** | Grand Prix | Competition & pricing | Rival fair runs price‑war event chain |
| 8 | **Polypark Grande** | All kits | Mastery sandbox‑scale | 64×64 plot; reach 5.0★; optional Tycoon modifiers |

Each scenario ships with a pre‑dressed diorama edge (so even empty plots look inviting), a
scripted opening beat (<60 s), and a curated event‑deck bias matching its lesson.

---

## 19. Onboarding & tutorial

Philosophy: **teach by wanting** — every tutorial step creates a visible desire first (guests
queue at nothing → "build the Teacups"), then names the mechanic. Never a wall of text (P5).

**Scenario 1 "Sunny Meadows" beats** (~20 min):

1. Cold open: camera glides the diorama; 3 guests wait at the gate. *"They heard rumors."*
2. Camera controls (free play, skippable card) → lay first path from gate.
3. Place **Snack Shack** → open park → first coins fly, first emotes explained via callouts.
4. Place **Teacup Twirl** → set ticket price with a live demand hint → queue forms.
5. First litter → hire **Janitor**, paint patrol zone.
6. Milestone toast: 100 guests → **Park Level up** → track screen introduced → choose unlock.
7. Scripted drizzle → guests seek cover → build awning/Sip Station; weather strip explained.
8. First breakdown (Teacups, comic smoke) → hire **Mechanic**.
9. Monthly Report walkthrough → 1★ objective completes → freeform play toward 2★/3★ with
   contextual goals ("A coaster would put us on the map" → Mousetrap builder intro).

**Ever‑present learning support:** contextual coach‑marks (first time each panel opens, dismiss
forever), the **Parkopedia** (searchable, every system, one screen each, unlocks as encountered),
hover tooltips on *every* number with plain‑language cause ("Value 62: guests think ride tickets
are fair but food is pricey"), and an optional **Advisor** toggle that surfaces one suggestion at
a time. All tutorials replayable from Extras.

---

## 20. Session design & the "one more month" loop

- **Three visible horizons** pinned in HUD: current objective chip (now), Park Level next‑unlock
  (soon), scenario star / 5★ (dream).
- **Monthly Report** doubles as a natural pause: one screen, one suggested focus, one "keep
  going" button that pre‑arms the next month's goal.
- **Unlock cadence:** first 30 minutes of any park deliver a new toy every 3–5 minutes; steady
  state every 8–12 (curve in GAME_BALANCE §9.2).
- **Celebrations:** level‑ups fire park‑wide fireworks + guest cheer wave (cheap, joyful);
  scenario stars get a title‑card moment. Milestones are *witnessed by the crowd*, not just
  toasted (P2).
- **Idle‑positive:** the park runs while you build; watching is a valid verb (Marble Cascade,
  shows, night lighting). No fail state can develop faster than ~2 months of neglect, and every
  red trend surfaces a toast + Advisor tip first (anti‑frustration).
- **Autosave** every month boundary + on quit; sessions resume in <5 s to the exact camera pose.

---

## 21. Audio direction

> ⚠ The repo currently contains **no audio assets** — see ASSET_GUIDE §6 and DECISIONS Q‑05 for
> the sourcing plan (Kenney CC0 audio/music packs recommended).

- **Music:** cheerful chiptune‑adjacent orchestral‑lite loops per Theme Kit zone (crossfade by
  camera location), calm hub theme, tense sting layer when cash < wages.
- **Ambience:** crowd walla scaled to local density + mood (delighted parks *sound* delighted),
  ride mechanics (chain lift clack, whoosh), weather layer.
- **UI:** the click‑clack snap (P1 signature), soft card whooshes, coin tick, distinct
  good/bad/neutral toast stings. Every sound has a captioned event for accessibility (§22).
- **Mix rules:** nothing loops shorter than 45 s within earshot; sliders for Master/Music/SFX/UI;
  audio ducks during Advisor speech bubbles (no voice acting at 1.0).

---

## 22. Accessibility

Committed at 1.0, tested in CI where automatable (TECHNICAL_ARCHITECTURE §11):

- Full keyboard remapping; mouse‑only and keyboard‑heavy layouts both viable; no hold‑to‑confirm
  without toggle alternative.
- UI scale 80–140%; readable‑font toggle (swaps display skew font for high‑legibility variant);
  minimum 4.5:1 text contrast in both HUD themes.
- Colorblind‑safe status design: every color signal pairs with an icon/shape (emotes,
  green/red ghosts get ✓/✕ glyphs, sub‑score cards patterned).
- Reduced‑motion mode (no camera glides/shakes, instant panel transitions); zero strobing
  anywhere (fireworks are soft bloom, no flicker >3 Hz).
- Pause anywhere, including during tutorials; no reaction‑time mechanics.
- Captions for meaningful audio cues (toast log doubles as visual sound log).
- Guests include wheelchair users by default; park paths are universally step‑free (§11.1).

---

## 23. Content safety & tone

Family‑friendly (PEGI 7 sensibility): no injury, death, gore or realistic peril — malfunctions
are smoke poofs, strandings and refunds; "vomit" is a green splat cartoon. No gambling
mechanics, no real‑money anything, no dark patterns (the battle‑pass‑*style* track is purely
playtime‑earned). Copy voice: warm carnival‑barker wit, puns allowed, sarcasm never aimed at the
player. No licensed IP references. All assets CC0 (ASSET_GUIDE §2).

---

## 24. Out of scope for 1.0

Explicit non‑goals (revisit post‑1.0; some have roadmap slots):

- Terrain height sculpting; caves/tunnels (ModularCaveKit waits for this).
- Spline coasters, custom flat‑ride animation editor.
- Waterpark slide physics (Aquapark fantasy served by Flume/Paddle Bay at 1.0).
- Multiplayer/co‑op; cloud saves; accounts of any kind.
- Mobile/touch layout (architecture must not preclude it; see TECHNICAL_ARCHITECTURE §13).
- Mod support / user asset import (catalog pipeline is designed to make this feasible later).
- Localization beyond English at launch (i18n scaffolding from day one — DECISIONS Q‑03).
- Photo mode with filters (basic screenshot key at 1.0).
- Weekly challenge seeds & the leaderboard (leaderboard = dedicated final phase, per brief).

---

## 25. Glossary

| Term | Meaning |
|------|---------|
| **Tabletop** | The floating island diorama a park is built on |
| **Cell** | 2×2 m grid unit; all placement footprints measured in cells |
| **Piece / Kit** | One placeable model / a themed content chapter backed by CC0 packs |
| **E/I/N** | Excitement / Intensity / Nausea ride stats (0–10) |
| **Park Level** | Per‑park XP track (1–30) gating catalog unlocks |
| **Star Tickets 🎟** | Meta currency from stars/milestones; spent in Collection |
| **Care / Wonder / Flow** | Park Rating sub‑scores (with Fun and Value) |
| **Event deck** | Weighted, seeded pool of monthly happenings |
| **Parkopedia** | In‑game encyclopedia; every system explained in one screen |
| **Advisor** | Optional one‑tip‑at‑a‑time suggestion system |
| **Blueprint** | Saved multi‑piece stamp, player‑made or unlocked |
