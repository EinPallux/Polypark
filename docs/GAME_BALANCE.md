# Polypark — Game Balance Baseline

The concrete starting numbers for every tunable system. These are **v0 planning values** — the
first playable will re‑tune them, but changes happen *here first* (single source of truth), and
the invariants in §11 must keep passing in CI.

Conventions: money in `$` (integer cents internally) · time in game‑time (1 real s = 2 game min
at 1×; month = 10 real min = 3,000 ticks) · needs 0–100 · E/I/N 0–10.

Related: [GAME_DESIGN.md](../GAME_DESIGN.md) · [TECHNICAL_ARCHITECTURE.md](../TECHNICAL_ARCHITECTURE.md) §11.

---

## 1. Tuning principles

1. **First 30 minutes must sing:** tutorial park reaches profitability inside 3 months with the
   guided build order; the player should never see <$5k cash in scenario 1 unless they ignore
   the Advisor.
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
| Bankruptcy grace | 3 months | 2 | 1 |

## 3. Starting conditions & land

| Item | Value |
|------|-------|
| Scenario 1 start (Standard) | $50,000 cash · 32×32 plot · Boardwalk kit · entry $10 preset |
| Sandbox default | $75,000 · 48×48 · difficulty Standard · events on |
| Land chunk (8×8 cells) | 1st $6,000, then ×1.35 each (2nd $8,100, 3rd $10,935…) |
| Path piece / plaza cell | $40 / $60 · queue piece $60 |
| Scenery props | $25–$400 by size class (S/M/L/XL = $25/$80/$180/$400) |
| Surface paint | $5 per cell · water cell dig $120 |
| Bulldoze refund | 70% (100% ≤30 s after placement) |

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

### 4.2 Park Rating (0–5.0★)

`Rating = 5 × Σ(weighted subscores)/100` with weights: Fun 30 · Value 20 · Care 20 · Wonder 15 ·
Flow 15. Sub‑score formulas use rolling 1‑month windows (e.g., Care = 100 − litterDensity×22 −
vomit×30 − citationPenalty − restroomShortfall×18, clamped). Full derivations live beside the
code (`sim/rating/`) and must match this doc's weights.

### 4.3 Guest spending

| Archetype | Share | Wallet | Refill @ATM | Price tolerance |
|-----------|-------|--------|-------------|-----------------|
| Family | 34% | $110 (group) | 1× | 1.0 |
| Thrill‑seeker | 26% | $70 | 1× | 0.9 |
| Foodie | 16% | $95 | 2× | 1.2 (food) |
| Sightseer | 18% | $55 | 0× | 0.8 |
| Superfan | 6% | $160 | 2× | 1.3 |

Needs decay (full→0 minutes, Standard): Hunger 150 · Thirst 110 · Bladder 130 (accelerates
after eating/drinking) · Energy 190 · Fun 90 (decays only while idle/queueing) · Comfort
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

Portion slider: ±30% price/satisfaction/cost linkage. "Fair price" hinting mirrors §4.1
elasticity (tooltip: "guests think $9 is steep for a snack").

## 7. Staff

| Role | Wage/mo | Hire fee | Coverage | Effect |
|------|---------|----------|----------|--------|
| Mechanic | $950 | $300 | ~10 rides patrol | Repair 30 g‑min base; presence halves age factor |
| Janitor | $620 | $150 | ~60 path cells | Litter decay 4×; vomit 90 s |
| Entertainer | $700 | $200 | 1 zone / show slot | Queue Fun +12; show pulses +Fun park‑wide |
| Guide | $650 | $150 | 1 info kiosk / gate | Lost −60%; vandal deter 70%; +Flow |

Morale‑lite: unstaffed backstage (no Staff Room within 40 m of zone) = −15% effectiveness, shown
as a coffee emote. Raise button: +10% wage = +8% effectiveness for 6 months.

## 8. Events & loans

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

Scheduled **inspection** every 3 months ±2 weeks (§2 spot‑check odds on top): score =
avg reliability (40%) + First Aid coverage (20%) + path crowding (20%) + citation history (20%);
pass ≥70 → +0.1★; fail → $2,500 fine + worst ride closed until repaired + Care −10 for a month.

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

## 9. Progression

### 9.1 Park XP sources

Guest‑exit joy (1–6 XP by mood) · milestones (first 100 guests: 500 XP…) · objectives ·
monthly rating bonus (rating × 60) · coaster completions (E×40). No XP from spending money
(no pay‑to‑level loop).

### 9.2 Level curve (1→30)

`XP(next) = 400 × level^1.35` → L2=400, L5≈3,500 cum, L10≈17k, L20≈76k, L30≈187k cumulative.
Target pacing (Standard, competent play): L1–8 in first hour, L15 ≈ hour 3, L30 ≈ hour 8–10 per
park. Every 5th level = Milestone node (fireworks + 🎟1).

### 9.3 Star Tickets & Collection prices

Scenario stars: 1★=2🎟, 2★=+3🎟, 3★=+5🎟 (80🎟 total in career). Milestones/events small 🎟 drips
(~20 across a career). Collection: Theme Kit unlock 8🎟 · blueprint pack 3🎟 · cosmetic path/
fence skin set 2🎟. Career finale requires ≥5 kits unlocked — earnable by scenario 6 without
3★‑everything (no grind wall).

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
One style family only; colorblind‑safe variants add shape borders (UI_UX §2, GAME_DESIGN §22).

## 11. Tuning invariants (become Vitest tests, TECH §11.1)

1. Tutorial build order (scripted commands) ends month 3 with cash ≥ $8,000 and rating ≥ 2.0★.
2. Same seed + same command log ⇒ identical state hash at tick 30,000 (determinism).
3. No need decays full→critical(22) in <45 game‑min under Standard decay with zero amenities.
4. Default‑priced Snack Shack near a 200‑guest flow is profitable within 1 month.
5. A 40‑piece Steelwind with 2 drops + 1 loop scores E ∈ [6.0, 8.0], N ≤ 6.5 (formula sanity).
6. Piggy Bank loan fully amortizes to $0 within term at min payments (money math exactness).
7. Storm event never fires twice within cooldown; deck respects prerequisites at 10k simulated months.
8. Bankruptcy cannot trigger while cash ≥ 0 (guard against double‑penalty bugs).
9. L30 reachable ≤ 200k cumulative XP under §9.1 sources at target pacing (no dead‑end curve).
10. Every catalog ride/shop id referenced in this doc exists in `catalog.json` (content link check).
