# AGENTS.md — Dealer RTS (DealerFront)

Guide for agents working on this repository. **Read this file before any task.**

## The project

**Solo** strategy/management game on a **real map** (Paris, IRIS quarters) rendered with **mapcn / MapLibre**, playable in the browser. The player plays **the cartel** (God view): they **command from afar** (no more single character). Objective: **stay the last cartel in play** (battle royale), against **5 AI gangs** and the **police**.

Hosting: **Cloudflare Workers** (API/utilities) + **static assets** (SPA). The simulation runs **client-side**.

> ✅ **OpenFront-like redesign underway**: the design (`docs/`) **and the simulation core (P1 territory)** are in **DealerFront** mode (quarter management, god-view, no more character). The following systems (economy, tech, police, endgame) remain to be implemented in phases.

## Design source of truth

- [`GDD-dealer-rts.md`](./GDD-dealer-rts.md) = **orchestrator** → points to `docs/`.
- Rules live in the specs under [`docs/`](./docs/index.md), one per system.
- New foundation: `pillars` → `core-loop` → `territory` → `combat` → `economy` → `tech` → `factions` → `police-ai` → `procgen` → `command` → `win-conditions`/`scoring` → `ui-ux`/`art-direction` → `tech-stack`.
- Each spec ends with a **§ Decisions made**; the `TBD`s are in [`docs/open-questions.md`](./docs/open-questions.md).
- **Every design decision is recorded in the relevant spec.**

## Stack

- **Runtime**: Cloudflare Workers (API under `/api/*`) + Workers static assets. **No game server** (client-side simulation).
- **Frontend**: Vite + React 19 + strict TypeScript + **mapcn / MapLibre**.
- **Simulation**: **deterministic and agnostic** core (no React/DOM dependency), fixed step **10 Hz**. Target architecture: **intents → executions** (inspired by OpenFront), Worker-ready.
- **Package manager**: **bun**. Audio: **cuelume** (Web Audio, no files).

## Commands

| Command | Role |
|---|---|
| `bun install` | Install dependencies |
| `bun run dev` | **Game**: local dev (Vite + Worker) — **http://localhost:5173** |
| `bun run build` | Typecheck + production build (game + Worker) |
| `bun run preview` | Preview the build in the Workers runtime (game + `/api/*`) |
| `bun run typecheck` | Typecheck (app / node / worker) |
| `bun run test` | Vitest tests |
| `bun run sim:mass` | Massive balancing simulation (bot, 200 seeds × 15,000 ticks; `SEEDS`/`TICKS` in env) |
| `bun run sim:bench` | 100 games → SQLite (`data/sim.sqlite`) + dashboard JSON export (`SEEDS`/`CADENCE`/`TICKS`) |
| `bun run scripts/playtest.ts` | **Playability audit**: exercises every player action + 8 full games |
| `bun run scripts/agent-example.ts <arena> <token> [url]` | **Reference agent** (HTTP template) for an arena |
| `bun run dashboard:dev` | **Local balancing dashboard** (`http://localhost:5174`, root = the dashboard) — run `sim:bench` first |
| `bun run dashboard:build` | Dashboard build (`dist-dashboard/`, **outside git and outside deployment**) |
| `bun run cf-typegen` | Regenerate `worker-configuration.d.ts` |
| `bun run deploy` | **Do not run without an explicit request** |

> The **dashboard** is a **local tool**: separate Vite config (`vite.dashboard.config.ts`), gitignored sources, never included in the game's Workers build.

## Conventions

- **Strict TypeScript**, `verbatimModuleSyntax` (`import type`), no `any`, no double-cast.
- **Pure and deterministic simulation core**: never `Math.random()` (seeded PRNG), no DOM/React access, time via fixed step (10 Hz).
- **Non-negotiable pillars** ([`docs/pillars.md`](./docs/pillars.md)): no rubber-banding, no meta, pure causality, functional B&W, **color = faction information**, no AI omniscience.
- **God view**: you command **quarters** (faction orders), not a character.
- **Money is king of war**: dirty/clean cash buys the war (upkeep, armament, mercenaries, quarter buyout, contract against a gang, corruption). **Members** can be bought as **mercenaries** (increasing cost, capped by the cap).
- **Language**: docs and *design* comments in **English**; code and identifiers in **English**.
- **Comments**: only if non-obvious.
- **Cloudflare**: `wrangler.jsonc` (JSONC), up-to-date `compatibility_date`, `nodejs_compat`, observability; secrets via `wrangler secret put`; no request state in globals; `await`/`waitUntil` on every promise.
- **License**: OpenFront is **AGPL-3** → we reuse the **ideas**, **no code copied**.

