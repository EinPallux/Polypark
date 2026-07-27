# Polypark — Game Balance Baseline

The concrete starting numbers for every tunable system. These are **v0 planning values** — the
first playable will re‑tune them, but changes happen *here first* (single source of truth), and
the invariants in §11 must keep passing in CI.

Conventions: money in `$` (integer cents internally) · time in game‑time (1 real s = 2 game min
at 1×; month = 10 real min = 3,000 ticks) · needs 0–100 · E/I/N 0–10.

Related: [GAME_DESIGN.md](../GAME_DESIGN.md) · [TECHNICAL_ARCHITECTURE.md](../TECHNICAL_ARCHITECTURE.md) §11.

---

## 1. Tuning principles

1. **First 30 minutes must sing:** a first park following the guided opening card chain reaches
   profitability inside 3 months; a Story‑1 player should never see <$5k cash unless they
   ignore every card and the Advisor.
2. **Tension, not starvation:** Standard difficulty targets 65–75% of months cash‑positive for a
   competent player; Tycoon 50–60%.
3. **Every price has a visible demand response** within one month (guests are elastic, §4.3).
4. **One knob per concept:** avoid double‑penalties (e.g., rain lowers arrivals; it does not
   also directly lower rating — the emptier park does that naturally).
5. **Big toys are loans:** marquee rides cost 1.5–3× monthly gross on purpose — debt is the
   intended path to growth (GAME_DESIGN P3).

## 2. Difficulty modifiers

| Parameter | Relaxed | Standard | Tycoon |
|-----------|---------|----------|--------|
| Starting cash multiplier | ×1.5 | ×1.0 | ×0.75 |
| Loan APR offsets | −2 pt | 0 | +3 pt |
| Guest need decay | ×0.85 | ×1.0 | ×1.15 |
| Guest price tolerance | ×1.2 | ×1.0 | ×0.85 |
| Breakdown MTBF | ×2.0 | ×1.0 | ×0.67 |
| Event cadence (avg/month) | 0.75 | 1.25 | 1.75 |
| Inspection spot‑check chance/month | 5% | 10% | 18% |
| Star Ticket payout | ×0.75 | ×1.0 | ×1.25 |
| Receivership entry (consecutive insolvent months) | 3 | 2 | 1 |

## 3. Starting conditions, land & districts

### 3.1 Starting conditions

| Item | Value |
|------|-------|
| Story 1 start (Standard) | $50,000 cash · Meadowbrook‑Small site · Boardwalk kit · entry $10 preset |
| New sandbox park default | $75,000 · Meadowbrook · difficulty Standard · events on · hard‑fail off · entry **$5** preset while no rides exist (fair value is shop/scenery‑driven pre‑M3 — see the §4.1 M2 note) |

### 3.2 Land & construction

| Item | Value |
|------|-------|
| Expansion area (authored, ~8×8‑cell equivalent) | 1st $6,000, then ×1.35 each (2nd $8,100, 3rd $10,935…) |
| Path piece / plaza cell | $40 / $60 · queue piece $60 |
| Scenery props | $25–$400 by size class (S/M/L/XL = $25/$80/$180/$400) |
| Surface paint | $5 per cell · pool basin dig (flat ground) $120/cell |
| Auto‑foundation on gentle slope | +10% of piece cost (shown in ghost price) |
| Bulldoze refund | 70% (100% ≤30 s after placement; +10% with Works Yard reclaimer) |

### 3.3 Districts (unlocks by Park Level; all optional)

