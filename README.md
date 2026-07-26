# 🎢 Polypark

**Snap together the resort of your dreams.** A 3D low‑poly tycoon for the browser — build a
theme park piece by piece from toy kits on lush rolling terrain, then the world around it:
the parking lot, the hotel row, the office quarter. Delight blocky guests, survive storms,
loans and inspections. Your park never ends; it only grows. Single player, no account, runs
on Vercel.

> **Status: 📋 Planning complete (owner Q&A incorporated) — implementation not started.**
> Coding begins at [ROADMAP](ROADMAP.md) M0 on the owner's go (phase gate).

## The pitch

- **Toybox building on real terrain:** grid‑snap construction and a piece‑by‑piece coaster
  track builder on handcrafted landscape Sites — every element assembled from the CC0 kits in
  this repo (Kenney, KayKit: 50 packs, ~4,100 models). If the kits can't build it, it isn't in
  the game.
- **A legible living park:** up to ~1,200 guests with needs, moods and emote bubbles; problems
  are visible in the world before they're numbers in a panel.
- **Beyond the gate:** districts with real hooks — Parking Grounds (arrival capacity), Resort
  Row hotels (multi‑day guests), Staff Village, Commerce Quarter, Works Yard.
- **Real stakes, no game‑over:** loans and credit grades, breakdowns, inspections, weather, an
  event deck — and Receivership instead of bankruptcy: setbacks are chapters, never endings.
- **Guided, never forced:** an adaptive Goal Deck of optional cards replaces tutorials and
  mandatory objectives; eight Park Stories offer curated starts whose parks live on forever.
- **Modern‑game shell:** title screen, hub, options with deep accessibility, save slots +
  export files — **UI** in the style of the reference screens in [`/uiinspo`](uiinspo)
  (Overwatch/Marvel Rivals language: skewed display type, flat color cards, frosted panels).
- **Later, last of all:** a no‑login friends leaderboard via share codes.

## Documentation index

| Read | For |
|------|-----|
| [GAME_DESIGN.md](GAME_DESIGN.md) | The full game: pillars, systems, districts, content, stories, guidance |
| [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) | Stack (Next.js + R3F + bespoke sim), budgets, testing, deploy |
| [ROADMAP.md](ROADMAP.md) | Milestones M0–M8 with acceptance criteria |
| [docs/UI_UX_DESIGN.md](docs/UI_UX_DESIGN.md) | Design tokens, component kit, every screen spec |
| [docs/ASSET_GUIDE.md](docs/ASSET_GUIDE.md) | Asset inventory, CC0 licensing, content pipeline |
| [docs/GAME_BALANCE.md](docs/GAME_BALANCE.md) | Every tunable number + tuning invariants |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Decision log + open questions |
| [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md) | Rules for AI agents working here |
| [CHANGELOG.md](CHANGELOG.md) | History |

## Repository layout

```
assets/    50 CC0 low‑poly packs (source library — immutable, never shipped directly)
uiinspo/   11 UI reference screenshots (style target — reference only)
docs/      Supporting specifications
*.md       Core documents (see index above)
```

## Credits

Every 3D asset is CC0 by [Kenney](https://kenney.nl) and
[Kay Lousberg (KayKit)](https://kaylousberg.com) — heroes of open game art. Polypark credits
them in‑game (Extras → Credits) even though CC0 requires nothing.
