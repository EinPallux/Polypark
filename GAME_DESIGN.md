# Polypark — Game Design Document

> **Snap together the park of your dreams.**
> A 3D low‑poly tycoon for the browser. Build a theme park — and the little world around it —
> from toy‑kit pieces on lush, rolling terrain. Delight blocky guests, survive storms, loans and
> inspections, and grow a roadside meadow into a five‑star resort. Your park never ends; it only
> grows.

**Status:** Planning complete (owner Q&A 2026‑07‑26 incorporated) — implementation gate open at
ROADMAP M0 on owner "go".
**Companion docs:** [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) ·
[docs/UI_UX_DESIGN.md](docs/UI_UX_DESIGN.md) · [docs/GAME_BALANCE.md](docs/GAME_BALANCE.md) ·
[docs/ASSET_GUIDE.md](docs/ASSET_GUIDE.md) · [docs/DECISIONS.md](docs/DECISIONS.md)

---

## Table of contents

1. [Vision](#1-vision)
2. [Design pillars](#2-design-pillars)
3. [Inspiration mapping](#3-inspiration-mapping)
4. [Game structure & modes](#4-game-structure--modes)
5. [The world: Sites & terrain](#5-the-world-sites--terrain)
6. [Districts — beyond the gate](#6-districts--beyond-the-gate)
7. [Core loops](#7-core-loops)
8. [Construction system](#8-construction-system)
9. [Attractions](#9-attractions)
10. [Shops & facilities](#10-shops--facilities)
11. [Theme Kits](#11-theme-kits)
12. [Guests](#12-guests)
13. [Staff](#13-staff)
14. [Economy, debt & risk](#14-economy-debt--risk)
15. [Events, incidents & inspections](#15-events-incidents--inspections)
16. [Weather & time](#16-weather--time)
17. [Park Rating](#17-park-rating)
18. [Progression: Goal Deck & unlocks](#18-progression-goal-deck--unlocks)
19. [Park Stories](#19-park-stories)
20. [Guidance & learning](#20-guidance--learning)
21. [Session design & the "one more month" loop](#21-session-design--the-one-more-month-loop)
22. [Audio direction](#22-audio-direction)
23. [Accessibility](#23-accessibility)
24. [Content safety & tone](#24-content-safety--tone)
25. [Out of scope for 1.0](#25-out-of-scope-for-10)
26. [Glossary](#26-glossary)

---

## 1. Vision

Polypark is a **toybox resort tycoon**. Each park lives in a handcrafted, gently rolling
landscape — meadows, treelines, a glittering pond — and everything you build is snapped together
from chunky CC0 low‑poly kits, like a toy set poured out on the world's prettiest lawn. The
player is part architect, part shopkeeper, part ringmaster: they lay winding paths, snap coaster
track piece by piece, price the churros, hire the janitor, take the risky loan — and then build
the parking lot, the hotel row and the office quarter that turn a park into a *place*.

The fantasy: **"I built this, it's alive, and it's mine."**

Polypark is a real management game, not a decorating toy. Money is earned and lost. Rides break.
Storms close the drop tower. The bank calls. But the tone stays warm — failures produce cartoon
smoke and financial headaches, never harm — and **your park has no game‑over**: setbacks bend
the story of your resort, they never delete it. Goals invite; they never order. (Owner
directives, 2026‑07‑26: guided but never forced, no hard end, build everything from the asset
packs, real high‑quality terrain.)

Target player & platform: desktop browser (mouse+keyboard) on Vercel; single player, no
accounts, no monetization; sessions of 20–90 minutes that resume instantly. Post‑1.0: a
no‑login friends leaderboard via share codes.

---

## 2. Design pillars

Every feature must serve at least one pillar. When in doubt, cut against these.

| # | Pillar | What it means in practice |
|---|--------|---------------------------|
| P1 | **Toybox tactility** | Placement is the core joy: satisfying snaps, chunky ghosts, click‑clack feedback, undo without fear. If building feels like Lego on a summer lawn, we win. |
| P2 | **A legible living park** | Every guest tells you how they feel (emotes, posture, flow). Every problem is visible in the world before it's a number in a panel. |
| P3 | **Real stakes, no game‑over** | Debt, breakdowns, inspections and weather create genuine tension — consequences are financial and reputational, recoverable by play, never fatal to the save. |
| P4 | **Always a next goal, never an order** | Goals are optional invitations (Goal Deck): visible, swappable, dismissable. The game never blocks free play, never says "do this now". |
| P5 | **Explain everything** | Every system has a plain‑language tooltip, a Parkopedia page, and an in‑world cue. No wiki required, ever. |
| P6 | **Modern‑game polish** | Title screen, hub, options, juice, audio, save slots, accessibility. It should feel like a Steam release that happens to run in a tab. |
| P7 | **Built from the box** | Every game element is assembled from the CC0 packs in `/assets`. If the kits can't build it, it isn't in the game (no ferris wheel — no ferris wheel model exists). Exceptions: generated utility visuals only (terrain surface, water plane, particles, UI). |

---

## 3. Inspiration mapping

| Source | What we take | What we deliberately don't take |
|--------|--------------|---------------------------------|
| **Planet Coaster** | Guest emote readability, coaster pride, park rating pressure | Free‑form spline coasters & player terraforming (piece‑snap on authored terrain instead — §8) |
| **Planet Zoo** | Animal corner charm (Cuddle Corral), staff with jobs & morale‑lite | Deep animal welfare sim |
| **Two Point Museum / Hospital** | Humor in copy, prefab clarity, "one lesson at a time" story parks | Wall‑by‑wall room drawing |
| **Aquapark Tycoon** | Small‑lot start → visible growth; **environment quality bar**: the owner‑provided screenshot (rolling lawns, dense trees, organic gravel paths, soft depth‑of‑field, goal checklist top‑right) is our environment target | Water‑physics slides (Flume + Paddle Bay cover the splash fantasy) |
| **Overwatch / Marvel Rivals (`/uiinspo`)** | The entire UI language — see [docs/UI_UX_DESIGN.md](docs/UI_UX_DESIGN.md) | Nothing — UI style is a hard requirement |

---

## 4. Game structure & modes

Structure of a modern game, front to back:

```
Boot (loading, autosave check)
 └─ Title Screen ─ CONTINUE / PLAY / OPTIONS / EXTRAS
     └─ Hub ("Park Gate")
         ├─ MY PARKS  — the heart: create/load endless sandbox parks (site select, settings)
         ├─ STORIES   — curated starts with objective sets (stars) — parks continue after
         ├─ COLLECTION— Theme Kits, blueprints, milestones (Star Ticket spending)
         └─ PROFILE   — lifetime stats, records (leaderboard lives here post‑1.0)
             └─ In‑Game (HUD + build mode + management panels + pause)
```

### Sandbox first (owner directive Q‑04)

**My Parks is the primary mode.** A new park = pick a Site (§5) + settings (starting cash,
difficulty, events, weather profile, hard‑fail off by default). From the first minute the park
is yours: the **Guidance layer** (§20) offers a gentle path through every system via optional
goal cards, but nothing is ever locked behind "do the tutorial step". **There is no hard end:**
no bankruptcy game‑over (→ Receivership, §14.3), no story failure that closes a park, no final
screen — a "finished" goal set just deals new horizons (§18).

### Park Stories

Eight authored starts (§19) with star objectives — the structured, curated way to learn and be
challenged. Completing (or ignoring) a story's objectives never ends the park: after the star
card, the site stays open forever as a normal sandbox park with its Goal Deck active.

### Post‑1.0 (explicitly not in 1.0)

Weekly challenge seeds · the friends leaderboard (final phase, TECHNICAL_ARCHITECTURE §12).

---

## 5. The world: Sites & terrain

**Owner directive:** the environment must be *real, high‑quality terrain* — a landscape, not a
flat board with a visible grid.

- A park lives on a **Site**: a handcrafted landscape of gently rolling meadows, treelines,
  rock outcrops and water, in the spirit of the Aquapark Tycoon reference — lush, sun‑lit,
  believable. Sites are authored (heightmap + surface layers + vegetation scatter + water; see
  TECHNICAL_ARCHITECTURE §6.4), not procedurally random, so each has personality and
  guaranteed build quality.
- **1.0 Sites:** *Meadowbrook* (rolling lawn, pond — the default), *Riverbend* (stream cuts the
  site; bridges matter), *Hillcrest* (terraced slopes, valley views), plus the Story sites.
- **The grid is logic, not looks.** Placement still snaps to 2×2 m cells for clean building and
  fair pathfinding, but the world never shows a checkerboard: paths render as organic
  gravel/stone ribbons with soft blended edges, lawns are continuous terrain, and the build
  grid appears only as a subtle glow while actually placing (UI_UX_DESIGN §8).
- **Slopes are real.** Each cell carries height + a slope class: *flat* (anything builds),
  *gentle* (paths, scenery, small buildings — pieces sit on tidy auto‑foundations), *steep*
  (scenery only). Large footprints level their pad locally with a neat low retaining edge —
  it reads as landscaping, not terrain deformation. Coaster supports auto‑extend to the ground
  whatever the height (downhill coasters through the treeline are the postcard shot).
- **Water:** authored ponds/streams per site + player‑dug pool basins on flat ground (Flume
  splashdowns, Paddle Bay). Natural water is prime real estate, not an obstacle.
- **Expansion:** each Site defines authored **expansion areas** (forest clearings, the far
  meadow, district plots §6). Buying one clears it with a satisfying poof‑of‑leaves reveal —
  the world grows organically instead of bolting on abstract squares.
- **Environment dressing** beyond the fence — treelines (NatureKit, MiniForest, Medieval
  Hexagon hills in the far distance), a country road with KayKit CityBits cars arriving toward
  the Parking Grounds — sells "a real place you can drive to". Skybox pack drives
  morning/day/night; distance haze + optional tilt‑shift depth‑of‑field complete the diorama
  look (TECHNICAL_ARCHITECTURE §6.4).
- **No player terraforming at 1.0** (height sculpting stays post‑1.0; save format reserves it).
  Site variety + slope‑aware building deliver terrain gameplay without the tool.

---

## 6. Districts — beyond the gate

**Owner directive:** use every pack that fits — Polypark is not *only* the fenced park. Around
the gate, the Site offers **district plots** where you build the resort's supporting world.
Districts are optional, unlocked by Park Level, purchased like expansions, and each one feeds
the park loop with a distinct, simple economic hook — no second guest sim inside them, but
fully visible life (cars park, hotel guests stroll out at opening time).

| District | You build | Backing packs | Economic hook |
|----------|-----------|---------------|---------------|
| **Parking Grounds** | Access road, parking rows, taxi rank, lot greenery | CityKitRoads (driveways, lights), KayKit CityBits (cars incl. taxi), NatureKit | **Arrival capacity.** Peak concurrent guests ≈ gate base + parking bays + taxi rank (+ Station). Full lot at peak = visible car queue + turnaways. A pretty lot adds a small first‑impression Value bump. |
| **Arrival Station** | A real railway halt on the site edge | Kenney TrainKit (station, track, trains) | Big capacity in **scheduled bursts** — crowd pulses to plan around. One per site, late unlock. (No bus models exist in the packs → no buses; cars, taxis and trains are how Polypark arrives. P7 in action.) |
| **Resort Row** | Hotels assembled from modular pieces, holiday cabins, gardens | ModularBuildingsKit (hotel blueprints), HolidayKit cabins, FurnitureKit | **Multi‑day guests:** room capacity × occupancy; hotel guests leave at close, return at open with partially refilled wallets and +Energy; makes night hours (§16) truly pay. Nightly rate is player‑set. |
| **Staff Village** | Suburban houses, gardens | CityKitSuburban (houses, driveways), NatureKit | **Staff capacity & morale:** each house lodges 3 staff (staff cap grows from housing, base 12 from backstage rooms), housed staff get +10% effectiveness and −10% wage. |
| **Commerce Quarter** | Office & shopfront buildings, plaza, billboards | CityKitCommercial, BuildingKit, KayKit CityBits (streetlights, roads) | **Rent & reach:** monthly rent scales with park rating × attendance; each 2 buildings add a sponsor slot; billboards boost marketing efficiency. The resort's skyline literally grows with your success. |
| **Works Yard** | Workshop, depot, reclaimer (backstage industry) | FactoryKit, CityKitIndustrial, SurvivalKit crates | **Operations discounts:** workshop −15% ride upkeep + faster repairs; depot −8% piece costs; reclaimer +10% bulldoze refund. One of each. |

Design rules: districts read as the *same toybox world* (same palette, same low‑poly language);
each district ships with 1–2 blueprint layouts so players who don't care can stamp‑and‑go
(P4 — offered, never demanded); the Flow sub‑score (§17) counts arrival adequacy, closing the
loop between districts and the park's health. Numbers: GAME_BALANCE §3.3.

---

## 7. Core loops

### Minute loop — build & react (P1, P2)

```
Place / price something → guests respond visibly (queues, emotes, coins)
→ spot a problem in the world (litter, long queue, full parking lot)
→ fix it (build / staff / price) → immediate visible improvement
```

### Session loop — the month (P3, P4)

Every in‑game month (≈10 real minutes at 1×) ends with a **Monthly Report**: income vs costs,
rating delta, standout events, and *one suggested focus*. Payday, loan interest, wages, rent and
inspections land on month boundaries, giving sessions a heartbeat and a natural save/quit point
that still tempts "one more month".

### Park loop — from meadow to resort (P4)

```
Open a modest park → goals invite milestones → Park Level up → unlock content & districts
→ invest (cash or loan) in a marquee ride or a hotel row → appeal & capacity jump
→ more guests, more strain → staff up, diversify themes, grow the skyline → 5★ resort
```

### Meta loop — the Collection

Story stars, Goal Deck achievements and milestones award **Star Tickets 🎟** spent in the Hub
**Collection** to permanently unlock Theme Kits and blueprints for all future parks.

---

## 8. Construction system

The heart of the game. Everything placeable is a **piece** from a kit (P7; catalog in
docs/ASSET_GUIDE.md).

### 8.1 Placement rules

- **Grid‑snap on real terrain:** 2×2 m logical cells with 90° rotation for buildings/rides;
  scenery adds 45° rotation + free nudge within a cell. Pieces conform to terrain per slope
  class (§5); ghosts preview the auto‑foundation where one is needed.
- **Footprints:** cells occupied + clearance + entrance cell(s) that must touch path. Ghost
  shows green/red with a one‑line reason ("Too steep — find flatter ground").
- **Paths** are first‑class: drag to paint winding routes; auto‑tiling (`ground_path*` family)
  follows terrain like a gravel ribbon with soft blended edges — never a checkerboard; plazas
  by area‑fill; queues are a special path type snapped to ride entrances.
- **Delete/refund:** bulldoze returns 70% (100% within 30 s of placement). Full **undo/redo**
  for all build actions.
- **Blueprints:** save any selection as a stamp; kits ship curated blueprints (incl. hotels and
  district layouts) for stamp‑and‑go players.

### 8.2 Track builder (signature feature)

Coasters and tracked rides are built **piece by piece, like the physical toy kits** — the
CoasterKit pieces are the vocabulary: straights, curves, banks, hills, loops, stations, brakes,
chain lifts.

- Snap the next piece to the open end; the builder offers only pieces whose entry pose matches
  the current exit pose (rotate options with scroll/Tab).
- A track is **valid** when it closes a circuit through ≥1 station and passes a simple energy
  check (chain/launch energy in, friction out — TECHNICAL_ARCHITECTURE §4.6).
- Live **E/I/N preview** while building (formula: GAME_BALANCE §5.3) — numbers to chase without
  a physics degree. Terrain is part of the fun: valley dips and treetop runs raise Excitement
  via scenery proximity.
- Families at 1.0 (all four confirmed, Q‑02): **Steel · Wild Mouse · Inverted · Log Flume**,
  plus Railroad and Go‑Kart circuits under gentler rules.
- Supports auto‑generate down to the terrain, whatever the drop.

### 8.3 Build UX promises (P1)

Click‑clack snap sound + subtle scale "pop"; hold‑drag runs for paths/fences/queues; Shift‑drag
rectangle scenery fills; eyedropper; quick‑duplicate; move‑without‑refund; color/texture variant
swatches where kits provide them (guest palettes, flags, path materials).

---

## 9. Attractions

> **P7 banner:** every ride below is assembled exclusively from pieces in the repo's packs —
> flat rides are kit compositions (giant FoodKit teacups on a rotor, a PirateKit galleon on a
> swing arm built from support beams). Classic fair rides with no kit pieces (ferris wheel,
> horse carousel, bumper cars) are **not in the game** — the CubePets Critter Carousel and
> friends carry that fantasy instead.

Each attraction has: build cost, player‑set ticket price, capacity, cycle time, **E/I/N** stats
(0–10), per‑archetype appeal, reliability curve, upkeep, footprint, Theme Kit affinity
(synergy bonus §17). Full tables: GAME_BALANCE §5.

### Tracked rides (custom‑buildable)

| Ride | Kit source | Fantasy | Notes |
|------|-----------|---------|-------|
| **Steelwind Coaster** | CoasterKit (steel) | The marquee custom coaster | Full track builder |
| **Mousetrap** (Wild Mouse) | CoasterKit (mouse) | Compact, whippy, cheap | Small‑park star |
| **Sky Serpent** (Inverted) | CoasterKit (hanging) | Feet‑dangling thrill, loops | High E/I, high upkeep |
| **Splashlog Flume** | CoasterKit (flume) + water | Family splash ride | Water cells or natural pond edge; heatwave magnet |
| **Poly Express** | TrainKit | Park railroad | Transport ride: stations act as path shortcuts; scenic bonus from terrain views |
| **Poly 500 Karts** | RacingKit + ToyCarKit | Go‑kart circuit | Guests drive; throughput from lap length |
| **Putt Paradise** | MinigolfKit | Build‑your‑own minigolf | Hole‑by‑hole builder; rating from par variety |

### Flat rides (kit‑assembled prefabs, procedurally animated)

| Ride | Kit assembly | Fantasy |
|------|--------------|---------|
| **Teacup Twirl** | Giant FoodKit teacups on rotor platform | Classic spinner, toybox humor |
| **Galleon Swing** | PirateKit ship on beam swing arm | Pirate ship pendulum |
| **Rocket Orbit** | SpaceKit rockets on rotor arms | Aerial spinner |
| **Pumpkin Drop** | Spooktober pumpkin gondolas on support tower | Drop tower (closes in storms) |
| **Critter Carousel** | CubePets animals as mounts on platform | Gentle icon ride, family appeal |
| **Sled Slide** | HolidayKit sleds on terraced slope | Gravity ride — wants a hillside (terrain synergy) |

### Experiences (walk‑through / free‑roam)

| Attraction | Kit source | Fantasy |
|------------|-----------|---------|
| **Haunted Manor** | GraveyardKit + Spooktober + Skeletons | Spooky walkthrough; scare slider |
| **Castle Quest** | CastleKit + KayKit Dungeon | Storybook adventure walkthrough |
| **Cuddle Corral** | CubePets + MiniForest | Petting zoo; the Planet‑Zoo wink |
| **Paddle Bay** | WatercraftKit + pond | Free‑roam paddle boats — shines on natural water |
| **Marble Cascade** | MarbleKit | Kinetic marble‑run exhibit; watchable spectacle boosting nearby queues |
| **Poly Arena** | MiniArena + Skeletons/mascots | Scheduled live shows; pulses crowd joy |

Ride lifecycle: reliability decays with cycles → breakdowns → Mechanic repairs → periodic
**refurbishment** (cost, downtime) resets the curve and restores novelty; neglected rides age
visibly (kit "damaged" variants) and drag Care. Nothing here ever hurts anyone (§24).

---

## 10. Shops & facilities

Shops satisfy needs and print margin; facilities prevent misery. Vendors are part of the shop —
no per‑shop staffing micro.

| Building | Type | Satisfies | Source kits |
|----------|------|-----------|-------------|
| Snack Shack | Food stall | Hunger (light) | FoodKit + ModularBuildings |
| Grill Garden | Food stall | Hunger (heavy) | FoodKit |
| Sweet Scoop | Food stall | Hunger + Fun bump | FoodKit desserts |
| Sip Station | Drink stall | Thirst | FoodKit drinks |
| Poly Bistro | Restaurant | Hunger+Energy, high margin, low throughput | KayKit RestaurantBits interior |
| Gift Kiosk | Retail | Fun + souvenir income (rating‑scaled) | MiniMarketKit |
| Restroom | Facility | Bladder | FurnitureKit fixtures |
| First Aid | Facility | Nausea recovery | CuteCharacters aid props |
| ATM | Facility | Wallet refill (fee) | KayKit CityBits |
| Info Kiosk | Facility | Reduces "lost", boosts Value | ModularBuildings |
| Benches / Bins / Lamps | Props | Energy / litter prevention / night safety | NatureKit, CityKitRoads, FurnitureKit |

Levers: menu price, portion size, one upgrade slot each. Numbers: GAME_BALANCE §6.

---

## 11. Theme Kits

Content chapters that mirror the real CC0 packs: each Kit = catalog filter + scenery set +
path/fence skins + 1–3 signature attractions + a kit color used across the UI
(UI_UX_DESIGN §2.2).

| Kit | Identity | Backing packs (primary) |
|-----|----------|------------------------|
| **Boardwalk** (starter) | Cheerful country fair | ModularBuildingsKit, FoodKit, NatureKit, CityKitRoads |
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

District catalogs (§6) sit alongside Kits as their own categories (Parking, Resort, Village,
Commerce, Works). Backstage flavor draws from FactoryKit/SurvivalKit. Remaining packs feed
props and post‑1.0 kits — full mapping: ASSET_GUIDE §4.

**Theme synergy:** attractions gain up to +15% appeal when surrounded by matching‑kit scenery
(radius‑counted, shown as a meter in the ride panel). Beauty pays (P1×P3).

---

## 12. Guests

Target: **up to ~1,200 concurrent guests** who feel individually alive through emotes and
behavior (crowd tech: TECHNICAL_ARCHITECTURE §6.3).

### 12.1 Arrival & demographics

Guests arrive **by car, taxi and (late‑game) train** through the Parking Grounds / Arrival
Station (§6): arrival rate is driven by Park Appeal (portfolio + rating + marketing + weather +
entry price sensitivity), capped by arrival capacity, with a soft daily rhythm — hotel guests
(Resort Row) re‑enter at opening with the morning wave. Archetypes:

| Archetype | Wants | Wallet | Notes |
|-----------|-------|--------|-------|
| **Family** | E 2–6, facilities, gentle rides | $$ | Larger groups, slower walk |
| **Thrill‑seeker** | E 6+, I 5–9, coasters | $$ | Queue‑tolerant, litter‑prone |
| **Foodie** | Food variety, Bistro | $$$ | Spends 2× at shops |
| **Sightseer** | Scenery, shows, transport rides, views | $ | Big Wonder contributor |
| **Superfan** | Everything new | $$$$ | Rare; blogs → mini reputation events |

Guest bodies: BlockyCharacters (18 palettes) + CuteCharacters incl. wheelchair users; paths and
queues are step‑free by design — inclusion is default, not a system.

### 12.2 Needs & mood

Needs (0–100): **Fun, Hunger, Thirst, Bladder, Energy, Comfort** (absorbs nausea, weather,
crowding). Mood = weighted aggregate → *Delighted / Content / Grumpy / Miserable*, visible in
posture, speed and **emote bubbles** (EmotesPack: burger, drop, zzz, swirl, heart, red !, ?).
Click any guest for their card (archetype, thoughts log, wallet, current goal). Miserable
guests leave early and dent the rating on exit; Delighted guests stay, spend, and generate
word‑of‑mouth appeal. The park *looks* like how it's doing (P2).

### 12.3 Behavior loop

`decide (strongest need × proximity × price sense) → pathfind → queue (patience) → ride/eat/rest
→ re‑evaluate → exit to lot / hotel` — with flavor: watching Marble Cascade, photographing
viewpoints (terrain overlooks are scenic magnets), getting lost without signage, littering
without bins, dragging the family to mascots.

---

## 13. Staff

Four hireable roles, deliberately lean:

| Role | Job | Failure it prevents | Source models |
|------|-----|---------------------|---------------|
| **Mechanic** | Patrols, repairs, refurbs | Downtime, safety citations | BlockyCharacters (overall palette) |
| **Janitor** | Litter, vomit, restrooms | Care collapse, hygiene events | BlockyCharacters |
| **Entertainer** | Mascot patrols, queue shows, Poly Arena | Queue rage‑quits | Skeletons (Spooky), CubePets mascot heads |
| **Guide** | Info points, escorts lost guests, deters troublemakers | Lost/vandal incidents | CuteCharacters |

Staff have wage, a painted patrol zone, energy (need a Staff Room backstage), one hire trait and
one upgrade. **Capacity comes from housing:** base 12 staff via backstage rooms; the Staff
Village district (§6) raises the cap and adds morale/wage bonuses. Numbers: GAME_BALANCE §7.

---

## 14. Economy, debt & risk

Money is the tension instrument (P3). Integer cents internally; whole `$` in UI.

### 14.1 Income

Entry ticket · per‑ride tickets · shop margins · souvenirs (rating‑scaled) · ATM fees · hotel
nightly rates · Commerce rent · sponsorships · story stipends.

### 14.2 Costs

Construction · wages · upkeep + refurbs · marketing · loan interest · fines · storm cleanup ·
land/district purchases · hotel/works upkeep.

### 14.3 Loans, credit — and Receivership instead of game‑over

- Up to **3 concurrent loans** from tiered offer cards (Piggy Bank / Park Trust / The
  Consortium — UI_UX_DESIGN §6.8). **Credit grade A–E** from payment history, debt ratio, park
  value; sets offers and rates. Interest monthly; missed payment → grade drop → collections
  event (a ride's trains repossessed = ride closed until paid).
- **No hard end (owner directive):** prolonged insolvency triggers **Receivership**, not game
  over. The bank's administrator moves in: marketing frozen, construction limited to essentials,
  50% of monthly profit auto‑pays debt, a recovery goal chain appears ("Reopen Steelwind",
  "Two profitable months"). Clear the debts → full control returns with a small "comeback"
  reputation arc. It's a rough chapter of your park's story — never a deleted save.
- **Optional hard fail:** sandbox setup offers a "Classic bankruptcy" toggle (off by default)
  for players who want Tycoon‑style permadeath stakes. Never on in Stories.

### 14.4 Difficulty

| | Relaxed | Standard | Tycoon |
|---|---------|----------|--------|
| Starting cash / loan rates | +50% / −2pt | baseline | −25% / +3pt |
| Guest forgiveness, event frequency | gentle | baseline | harsh |
| Breakdown & inspection cadence | −50% | baseline | +50% |
| Receivership entry (insolvent months) | 3 | 2 | 1 |
| Star Ticket earnings | ×0.75 | ×1 | ×1.25 |

Exact numbers: GAME_BALANCE §2.

---

## 15. Events, incidents & inspections

A weighted **event deck** (seeded RNG, cooldowns, prerequisites) keeps months distinct. Events
are toasts + world effects, never popup walls. Representative deck (full weights:
GAME_BALANCE §8): weather chain (storm forecast → storm closures; heatwave booms), fame (VIP
critic, influencer swarm, coaster‑of‑the‑month), trouble (breakdown streak, litter wave, vandal
night, hygiene scare, lost kid), money (sponsor offer, tax audit, refurb subsidy).

**Safety Inspection:** scheduled ~3 months ± spot checks. The inspector walks the park like a
guest; score from reliability, First Aid coverage, crowding. Pass = small rating bump; fail =
fine + worst ride closed until repaired. Incidents are **cartoon‑safe**: strandings, smoke
poofs, refunds, grumpy emotes — never harm (§24).

---

## 16. Weather & time

- **Clock:** 1 real s = 2 game min at 1×; speeds pause/1×/2×/4×. Park hours 09:00–21:00; night
  runs (to 24:00) unlock via Park Level — lamps required; night parks are gorgeous, lucrative,
  and the reason Resort Row exists.
- **Calendar:** 1 month = one report cycle ≈ 10 real minutes at 1× (3,000 ticks); four
  day/night cycles per month (skybox morning/day/night) ⇒ a park day is 750 ticks.
- **Two clocks, deliberately out of step.** The *duration* clock is literal — one tick is 12
  game‑seconds, and every need decay, ride cycle and repair time is quoted in game‑minutes off
  it. The *park* clock (the hands in the HUD) is a rhythm dial: it sweeps a full 24 h across
  those 750 ticks, ~9.6× faster than the duration clock. Deriving the hands literally would
  make a day 7,200 ticks — longer than a month — and fire the monthly report twice before
  lunch. The stylisation reads true where it matters: a guest who stays open‑to‑close lives
  ~75 duration‑minutes of need decay, most of one Fun cycle, so "a guest spends the day at the
  park" is honest. Anything day‑quantised (weather, night hours, hotel occupancy) keys off the
  park clock; anything measured in minutes keys off the duration clock.
- **Weather:** Sunny · Overcast · Rain (attendance −, covered rides +) · Storm (tall/fast rides
  auto‑close, rare) · Heatwave (thirst ↑↑, splash rides boom) · Snow (Winterfest site profile).
  A 3‑day forecast strip makes weather plannable, not a slot machine (P5).

---

## 17. Park Rating

Public 0–5.0★ from five visible sub‑scores (0–100, Overwatch‑style stat tiles —
UI_UX_DESIGN §6.8):

| Sub‑score | Fed by | Starved by |
|-----------|--------|------------|
| **Fun** | Ride E × variety × uptime, shows | Stale portfolio, downtime, novelty decay |
| **Value** | Price fairness vs delivered fun | Gouging, ATM dependence |
| **Care** | Cleanliness, restrooms, First Aid, safety record | Litter, vomit, citations |
| **Wonder** | Scenery density/variety, theme synergy, terrain views, night lighting, spectacles | Bare plazas, billboard spam |
| **Flow** | Queue times, path crowding, signage/Guides, transport coverage, **arrival adequacy (parking!)** | 45‑min queues, full lots, dead ends |

Rating gates goal tiers, some unlocks, guest cap growth and souvenir margins. Formulas:
GAME_BALANCE §4.

---

## 18. Progression: Goal Deck & unlocks

Three layers keep *now / soon / dream* visible (P4) — all optional, none forcing:

1. **The Goal Deck (per park).** The game continuously deals **optional goal cards** into a
   top‑right panel (the Aquapark‑style checklist, reimagined in our UI language —
   UI_UX_DESIGN §6.10): up to 3 active, each with a progress bar and a reward (XP, 🎟,
   occasionally a blueprint). Cards adapt to your park's state ("Serve 500 meals", "Reach 60%
   parking headroom", "Build a coaster with E ≥ 6"). Swap or dismiss any card free of charge;
   dismissed themes return later evolved. Completing a set deals a bigger horizon card. There
   is **always** a next card and **never** a mandatory one.
2. **Park Level (per park).** XP from guest joy, goals, milestones → levels 1–30 on a visible
   track screen (battle‑pass aesthetic, purely playtime‑earned — UI_UX_DESIGN §6.7) unlocking
   catalog breadth, districts and night hours. Some nodes are A/B choices; the other option
   returns a few levels later.
3. **Collection (account‑wide).** Star Tickets 🎟 from stars/goals/milestones buy permanent
   Theme Kit & blueprint unlocks in the Hub. Sandbox toggle "everything unlocked" exists for
   pure creative sessions (off by default).

XP curve, payouts, the 30‑level track and goal‑card pools: GAME_BALANCE §9.

---

## 19. Park Stories

Eight authored starts — curated challenges and the structured way to learn. Stars gate later
stories and pay 🎟, but **parks persist forever after** (§4): the story card completes, the
Goal Deck takes over, the site keeps living.

| # | Story | Kit focus | Teaches | Twist |
|---|-------|-----------|---------|-------|
| 1 | **Sunny Meadows** | Boardwalk | The basics, gently (§20) | Scripted soft rain beat |
| 2 | **Cove of Fortune** | Pirate Cove | Loans & credit | Start in debt to a "generous" uncle |
| 3 | **Crater Lights** | Cosmic Port | Night ops, marketing | Alien skybox; nocturnal attendance |
| 4 | **Hollow Eve** | Spooky Hollow | Events & inspections | Halloween flood + inspector sweeps |
| 5 | **Once Upon a Queue** | Storybook Keep | Flow: queues, transport, Guides | Beloved‑but‑broken castle park |
| 6 | **Frostival** | Winterfest | Weather & Resort Row | Snow site; cocoa‑and‑cabins economy |
| 7 | **Full Throttle Fair** | Grand Prix | Pricing & Commerce | Rival fair price‑war event chain |
| 8 | **Polypark Grande** | All kits | Mastery scale | Huge site; the 5.0★ dream |

Each ships with a pre‑dressed landscape, a <60 s scripted opening beat, and a deck bias
matching its lesson. No story can be failed — objectives sit as star cards you chase when you
choose.

---

## 20. Guidance & learning

**Owner directive: "a little guided way through everything — never force."** There is no
tutorial mode; there is a **Guidance layer**, on by default for a player's first park,
toggleable any time in Options:

- Story 1 *Sunny Meadows* is the friendliest on‑ramp: its opening goal cards walk through
  camera → first path → first shop → open gate → first ride → first hire, each a normal
  **optional** Goal Deck card with a "show me" button (camera glides + spotlight, never a lock).
  Skip, reorder or ignore them — the park runs regardless.
- **Coach‑marks** appear the first time each panel opens (one paragraph, dismiss forever).
- **Parkopedia:** searchable encyclopedia; every system one screen; entries unlock as
  encountered; replayable from Extras.
- **Advisor** (optional toggle): one suggestion at a time, cause‑first ("Queues at Teacups are
  25 min — a second ride nearby would halve them").
- **Hover = truth:** every number explains itself in plain language (P5).

First‑time sandbox parks get the same opening card chain (minus story dressing) — guidance
lives everywhere, force lives nowhere.

---

## 21. Session design & the "one more month" loop

- **Three horizons pinned:** Goal Deck panel (now), Park Level next‑unlock (soon), story star /
  5★ resort (dream).
- **Monthly Report** = natural pause with one suggested focus and a "keep going" button.
- **Unlock cadence:** a new toy every 3–5 minutes in a park's first half‑hour, steady‑state
  every 8–12 (curve: GAME_BALANCE §9.2).
- **Celebrations witnessed by the crowd:** level‑ups fire fireworks + a cheer wave; stars get a
  title card; the skyline growing (Commerce) is its own trophy (P2).
- **Idle‑positive:** the park runs while you build; watching is a valid verb. No failure
  develops faster than ~2 months of neglect, and every red trend surfaces a toast + Advisor
  tip first. And per P3: nothing, ever, ends the save.
- **Autosave** each month + on quit; resume in <5 s to the exact camera pose.

---

## 22. Audio direction

**Approved (Q‑05):** Kenney CC0 audio packs will be added to `/assets` when audio work starts
(target packs & log: ASSET_GUIDE §6–7; core snap/coin sounds may land earlier as placeholders).

- **Music:** cheerful low‑key orchestral/chiptune‑adjacent loops per Kit zone (crossfade by
  camera), calm hub theme, gentle tension layer when cash < wages.
- **Ambience:** crowd walla scaled to local density + mood; ride mechanics (chain clack,
  whoosh, splash); weather layer; birdsong in the treelines (the terrain should *sound* lush).
- **UI:** the signature click‑clack snap, soft card whooshes, coin tick, distinct
  good/bad/neutral toast stings. Captioned events for accessibility (§23).
- **Mix rules:** nothing loops <45 s within earshot; Master/Music/SFX/UI sliders; ducking under
  Advisor bubbles. No voice acting at 1.0.

---

## 23. Accessibility

Committed at 1.0, tested in CI where automatable (TECHNICAL_ARCHITECTURE §11):

- Full keyboard remapping; mouse‑only and keyboard‑heavy layouts both viable; hold‑to‑confirm
  always has a toggle alternative.
- UI scale 80–140%; readable‑font toggle (unskewed high‑legibility variant); ≥4.5:1 text
  contrast in both HUD themes.
- Colorblind‑safe: every color signal pairs with an icon/shape (emotes, ✓/✕ ghosts, patterned
  sub‑score tiles).
- Reduced‑motion mode (no glides/shakes, instant transitions); zero strobing (fireworks are
  soft bloom, no flicker >3 Hz); tilt‑shift DOF off by default in accessibility preset.
- Pause anywhere; no reaction‑time mechanics; guidance never times out.
- Captions for meaningful audio cues (toast log doubles as sound log).
- Guests include wheelchair users by default; all paths step‑free (§12.1).

---

## 24. Content safety & tone

Family‑friendly (PEGI 7 sensibility): no injury, death, gore or realistic peril — malfunctions
are smoke poofs, strandings, refunds; "vomit" is a cartoon green splat. No gambling, no real
money anything, no dark patterns (the track screen is purely playtime‑earned). Copy voice: warm
carnival‑barker wit; puns allowed; sarcasm never aimed at the player. No licensed IP. All
assets CC0 (ASSET_GUIDE §2).

---

## 25. Out of scope for 1.0

Explicit non‑goals (revisit post‑1.0):

- Player terrain sculpting; caves/tunnels (ModularCaveKit waits for this).
- Spline coasters; custom flat‑ride animation editor.
- Waterpark slide physics (Flume + Paddle Bay carry the splash fantasy at 1.0).
- Multiplayer/co‑op; cloud saves; accounts of any kind.
- Mobile/touch layout (architecture must not preclude it — TECHNICAL_ARCHITECTURE §13).
- Mod support / user asset import (catalog pipeline designed to allow it later).
- Localization: **English only at 1.0** (owner Q‑03); strings externalized anyway (i18n layer).
- Photo mode with filters (screenshot key ships at 1.0).
- Weekly challenge seeds & the leaderboard (final phase).
- Anything the kits can't build (P7): ferris wheel, bumper cars, buses, horse carousel —
  excluded by law, not by accident.

---

## 26. Glossary

| Term | Meaning |
|------|---------|
| **Site** | A handcrafted terrain landscape a park lives on (Meadowbrook, Riverbend…) |
| **Cell** | 2×2 m logical grid unit projected onto terrain; slope classes flat/gentle/steep |
| **District** | Optional plot beyond the gate: Parking, Station, Resort, Village, Commerce, Works |
| **Piece / Kit** | One placeable model / a themed content chapter backed by CC0 packs |
| **E/I/N** | Excitement / Intensity / Nausea ride stats (0–10) |
| **Goal Deck** | The stream of optional goal cards — guidance without force (P4) |
| **Park Level** | Per‑park XP track (1–30) gating catalog/district/night unlocks |
| **Star Tickets 🎟** | Meta currency from stars/goals; spent in the Collection |
| **Receivership** | The no‑game‑over insolvency state: constrained play + recovery arc |
| **Care / Wonder / Flow** | Park Rating sub‑scores (with Fun and Value) |
| **Parkopedia / Advisor** | In‑game encyclopedia / optional one‑tip‑at‑a‑time helper |
| **Blueprint** | Saved multi‑piece stamp, player‑made or unlocked |