| District (plot price · unlock) | Buildables | Numbers |
|--------------------------------|-----------|---------|
| **Parking Grounds** ($4,000 · L3) | Parking row $150/bay‑piece (2 cars ≈ 5 guests peak) · taxi rank $2,000 · lot greenery | Arrival capacity = 60 gate base + 5/bay + 40/taxi rank; lot Wonder dressing gives +2 Value first impression; full lot ⇒ visible car queue + turnaways |
| **Arrival Station** ($18,000 · L18) | Station platform + track stub, one per site | +250 arrivals/day in 4 scheduled bursts; burst size scales with rating |
| **Resort Row** ($12,000 · L10) | Cabin (2 rooms) $1,700 · hotel floor piece (4 rooms) $3,400 · gardens | Nightly rate default $30/room (player‑set, elasticity as §4.1); occupancy = f(rating, night hours open); hotel guests return next day with wallet ×0.8, Energy +40; upkeep $6/room/mo |
| **Staff Village** ($8,000 · L8) | House $2,400 (lodges 3 staff) · gardens | Staff cap = 12 base + 3/house; housed staff +10% effectiveness, −10% wage |
| **Commerce Quarter** ($15,000 · L14) | Office building $9,000 · shopfront $5,500 · billboard $800 | Rent/building/mo = $150 × rating × min(guests/500, 2) (shopfront ×0.6); +1 sponsor slot per 2 buildings; billboards +10% marketing efficiency each (max 3 counted) |
| **Works Yard** ($10,000 · L12) | Workshop $7,500 · depot $6,000 · reclaimer $4,500 (one each) | Workshop: ride upkeep −15%, repair time −25% · depot: piece costs −8% · reclaimer: +10% bulldoze refund |

## 4. Park‑level formulas

### 4.1 Appeal & arrivals

```
Appeal = Σ(open ride appeal × novelty) × varietyBonus(1.0–1.25)
       + sceneryScore×0.15 + showsScore
ArrivalRate/min = base(plotTier) × Appeal^0.6 × ratingMult(0.6–1.6)
                × weatherMult × marketingMult × entryPriceElasticity
EntryPriceElasticity = clamp(1.6 − (entry / fairEntry)^1.4, 0.1, 1.3)
   fairEntry = $6 + $1.1 × Σ(top8 ride E) / 8 … shown to player as "guests expect ~$X"
```

Novelty: new ride ×1.4 decaying to ×1.0 over 3 months; refurb restores to ×1.15.

> **M2 interim (shipped, pre‑rides).** Until rides land (M3) the sim runs a reduced model with
> the same elasticity shape (clamp and exponent unchanged):
> `appeal = 1.2 + shops×1.6 + scenery×0.06 + min(pathCells×0.04, 4)` — zero arrivals with no
> path cells or outside gate hours (09:00–21:00) — with day rhythm ×0.7 before 11:00, ×1.0
> until 17:00, ×0.5 after; `fairEntry = $8 + $1×shop + min($0.04×scenery, $3)`. The spawn
> accumulator adds `rate/50` per tick (≈ rate per 10 game‑minutes). Sandbox entry preset is
> $5 during this phase (§3.1).
>
> **M3 addendum:** open rides join both terms — `appeal += Σ(open ride E) × 1.0` and
> `fairEntry += $1.10 × avg(top-8 open ride E)` (the doc formula's ride term, shops/scenery
> terms retained until the rating system lands). Guests seek rides on low Fun (thrill-leaning
> archetypes even while content), pay the ride ticket from their wallet, and step off with a
> Fun boost from the archetype/E-band match.

### 4.2 Park Rating (0–5.0★)

`Rating = 5 × Σ(weighted subscores)/100` with weights: Fun 30 · Value 20 · Care 20 · Wonder 15 ·
Flow 15. Sub‑score formulas use rolling 1‑month windows (e.g., Care = 100 − litterDensity×22 −
vomit×30 − citationPenalty − restroomShortfall×18, clamped). Full derivations live beside the
code (`sim/rating/`) and must match this doc's weights.

