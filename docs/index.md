# Dealer RTS — Spec index (DealerFront mode)

> **Game design** specs for the project, one per system.
> Global status: **v1 DealerFront** — switch from an embodied dealer to a **god-view cartel** (quarter control, economy, AI gangs, police).
> The root `GDD-dealer-rts.md` remains the orchestrator / history.

## The mode in one sentence

**Solo** strategy/management game on a **real map** (Paris, IRIS quarters), where you play **the cartel**: **stay the last cartel in play** (battle royale), against **5 AI gangs** and the **police**.

Second mode: **agent-vs-agent arena** — 2 to 4 AI agents fight with no human player (HTTP/MCP API), a human watches live. See `arena.md` and [`../MCP.md`](../MCP.md).

## Reading order

1. `pillars.md` — vision and non-negotiable rules.
2. `core-loop.md` — loop and pacing of a game.
3. `territory.md` — quarters, Influence, Control, expansion.
4. `combat.md` — brawls, defense, hitmen.
5. `economy.md` — resources and 7 buildings.
6. `tech.md` — gear tree.
7. `factions.md` — AI gangs, diplomacy, agents.
8. `police-ai.md` — anti-leader police + corruption.
9. `procgen.md` — pre-existing city, spawns, neutrals.
10. `command.md` — command interface.
11. `win-conditions.md` + `scoring.md` — endgame and score.
12. `ui-ux.md` + `art-direction.md` — presentation and faction color.
13. `city-sim.md` + `difficulty.md` — city context and difficulty.
14. `tech-stack.md` — technical constraints.
15. `arena.md` — **agent-vs-agent** arena (server, HTTP/MCP, spectator). Connection guide: [`../MCP.md`](../MCP.md).

## Spec template

`Objective` → `Rules` → `Numeric parameters` → `Edge cases` → `Dependencies` → `Validation criteria` → `Decisions made`.
Unsettled values are **TBD** and listed in `open-questions.md`.

## Spec status

| File | System | Status |
|---|---|---|
| `pillars.md` | Vision + pillars | v3 DealerFront |
| `core-loop.md` | Loop + pacing | v3 DealerFront |
| `territory.md` | Quarters / Influence / Control | v1 DealerFront |
| `combat.md` | Brawls / defense / hitmen | v1 DealerFront |
| `economy.md` | Resources / 7 buildings | v1 DealerFront |
| `tech.md` | Gear tree | v1 DealerFront |
| `factions.md` | AI gangs / diplomacy / agents | v1 DealerFront |
| `police-ai.md` | Anti-leader police + corruption | v2 DealerFront |
| `procgen.md` | City + setup | v1 DealerFront |
| `command.md` | God-view command | v1 DealerFront |
| `win-conditions.md` | Victory / defeat | v1 DealerFront |
| `scoring.md` | Final score | v1 DealerFront |
| `ui-ux.md` | God-view interface | v1 DealerFront |
| `art-direction.md` | B&W + faction colors | v1 DealerFront |
| `city-sim.md` | Zone types / density | v2 |
| `difficulty.md` | Philosophy + O/D range | v2 |
| `npc-events.md` | Choice events / decoy | v2 |
| `tech-stack.md` | Tech stack | v2 DealerFront |
| `arena.md` | Agent-vs-agent arena (DO, HTTP/MCP, spectator) | v1 |
| `open-questions.md` | Living questions | living |

## Replacements (old mode)

- Old *orders.md* → **`command.md`** (faction orders, no more single dealer).
- Old *agents.md* → **merged into `factions.md`** (agent brain, roles, services).
- Old *resources-heat.md* → **replaced** by `economy.md` + `police-ai.md` (Heat → **police Pressure**).

## Glossary

| Term | Definition |
|---|---|
| **Quarter** | Real IRIS quarter; unit of territory (992 total). |
| **Influence** | A faction's troop resource (pool), used to conquer/defend. |
| **Control** | Durability of an owned quarter (0–100); drops to 0 → capture. |
| **Product** | Resource produced by Labs, sold. |
| **Dirty cash** | Unlaundered money obtained from sales. |
| **Clean cash** | Laundered money (Fronts); basis of the score and victory. |
| **Building** | Lab, Storefront, Front, Safehouse, Workshop, Counter-intel, Depot. |
| **Faction** | The player or an AI gang (6 total). |
| **Police Pressure** | Anti-leader gauge (0–100) that triggers raids/seizures. |
| **Hitman** | Targeted action (tech) dealing area damage to a quarter. |
| **Pact** | Temporary alliance between factions. |
