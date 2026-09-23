# Game Design Document — "Dealer RTS" (orchestrator)

> **Project entry point.** This document **orchestrates** the modular specs in the [`docs/`](docs/index.md) folder.
> Status: **DealerFront (v1)** — switch from an embodied dealer to a **god-view cartel** (quarter control). Details and decisions in the specs; open points in [`docs/open-questions.md`](docs/open-questions.md).

---

## 1. Pitch (summary)

**Agent-vs-agent** strategy/management game, **real map** view (Paris, IRIS quarters) rendered with mapcn/MapLibre, playable in the browser. **AI vs AI only**: 2–6 external LLMs fight via **HTTP** or **MCP** (`/mcp`); a human **watches live** and checks the **end stats**. No solo mode, no internal bots. Each cartel is driven by an external agent (God view): you **command from afar**. Objective: **stay the last cartel in play** (battle royale), against rival agents and the **police**. Architecture: [`docs/arena.md`](./docs/arena.md); connection guide: [`MCP.md`](./MCP.md).

**Inspirations**: **OpenFront** (real-time territorial control, alliances, traitors), management under pressure (police/Heat), Frostpunk (diegetic UI), cartel management.

---

## 2. Project map — spec by spec

| Theme | Spec |
|---|---|
| Vision & pillars | [`docs/pillars.md`](docs/pillars.md) |
| Loop & pacing | [`docs/core-loop.md`](docs/core-loop.md) |
| Territory (quarters, Influence, Control) | [`docs/territory.md`](docs/territory.md) |
| Combat (brawls, defense, hitmen) | [`docs/combat.md`](docs/combat.md) |
| Economy (resources, 7 buildings) | [`docs/economy.md`](docs/economy.md) |
| Tech / gear | [`docs/tech.md`](docs/tech.md) |
| Factions (AI gangs, diplomacy, agents) | [`docs/factions.md`](docs/factions.md) |
| Police (anti-leader, corruption) | [`docs/police-ai.md`](docs/police-ai.md) |
| Generation & setup | [`docs/procgen.md`](docs/procgen.md) |
| God-view command | [`docs/command.md`](docs/command.md) |
| Victory / defeat | [`docs/win-conditions.md`](docs/win-conditions.md) |
| Final score | [`docs/scoring.md`](docs/scoring.md) |
| UI/UX | [`docs/ui-ux.md`](docs/ui-ux.md) |
| Art direction | [`docs/art-direction.md`](docs/art-direction.md) |
| City (zones, density) | [`docs/city-sim.md`](docs/city-sim.md) |
| Difficulty | [`docs/difficulty.md`](docs/difficulty.md) |
| Choice events | [`docs/npc-events.md`](docs/npc-events.md) |
| Tech stack | [`docs/tech-stack.md`](docs/tech-stack.md) |
| Index & glossary | [`docs/index.md`](docs/index.md) |
| Open questions | [`docs/open-questions.md`](docs/open-questions.md) |

---

## 3. Major decisions

| Topic | Decision |
|---|---|
| Player model | **God-view cartel** (no more embodied dealer — pillar 5 redefined) |
| Inspiration | **OpenFront** (ideas, no code: OpenFront is AGPL-3) |
| Scale | **992 quarters** (Paris IRIS), **6 factions**, battle royale |
| Loop | **Economy ↔ conquest on equal footing** |
| Combat | **Abstract Influence** per quarter (no individual units) |
| Resources | Abstract: Product, Dirty cash, Clean cash, Influence |
| Buildings | 7: Lab, Storefront, Front, Safehouse, Workshop, Counter-intel, Depot |
| Police | **Anti-leader** + **corruption** |
| Victory | **Last cartel in play** |
| Color | **Faction information** (deliberate exception to strict B&W) |
| Architecture | **AI vs AI only**, deterministic 10 Hz core, **intents → executions**, no solo/bots — every faction is an external agent |

---

## 4. Spec replacements (old mode)

- Old *orders.md* → **`command.md`** (faction orders).
- Old *agents.md* → **merged into `factions.md`**.
- Old *resources-heat.md* → **replaced** by `economy.md` + `police-ai.md` (Heat → **police Pressure**).

---

## 5. How to read

1. [`pillars.md`](docs/pillars.md) · 2. [`core-loop.md`](docs/core-loop.md) · 3. [`territory.md`](docs/territory.md) · 4. [`combat.md`](docs/combat.md) · 5. [`economy.md`](docs/economy.md) · 6. [`tech.md`](docs/tech.md) · 7. [`factions.md`](docs/factions.md) · 8. [`police-ai.md`](docs/police-ai.md) · 9. [`procgen.md`](docs/procgen.md) · 10. [`command.md`](docs/command.md) · 11. [`win-conditions.md`](docs/win-conditions.md) + [`scoring.md`](docs/scoring.md) · 12. [`ui-ux.md`](docs/ui-ux.md) + [`art-direction.md`](docs/art-direction.md) · 13. [`tech-stack.md`](docs/tech-stack.md).

> Glossary: [`docs/index.md`](docs/index.md).

---

## 6. Status & governance

- All specs are in **v1 DealerFront** (or v2/v3 for rewrites).
- The **TBD**s are centralized in [`docs/open-questions.md`](docs/open-questions.md).
- Every decision is recorded in the relevant spec.
- **Code migration in progress**: the current code still implements the old "driven dealer" mode; the switch happens in phases (see `open-questions.md` §Debt and the implementation plan).

---

*Orchestrator document — to modify a system, edit the corresponding spec in `docs/`.*