**Confidence blending (anti‑death‑spiral, pillar P3).** Every sub‑score is reported as
`50 + confidence × (raw − 50)`, where `confidence = clamp(guestExposure / 25, 0, 1)` over the
same rolling month. A park nobody has visited yet reads a flat 2.5★ rather than 0★, so a quiet
opening week can never compound into an arrivals collapse the player cannot climb out of.
Confidence reaches 1.0 at 25 guest‑months of evidence and is shown in the UI as
"still settling" until then. A park is **seeded at 2.5★** on creation and on migration, and
the stored value refreshes every 25 ticks from the sim tick — never from a UI read, since the
rating feeds arrivals and a park must simulate identically whether or not a panel is open.

Each sub‑score also reports its **top causes** as structured ids + magnitudes (`fun.noRides`,
`care.litter`, …) — never sentences. The sim ships ids; the UI supplies the words, so a cause
is one i18n key away from being explained in any language.

A live Consortium loan caps the *displayed* rating at 4.5★ (§8.2); the underlying sub‑scores
are unaffected.

### 4.3 Guest spending

| Archetype | Share | Wallet | Refill @ATM | Price tolerance |
|-----------|-------|--------|-------------|-----------------|
| Family | 34% | $110 (group) | 1× | 1.0 |
| Thrill‑seeker | 26% | $70 | 1× | 0.9 |
| Foodie | 16% | $95 | 2× | 1.2 (food) |
| Sightseer | 18% | $55 | 0× | 0.8 |
| Superfan | 6% | $160 | 2× | 1.3 |

Needs decay (full→0 minutes, Standard): Hunger 150 · Thirst 110 · Bladder 130 (accelerates
after eating/drinking) · Energy 190 · Fun 90 (decays only while idle/queueing; strolling the
paths *replenishes* Fun at 0.6× that rate — walking a pretty park is its own reward) · Comfort
event‑driven. Emote thresholds at 45 (thought) and 22 (angry emote + rating impact on exit).

## 5. Rides

### 5.1 Flat rides & experiences

| Ride | Cost | Ticket* | Cap | Cycle (game‑min) | E / I / N | Upkeep/mo | MTBF (cycles) | Footprint |
|------|------|---------|-----|------------------|-----------|-----------|---------------|-----------|
| Teacup Twirl | $6,500 | $3 | 16 | 4 | 3.2/2.8/4.5 | $220 | 620 | 5×5 |
| Critter Carousel | $5,200 | $2 | 20 | 5 | 2.6/1.4/1.2 | $180 | 800 | 5×5 |
| Galleon Swing | $14,000 | $4 | 24 | 5 | 5.4/5.8/5.0 | $420 | 480 | 4×9 |
| Rocket Orbit | $11,500 | $4 | 12 | 4 | 4.8/4.4/3.6 | $360 | 520 | 6×6 |
| Pumpkin Drop | $18,500 | $5 | 12 | 3 | 6.6/7.2/4.2 | $520 | 430 | 4×4 (tall†) |
| Sled Slide | $9,800 | $3 | 16 | 6 | 4.4/3.4/2.2 | $300 | 640 | 6×10 |
| Haunted Manor | $16,000 | $4 | 30 flow | 8 walk | 5.2/3.8/1.6 | $380 | — | 8×10 |
| Castle Quest | $15,000 | $4 | 30 flow | 8 walk | 4.6/2.4/0.8 | $350 | — | 8×10 |
| Cuddle Corral | $7,500 | $2 | 24 flow | 10 | 3.4/0.6/0.2 | $400 (animal care) | — | 8×8 |
| Paddle Bay | $9,000+water | $3 | 10 boats×2 | 10 | 3.8/1.2/1.8 | $260 | 700 | ≥6×6 water |
| Marble Cascade | $8,800 | free (Wonder+) | spectators | — | +Wonder aura | $240 | 900 | 6×6 |
| Poly Arena (show) | $12,000 | free | 60 seats | 20/show | +Fun pulse | $300+entertainer | — | 10×10 |

\* Default ticket; player‑set. † Storm‑closes (height class H2+).

### 5.2 Tracked rides