## Current structure (to migrate)

```
GDD-dealer-rts.md        Orchestrator (points to docs/)
docs/                    DealerFront specs (territory, combat, economy, …)
worker/index.ts          Native Worker (fetch) — route /api/health
src/main.tsx             React entry
src/App.tsx              UI + HUD
src/sim/                 Deterministic simulation core (DealerFront)
  factions.ts            Factions (player + AI gangs), colors, resources
  territory.ts           Quarter ownership, control and buildings, adjacency
  buildings.ts           Building types, costs and effects
  tech.ts                Tech tiers (Armament/Protection/Logistics) + hitman
  police.ts              Anti-leader police (Pressure, raids, liquidation, corruption)
  diplomacy.ts           Pairwise relations, pacts, betrayals (v1)
  world.ts               Loop: production, sales, laundering, brawls, AI, police, diplomacy, victory/defeat
  bot.ts                 Deterministic bot (balancing): autoPlay / playOut
  balance.test.ts        Regression: composition, long runs, determinism, economy
  police.test.ts         Police: targeting, raids, liquidation, corruption
  win.test.ts            Endgame: double victory, bankruptcy, score, overtime
  diplomacy.test.ts      Diplomacy: relations, pacts, betrayal, allies
  constants.ts / rng.ts / clock.ts / types.ts
scripts/mass-sim.ts      Massive balancing simulation (SEEDS/TICKS/CADENCE)
scripts/build-paris-map.ts  Generates the Paris IRIS map (zones, adjacency, spawns, profiles, geometry)
src/sim/maps/            paris.ts (generated) + paris-iris.geojson (geometry) — only map played
src/render/              mapcn / MapLibre rendering (no more 3D)
  WorldMap.tsx           Map: faction zones/Control/heat (feature-state), assault arcs, convoys
  palette.ts             Colorblind grays + faction symbols
wrangler.jsonc / vite.config.ts / tsconfig*.json
```

## Checks before finishing a task

```
bun run typecheck && bun run test && bun run build
```

## Current state

