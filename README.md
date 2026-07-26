# 🎢 Polypark

**Snap together the park of your dreams.** A 3D low‑poly theme‑park tycoon for the browser —
build coasters piece by piece from toy kits, delight blocky guests, survive storms, loans and
safety inspections, and grow a roadside lot into a five‑star wonderland. Single player, no
account, runs on Vercel.

> **Status: 📋 Planning complete — implementation not started.**
> Coding begins at [ROADMAP](ROADMAP.md) M0 after explicit owner approval (phase gate).

## The pitch

- **Toybox building:** grid‑snap construction and a piece‑by‑piece coaster track builder using
  real CC0 low‑poly kits (Kenney, KayKit) — 50 packs, ~4,100 models, all in this repo.
- **A legible living park:** up to ~1,200 guests with needs, moods and emote bubbles; problems
  are visible in the world before they're numbers in a panel.
- **Real stakes, warm tone:** loans and credit grades, breakdowns, inspections, weather and an
  event deck — consequences are financial, never gruesome.
- **Modern‑game shell:** title screen, hub, career (8 scenarios incl. a full tutorial),
  sandbox, options with deep accessibility, save slots + export files.
- **UI** in the style of the reference screens in [`/uiinspo`](uiinspo) (Overwatch/Marvel
  Rivals language: skewed display type, flat color cards, frosted panels).
- **Later, last of all:** a no‑login friends leaderboard via share codes.

## Documentation index

| Read | For |
|------|-----|
| [GAME_DESIGN.md](GAME_DESIGN.md) | The full game: pillars, systems, content, scenarios, tutorial |
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