| Ride | Station+base | Per piece avg | Train | Cap/train | E/I/N | Upkeep/mo | Notes |
|------|--------------|---------------|-------|-----------|-------|-----------|-------|
| Mousetrap (Wild Mouse) | $9,000 | $260 | $2,200 | 8 | from layout, typical 5.5/6/5 | $30/piece | Min 24 pieces viable |
| Steelwind (Steel) | $14,000 | $340 | $3,600 | 16 | typical 7/6.5/4.5 | $34/piece | Chain lift req. |
| Sky Serpent (Inverted) | $20,000 | $460 | $4,800 | 16 | typical 8/7.5/5.5 | $46/piece | Unlock L20+; storm‑closes |
| Splashlog Flume | $12,000 | $300 | $1,800 | 8 | typical 5/3.5/2 | $28/piece | Needs ≥3 water splash pieces |
| Poly Express | $8,000/station | $180 | $3,000 | 24 | 3/1/0.5 | $20/piece | Transport: counts toward Flow |
| Poly 500 Karts | $10,000 | $220 | $900/kart | 1×8 karts | 5.5/4.5/2.5 | $24/piece | Lap length drives E |
| Putt Paradise | $6,000 | $150/hole‑piece | — | 4/hole flow | 3.5+parVariety/1/0.2 | $12/piece | 9 or 18 holes |

### 5.3 Track stat formula (v0)

```
E = clamp(1.2 + 0.9×drops + 1.4×inversions + 2.2×speedVariance + 0.8×airtimePieces
          + sceneryProximity(0–1)×1.5 − 0.9×excessBrakes, 0, 10)
I = clamp(0.8 + 1.1×maxSpeedNorm + 1.6×inversions + 1.2×lateralG + 0.7×dropMax, 0, 10)
N = clamp(0.4 + 1.8×inversions + 1.3×lateralG×speed + 0.9×spinPieces − comfortPieces, 0, 10)
Appeal per archetype = gaussian match of (E,I) to archetype preference bands; N>7 halves Family/Foodie appeal.
```

> **M3 shipped subset.** Tracked families live at M3: **Steelwind** (steel) and **Mousetrap**
> (mouse) with the §5.2 costs (station+base, per-piece average × per-kind factor, train).
> Flat rides live: Teacup Twirl, Critter Carousel, Galleon Swing, Rocket Orbit, Pumpkin Drop
> per §5.1. The §5.3 stat formula runs on composition metrics from the energy model
> (TECH §4.6) with these authored constants: launch 4.2 m/s · chain 3.8 m/s · friction
> 0.55 v²/m · min speed 1.1 m/s · max 26 m/s · loop entry ≥9 m/s. Banked (skew) pieces,
> Sky Serpent, Splashlog and the remaining §5.2 rows arrive with their milestones. Guests
> pay per ride (§4.3 spending); appeal/fairEntry gain ride terms per the §4.1 M3 note.

### 5.4 Reliability & refurb

Breakdown roll per cycle: `p = base(1/MTBF) × age^1.3 × (2 − mechanicCoverage)`. Repair time
20–60 game‑min (Mechanic trait/coverage). Refurb: 25% of build cost, 1 day closed, resets age +
novelty ×1.15. Un‑refurbed rides gain visible wear at age >18 months (ASSET_GUIDE damaged
variants).

## 6. Shops & facilities