- **Design**: `docs/` has moved to **DealerFront** mode (territory, influence/control, 7-building economy, tech, AI factions, anti-leader police, control+laundering victory, faction colors).
- **Code (P1–P9 done — OpenFront-like redesign)**: `src/sim/` implements **quarters** (ownership + Control 0–100 + building), **factions** (Members/Product/Dirty cash/Clean cash/tech), **brawls**, an **AI** (builds, expands, climbs tech, hitmen), the **economy**: **8 buildings** placed by **conversion** (Housing, Lab, Storefront, Front, Safehouse, Depot, Workshop, Counter-intel), the **Product → Dirty cash → Clean cash** chain, **tech** (Armament/Protection/Logistics, tiers unlocked by Workshops), the **hitman** (+ counter-intel), the **anti-leader police** (Pressure, raids, seizure, liquidation, corruption), **diplomacy** (relations, pacts, betrayals, anti-leader coalition) and the **endgame** (victory = **last survivor**, bankruptcy, elapsed time, composite score, recap). Deterministic + tests. **God-view** rendering: **selection screen** (Paris), possession overlay colored ∝ Control, **attack outlines** (attacker color), animated **convoys**, **local heat** as an orange outline, **police ambience vignette**, **colorblind mode** (gray + symbols), **zone-based HUD without scroll** (top bar resources/objective, left = orders, right = steering, bottom = log/controls). **No more character or mouse/keyboard movement.**
- **Operations (P20)**: **Bust** (steals loot, gated Armament ≥ 1) and **Sabotage** (production ÷2, Armament ≥ 2); **Watcher** = alert + blocks operations; the **damage cap follows Armament** (tech counts).
- **Quarter war (P19)**: **loot** on capture (40% of the building's value), **watchers** (Counter-intel = bust alert), **continuous** territory outlines (edges), **batch development** (priced), **last survivor** victory.
- **Art direction/UI (P16)**: **pastel** palette (factions), flat fills per faction ∝ Control, thick **borders**, animations (pulsing siege, capture flash); **fog abandoned** (everything visible).
- **Conquest (P15)**: **sieges** (capped damage, strong regen), **3 simultaneous assaults max**, paid **Raid** (control/buildings, no capture), **9–24 s** constructions, conversion −50%/**time ÷2**; diplomacy masked (`?`/`~X%`); real quarters.
- **UX (P13)**: simulation **paused during the tutorial**, **laundering slider** (0–100%), **cuelume sounds** (buttons + events: captures, raids, tech, corruption, end), lighter HUD (Tech/Diplomacy collapsible) and CSS animations.
- **Single map — Paris IRIS (P24)**: the only map played. `CityGrid` = `zones` + `neighbors` + `spawns` + `demand`/`wealth` (profiles); `PARIS_MAP` = 992 IRIS quarters (INSEE/IGN), adjacency by shared edges, spaced spawns. **mapcn** rendering (`Map`/`MapGeoJSON`/`MapArc`/`MapControls`) in `WorldMap.tsx`, possession/Control/heat via `feature-state`, muted basemap, animated convoys. Generated by `scripts/build-paris-map.ts`. The old mode (procedural grid + isometric 3D rendering) is **removed**.
- **Local market (P21)**: each quarter has a **profile** (`CityGrid.demand` / `.wealth`) — demand = sales/recruitment capacity, wealth = price/laundering. Paris: wealth by **real arrondissement** (INSEE), demand by **IRIS type**. Profiles normalized to mean 1.0. `world.demandAt` / `wealthAt`; shown on hover and in the Quarter panel. Tested (`market.test.ts`).
- **Logistics (P22)**: a sale must be **connected to a lab** (and a front to a sale) by a path of owned quarters; otherwise capacity ×0.35. Visible **convoys** (mapcn) and **interceptable** (Armament ≥ 1). BFS recomputed only when ownership/buildings change (signature). Tested (`logistics.test.ts`).
- **Convoys carry the real money (P29, OpenFront idea)**: income is **not a faucet**. Product and Dirty cash enter `productInTransit` / `dirtyInTransit` and only land when a convoy completes its leg (`CONVOY_TRANSIT_TICKS = 60` = 6 s); each convoy loads an equal share of what is waiting, so an **interception takes real cargo** (not a slice of the treasury). Convoy dots move at their **real progress** and grow with their cargo. A **broken chain banks directly** (no convoy = no transit) so a missing Front can never starve the treasury. HUD shows the in-transit amount (amber).
- **Local police (P23)**: **heat per quarter** (rises with crime, falls, ×3 near real stations); **raids target the hottest quarters**; **corruption cools** the cartel's quarters (÷2). Heat rendered as an orange outline. Tested (`police.test.ts`).
- **Upcoming**: nothing blocking (P1–P13 done). Optional remaining: increasing cost per type, multi-select + priced preview, colorblind patterns, overtime (coded but disabled), balancing (games won "on score" dominate). **Notable agents/NPCs: abandoned** (decision, see `docs/factions.md`).
- **Battle royale (P26)**: **victory = last cartel in play** (no more control/cash threshold or clock), **6 factions**. **Encirclement**: a closed cluster (≥ 8 quarters, ≥ 35% of the faction, smaller than the encircler) capitulates at once. **Choice events** (3 types): one at a time, two options with traceable effect. **100 seeds**: 94 wins / 6 losses, 0 no-end, 0 violation. Details in `docs/win-conditions.md`, `docs/core-loop.md`, `docs/factions.md`, `docs/npc-events.md`.
- **Localized economy (P27)**: **building bonus per zone** (`ZONE_BUILD_BONUS`: residential→housing, commercial→sale, laundromat→front, industrial→lab/workshop, police→counter, park→safehouse) + **increasing cost per type** (`×1.35^n`). **Day/night cycle** (`TICKS_PER_HOUR = 120`, day = 4.8 min): **rush hours** per zone (`ZONE_RUSH`, factor `1 + amplitude·cos`, mean 1/day) → commercial by day, nightlife by night. Building icons on the map (GeoJSON source `buildings`), green pulse on build-site delivery, conquest gauge (filled fill). Details in `docs/economy.md`.
- **Performance**: sim core optimized via allocation-free per-tick counts and caches (`recount`, `owned`, `underAttack`, `supplySignature`). Rendering: **incremental `feature-state`** (only changed quarters are updated) + **tick drip** (changed quarters are painted over ~9 render frames, `reduced-motion` aware), convoys recomputed per tick, **front labels** "attacker ⚔ defender" as an HTML overlay (`map.project`, blue outgoing / red incoming). Logistics: BFS only when ownership/buildings change.
- **No database** (solo, no meta).
- **Agent-vs-agent arena (P28)**: **server** mode — 2 to 4 AI agents fight **with no human player**, a human **watches live** + **end stats**. The sim runs in a **Durable Object per game** (authoritative, **free plan**), driven by the agents **turn by turn at the agents' pace** (no timeout, unlimited actions per turn). **HTTP + MCP** interface (`/mcp`). Contract: `World.snapshot()`/`applySnapshot()` (RNG included) + `applyIntent` (`src/sim/intents.ts`). **Arena** screen in the UI. Reference agent: `scripts/agent-example.ts`. Details in `docs/arena.md`.
