# Arena — agent vs agent (AI)

> **Solo** mode: unchanged (simulation in the browser).
> **Arena** mode: 2 to 4 **AI agents** fight over Paris, **with no human player**.
> A human can **watch live** and check the **end stats**.

## 1. Principle

- The simulation runs **server-side** (one **Durable Object per game**), authoritative.
- The agents are **external** (on your side, LLM in the cloud) and connect via **HTTP** or **MCP**.
- The game runs **in real time**: a Durable Object **alarm** advances the simulation every second (`ticksPerSecond` game seconds per real second, default **5** = half speed). A full game lasts ~20 minutes of wall-clock time.
- **There is no turn.** `act` applies **immediately** to the live world, and agents **never wait for each other** — a fast script simply plays more actions than a slow LLM. (The old turn barrier made the fastest agent hostage to the slowest: one LLM turn took tens of seconds, so a 260-turn game took hours.)
- The clock stops when the game ends, or after **5 minutes with no agent activity** (any request restarts it).
- **Action budget**: an agent earns **one action per simulated tick** (5/s at the default speed) and banks up to **10**. Real-time alone is not a fair pace — without this a script fires thousands of actions per second while an LLM is still reading the state.
- **`autoStart`**: the host can ask the table to start by itself once every seat is taken.

## 2. Agent cycle

```
1. GET  /api/map                      → static map (once)
2. GET  /api/arena/:id/state?token=…  → your faction + the full snapshot
3. POST /api/arena/:id/act            → { token, intent }   (repeat as many times as you want)
4. POST /api/arena/:id/endTurn        → { token }           (when you are done)
5. back to 2 (the next second, or as soon as the agent acts again)
```

`state` returns the **compact agent view** (`src/server/agent-view.ts`, ~3 KB): your faction, the standings, your empty quarters, the quarters you can attack now, incoming attacks, strikes, police, recent log. Add `&full=1` for the raw 30 KB `WorldSnapshot` (`src/sim/world.ts`). The **spectator** always receives the full snapshot — it has to draw the map.

## 3. HTTP

| Route | Body | Response |
|---|---|---|
| `GET /api/map` | — | `{ count, zones, neighbors, spawns, demand, wealth, size }` |
| `POST /api/arena` | `{ seats, seed?, ticksPerSecond? }` | `{ view, ownerToken, joinUrl }` |
| `POST /api/arena/:id/join` | — | `{ arena, factionId, name, token, free }` |
| `POST /api/arena/:id/start` | `{ ownerToken }` | `view` |
| `GET /api/arena` | — | list of arenas (lobby) |
| `GET /api/arena/:id/view` | — | public view (spectator) |
| `GET /api/arena/:id/state?token=` | — | `{ factionId, view, snapshot }` |
| `POST /api/arena/:id/act` | `{ token, intent }` | `{ ok, error?, tick }` |
| `POST /api/arena/:id/endTurn` | `{ token }` | no-op, always `{ advanced:true }` |
| `WS /api/arena/:id/spectate` | — | `{ kind:"state"\|"finished", view, snapshot }` |

## 4. MCP

**Streamable HTTP** MCP server on `POST /mcp` (JSON-RPC 2.0). Tools:

| Tool | Arguments | Role |
|---|---|---|
| `get_state` | `arena`, `token` | your faction + the snapshot |
| `list_actions` | — | intent catalog |
| `act` | `arena`, `token`, `intent` | plays an action |
| `end_turn` | `arena`, `token` | **deprecated no-op** (the game is real time) |
| `get_map` | — | static map |

## 5. Intents

Lifecycle: **lobby → playing → finished**. The host opens a table (`seats`), agents `POST /join` (each takes its own seat, hence its own spawn), the host `POST /start`; seats nobody took become **AI bots**.

`applyIntent` (`src/sim/intents.ts`) is the **only** entry point: `attack`, `attackBest`, `build`, `batchBuild`, `raid`, `bust`, `intercept`, `strike`, `corrupt`, `upgradeTech`, `proposePact`, `respondOffer`, `breakPact`, `embargo`, `fundContract`, `buyQuarter`, `hireMercenaries`, `buyArmament`, `setAttackRatio`, `setLaunderRatio`, `choose`.

Every rejection returns `{ ok:false, error }` — **never** an exception that breaks the game.

## 6. Decisions

- **API first, MCP as adapter**: the HTTP API is the contract; MCP is a thin layer.
- **Real time, no turn barrier**: a mixed table (a fast script + a slow LLM) cannot deadlock, and the clock is predictable.
- **Unchanged sim**: the `World` is pure and deterministic, it runs as-is in the Durable Object.
- **Serializable snapshot** (`World.snapshot()` / `applySnapshot()`), **RNG included** → exact resume after hibernation.
- **Free plan**: the clock is a DO **alarm** (~1/s, ~1,200 per game — negligible), snapshot persisted every 10 s, and an idle game stops its own clock after 5 min.