| Building | Cost | Default price | Unit cost | Satisfies | Serve time (s) | Upkeep/mo |
|----------|------|---------------|-----------|-----------|----------------|-----------|
| Snack Shack | $3,200 | $6 | $1.7 | Hunger +45 | 15 | $120 |
| Grill Garden | $5,500 | $9 | $2.8 | Hunger +70, Thirst −5 | 25 | $170 |
| Sweet Scoop | $4,200 | $5 | $1.2 | Hunger +25, Fun +6 | 12 | $140 |
| Sip Station | $2,600 | $4 | $0.8 | Thirst +55 | 8 | $90 |
| Poly Bistro | $12,000 | $18 | $6 | Hunger +90, Energy +20 | 20 min seated ×40 seats | $420 |
| Gift Kiosk | $4,800 | $12 avg | $4 | Fun +8, souvenir | 20 | $150 |
| Restroom | $2,800 | free ($0.5 optional) | $0.3 clean | Bladder +85 | 90 s occupancy ×6 | $110 |
| First Aid | $3,600 | free | — | Nausea −60 | 3 min | $160 |
| ATM | $1,500 | $2.5 fee | — | wallet refill | 10 | $60 |
| Info Kiosk | $2,000 | free | — | −60% lost chance in 40 m | — | $80 (Guide staffed) |

Portion slider: ±30% price/satisfaction/cost linkage (M5). **"Fair price" hinting ships**:
click a shop in inspect mode to price it, and the panel states what guests will wear.

**Per‑shop pricing (shipped, was overdue from M3).** Price lives on the placed piece, not the
shop type, so two Snack Shacks can charge differently and demolish/undo carry the price. Guests
weigh it: fair price = `default × 1.15 × archetypeTolerance × desperation`, where desperation
rises to ~1.38 as the need empties — a starving guest forgives a lot. Past fair the chance of
buying falls off smoothly rather than cutting off, so one cent over the line does not empty the
queue. Archetype price tolerance (§4.3: 1.0 / 0.9 / 1.2 / 0.8 / 1.3) was specified in M2 and
unread until now — pricing is what finally gave it something to bite on.

Free facilities cannot be charged for at all (GAME_DESIGN §24), and a $40 ceiling caps the UI —
a decency rail, not a balance dial, since elasticity already makes gouging unprofitable.

> **M2 shipped subset.** Snack Shack, Sip Station and Restroom are live (catalog pieces
> `coasterkit/stall-food|stall-drinks|stall-toilets`) with the costs/prices/satisfaction above.
> Serve times shipped in ticks — 13 / 7 / 8 (the table's second‑values read as ticks for now);
> per‑serving litter chance is 0.3 / 0.2 / 0 (GAME_DESIGN §12.3). The remaining buildings, the
> portion slider, price editing and multi‑stall occupancy land with their milestones (M3+).

## 7. Staff

| Role | Wage/mo | Hire fee | Coverage | Effect |
|------|---------|----------|----------|--------|
| Mechanic | $950 | $300 | ~10 rides patrol | Repair 30 g‑min base; presence halves age factor |
| Janitor | $620 | $150 | ~60 path cells | Litter decay 4×; vomit 90 s |
| Entertainer | $700 | $200 | 1 zone / show slot | Queue Fun +12; show pulses +Fun park‑wide |
| Guide | $650 | $150 | 1 info kiosk / gate | Lost −60%; vandal deter 70%; +Flow |

Morale‑lite: unstaffed backstage (no Staff Room within 40 m of zone) = −15% effectiveness, shown
as a coffee emote. Raise button: +10% wage = +8% effectiveness for 6 months.

> **M2 shipped subset.** Janitors only ($620/mo wage, $150 hire fee, wages post at month end),
> with nearest‑litter pursuit instead of coverage zones — patrol areas, morale and the other
> roles arrive with their systems (Mechanics with rides in M3).

## 8. Events & loans

### 8.1a Weather chain (one kind per park day)

Rain, Storm and Heatwave are **conditions, not cards** — the §8.1 table below lists them for
frequency reference, but the Rain row's own cooldown column already reads "(weather‑driven)".
They are drawn from a day‑to‑day Markov chain, three days ahead, and the forecast is persisted:
the strip is a promise the sim keeps, or planning around a storm is impossible (pillar P5).

| Kind | Arrivals | Thirst decay | Storm‑closes H2+ | Notes |
|------|----------|--------------|------------------|-------|
| Sunny | ×1.10 | ×1.0 | — | |
| Overcast | ×1.00 | ×1.0 | — | The only kind a storm can brew out of |
| Rain | ×0.60 | ×1.0 | — | Covered‑ride demand bonus deferred (no covered flag yet) |
| Storm | ×0.35 | ×1.0 | yes | Reopens only what it closed, never a player‑closed ride |
| Heatwave | ×0.85 | ×1.6 | — | No separate drink‑income bonus — see below |

Chain rows sum to 1 and are asserted in `weather.test.ts`, together with the long‑run shares:
rain 12–26%, storm 1–6%, heatwave 3–14%, fair weather >55%. Storms never follow a clear sky.
A brand‑new park always opens sunny.

**One knob per concept (§1 rule 4).** A heatwave raises Thirst decay and *nothing else* — the
extra drink income follows from thirstier guests on its own. Paying the player a second time
with a ×1.8 income multiplier would double‑count one event; the balance rule that forbids
double‑penalties forbids double‑rewards the same way.

### 8.1 Event deck (Standard weights, avg 1.25/month)

| Event | Weight | Cooldown | Effect summary |
|-------|--------|----------|----------------|
| Rain day | 18 | — (weather‑driven) | Arrivals ×0.6; covered rides +demand |
| Storm | 6 | 2 mo | H2+ rides close 1 day; cleanup $ + litter |
| Heatwave | 8 | 2 mo | Thirst decay ×1.6; splash/drink income ×1.8 |
| VIP critic | 7 | 3 mo | Secret 2‑day audit → ±0.3★ press story |
| Influencer swarm | 7 | 2 mo | +40% arrivals 2 days, litter +30% |
| Breakdown streak | 8 | 2 mo | Target ride MTBF ×0.4 for a week |
| Litter wave | 8 | 1 mo | Litter spawn ×2 for 2 days |
| Vandal night | 6 | 2 mo | 3–6 props damaged unless Guide coverage |
| Hygiene scare | 5 | 3 mo | If any shop cleanliness <40: Care −12, fine $2k |
| Lost kid | 8 | 1 mo | Find in 10 min via camera ping → +Care, 🎟 |
| Sponsor offer | 6 | 3 mo | +$1,800/mo for ride wrap, Wonder −4 while active |
| Tax audit | 4 | 6 mo | Books fee $1,200 or fine $4,500 (if missed payments) |
| Refurb subsidy | 5 | 4 mo | Next refurb 50% off, 1 month window |
| Coaster‑of‑month | 4 | 6 mo | Submit best track: E≥6.5 → +0.2★, 🎟×2 |

**Shipped in M4:** VIP critic · Influencer swarm · Breakdown streak · Litter wave · Sponsor
offer · Tax audit · Coaster‑of‑month. Rain/Storm/Heatwave moved to the weather chain (§8.1a).
Four cards wait on systems that do not exist yet and are named in ROADMAP M5 — Vandal night
(damaged‑prop variants), Hygiene scare (per‑shop cleanliness), Lost kid (camera‑ping
interaction), Refurb subsidy (`ride/refurbish`). A card that fires with no visible effect is
worse than no card, so none of the four ships early.

`eventsPerMonth` is an **expectation, not a count**: the whole part always draws, the fraction
is a coin flip, so the long‑run average sits exactly on the §2 table. Cooldowns and
prerequisites can only pull the realised rate *below* it, never above — asserted over 4,000
months per difficulty. The deck goes silent during Receivership: it is a rescue, not a pile‑on,
and the recovery chain has to stay winnable (ADR‑15).

Scheduled **inspection** every 3 months ±1 month (§2 spot‑check odds on top): score =
avg reliability (40%) + First Aid coverage (20%) + path crowding (20%) + citation history (20%);
pass ≥70 → +0.1★; fail → $2,500 fine + worst ride closed until the player reopens it + Care −10
for a month (as decaying citations, so repeated failures cannot stack into a floor).

> **Jitter granularity.** The doc's original "±2 weeks" cannot be expressed: inspections resolve
> at month close, so the month is the smallest addressable unit and ±half a month rounds to
> exactly zero — a perfectly predictable schedule, which is the one thing the jitter exists to
> prevent. ±1 whole month is the nearest honest reading (inspections land every 2–4 months).
>
> **First Aid coverage** is 20% of the score and First Aid does not exist yet, so that share is
> scored from mechanic coverage — the nearest shipped proxy for "this park can look after
> people". ROADMAP M5 swaps it when the building lands.

### 8.2 Loans (offers scale with credit grade A–E)

| Product | Amount | APR (grade A→E) | Term | Origination |
|---------|--------|------------------|------|-------------|
| Piggy Bank | $10,000 | 6→11% | 24 mo | 1% |
| Park Trust | $25,000 | 8→14% | 36 mo | 2% |
| The Consortium | $60,000 | 11→19% | 48 mo | 3% + rating cap 4.5★ while active |

Interest accrues monthly on remaining principal; min payment = amortized; early payoff free.
Credit grade: start C; +1 grade per 6 clean months; −1 per missed payment; floor E triggers
collections (train repossession event) at 2 misses. Debt ratio >65% of park value blocks new
offers.

**Receivership (no game‑over — GAME_DESIGN §14.3):** entry after N consecutive insolvent
months (§2). While active: marketing frozen · construction limited to items ≤$1,000 ·
50% of monthly profit auto‑pays oldest debt · recovery goal chain deals in (repair all rides →
one profitable month → debts current). Exit when debts current and cash ≥ $0 → "comeback"
press story (+0.2★ over 2 months). Optional sandbox toggle "Classic bankruptcy" replaces
Receivership with a hard fail — off by default, never available in Stories.

### 8.3 Marketing campaigns (one at a time; frozen in Receivership)

| Campaign | Cost | Runs for | Reach | Skews toward |
|----------|------|----------|-------|--------------|
| Flyers | $1,200 | 1 mo | +15% arrivals | Family ×1.35 · Sightseer ×1.25 |
| Online push | $3,000 | 2 mo | +30% arrivals | Superfan ×1.5 · Thrill ×1.4 · Foodie ×1.1 |
| Parade day | $6,500 | 3 mo | +45% arrivals | Family ×1.5 · Foodie ×1.3 · Sightseer ×1.2 |

Reach multiplies the arrivals term (§4.1 `marketingMult`); the skew reweights which archetypes
those extra guests are drawn from, so a channel changes *who* shows up, not just how many.
Cost is charged once at launch to the `marketing` expense category. Difficulty scales nothing
here — the lever is the same on every setting.

### 8.4 Difficulty modifiers (Relaxed / Standard / Tycoon)

| Modifier | Relaxed | Standard | Tycoon |
|----------|---------|----------|--------|
| Starting cash | ×1.5 | ×1.0 | ×0.75 |
| Loan APR offset | −200 bps | 0 | +300 bps |
| Need decay | ×0.85 | ×1.0 | ×1.15 |
| Price tolerance | ×1.2 | ×1.0 | ×0.85 |
| Breakdown MTBF | ×2.0 | ×1.0 | ×0.67 |
| Events per month | 0.75 | 1.25 | 1.75 |
| Inspection chance/mo | 0.05 | 0.10 | 0.18 |
| Star Ticket rate | ×0.75 | ×1.0 | ×1.25 |
| Months insolvent → Receivership | 3 | 2 | 1 |

Difficulty is chosen at park creation and stored on the save; the derived modifier table is
recomputed on load (never serialized) so retuning this table reaches existing parks.

## 9. Progression

### 9.1 Park XP sources

Guest‑exit joy (1–6 XP by mood) · milestones (first 100 guests: 500 XP…) · **Goal Deck cards**
(small 60–150 XP, horizon cards 400–800 XP) · monthly rating bonus (rating × 60) · coaster
completions (E×40). No XP from spending money (no pay‑to‑level loop). *(M2 pays XP from Goal
Deck cards only; exit joy and the rating bonus switch on with the rating system.)*

### 9.2 Level curve (1→30)

`XP(next) = 400 × level^1.35` → L2=400, L5≈3,500 cum, L10≈17k, L20≈76k, L30≈187k cumulative.
Target pacing (Standard, competent play): L1–8 in first hour, L15 ≈ hour 3, L30 ≈ hour 8–10 per
park. Every 5th level = Milestone node (fireworks + 🎟1).

### 9.3 Star Tickets & Collection prices

Story stars: 1★=2🎟, 2★=+3🎟, 3★=+5🎟 (80🎟 total across the 8 Stories). Goal Deck horizon
cards and milestones drip ~20🎟 more per long park. Collection: Theme Kit unlock 8🎟 ·
blueprint pack 3🎟 · cosmetic path/fence skin set 2🎟. Story 8 assumes ≥5 kits unlocked —
earnable by Story 6 without 3★‑everything, or by sandbox play alone (no grind wall, no
mandatory Stories).

### 9.4 Goal Deck dealing rules

Max 3 active cards; a completed/dismissed card is replaced within 30 s (game time) from the
highest‑priority eligible pool: recovery (receivership) > first‑time guidance > need‑gap
("guests are hungry") > growth ("reach 700 guests") > mastery ("coaster E≥7 with N≤5") >
flavor. Dismissed themes cool down 2 months, then re‑enter evolved. Every pool keeps ≥1 card
eligible at all times (invariant #11); no card ever expires on a timer.

## 10. Emote mapping (EmotesPack → meaning)

| State | Emote glyph (pack id) |
|-------|------------------------|
| Delighted | `emote_faceHappy` / `emote_heart` |
| Hungry | `emote_food`* | Thirsty | `emote_drops` |
| Tired | `emote_sleep` | Nauseous | `emote_swirl` |
| Angry (price/queue) | `emote_anger` / `emote_cross` |
| Lost | `emote_question` | Wow (high E ride) | `emote_star` |
| Wallet empty | `emote_cash`* strike variant |

\* exact glyph ids confirmed against pack contents during M2 (530 available; ASSET_GUIDE §1).
One style family only; colorblind‑safe variants add shape borders (UI_UX §2, GAME_DESIGN §23).

## 11. Tuning invariants (become Vitest tests, TECH §11.1)

1. The guided opening card chain (scripted commands) ends month 3 with cash ≥ $8,000 and
   rating ≥ 2.0★.
2. Same seed + same command log ⇒ identical state hash at tick 30,000 (determinism).
3. No need decays full→critical(22) in <45 game‑min under Standard decay with zero amenities.
4. Default‑priced Snack Shack near a 200‑guest flow is profitable within 1 month.
5. A 40‑piece Steelwind with 2 drops + 1 loop scores E ∈ [6.0, 8.0], N ≤ 6.5 (formula sanity).
6. Piggy Bank loan fully amortizes to $0 within term at min payments (money math exactness).
7. Storm event never fires twice within cooldown; deck respects prerequisites at 10k simulated months.
8. Receivership cannot trigger while cash ≥ 0, and a scripted recovery playbook always exits it
   within 6 months (no inescapable debt spiral — GAME_DESIGN P3).
9. L30 reachable ≤ 200k cumulative XP under §9.1 sources at target pacing (no dead‑end curve).
10. Every catalog ride/shop/district id referenced in this doc exists in `catalog.json`, and
    every catalog entry maps to a real `/assets` source file (kit‑only law, P7).
11. Goal Deck: at any reachable park state, ≥1 eligible card exists per active horizon tier,
    and zero cards are mandatory (P4 encoded as a test).
12. Arrival capacity is monotonic: adding a parking bay/taxi/station never reduces arrivals.
