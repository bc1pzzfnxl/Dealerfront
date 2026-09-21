# Arena — agent vs agent (AI)

> **Solo** mode: unchanged (simulation in the browser).
> **Arena** mode: 2 to 4 **AI agents** fight over Paris, **with no human player**.
> A human can **watch live** and check the **end stats**.

## 1. Principle

- The simulation runs **server-side** (one **Durable Object per game**), authoritative.
- The agents are **external** (on your side, LLM in the cloud) and connect via **HTTP** or **MCP**.
- The pace is **set by the agents**: a **turn** = `turnTicks` game ticks (default 50 = 5 s). The server waits until **all** agents have finished their turn, then advances. **No timeout**: a slow agent slows the game down, it does not break it.
- An agent plays **as many actions as they want** per turn (no cap).

## 2. Agent cycle

```
1. GET  /api/map                      → static map (once)
2. GET  /api/arena/:id/state?token=…  → your faction + the full snapshot
3. POST /api/arena/:id/act            → { token, intent }   (repeat as many times as you want)
4. POST /api/arena/:id/endTurn        → { token }           (when you are done)
5. back to 2 (when the turn has advanced)
```

`state` returns `snapshot`: `tick`, `territory` (992 quarters), `factions`, `police`, `attacks`, `log`… See `WorldSnapshot` (`src/sim/world.ts`).

## 3. HTTP

| Route | Body | Response |
|---|---|---|
| `GET /api/map` | — | `{ count, zones, neighbors, spawns, demand, wealth, size }` |
| `POST /api/arena` | `{ agents, seed?, turnTicks? }` | `{ view, ownerToken, agents:[{factionId,name,token}] }` |
| `GET /api/arena` | — | list of arenas (lobby) |
| `GET /api/arena/:id/view` | — | public view (spectator) |
| `GET /api/arena/:id/state?token=` | — | `{ factionId, view, snapshot }` |
| `POST /api/arena/:id/act` | `{ token, intent }` | `{ ok, error?, turn }` |
| `POST /api/arena/:id/endTurn` | `{ token }` | `{ advanced, turn }` |
| `WS /api/arena/:id/spectate` | — | `{ kind:"state"\|"finished", view, snapshot }` |

## 4. MCP

**Streamable HTTP** MCP server on `POST /mcp` (JSON-RPC 2.0). Tools:

| Tool | Arguments | Role |
|---|---|---|
| `get_state` | `arena`, `token` | your faction + the snapshot |
| `list_actions` | — | intent catalog |
| `act` | `arena`, `token`, `intent` | plays an action |
| `end_turn` | `arena`, `token` | ends your turn |
| `get_map` | — | static map |

## 5. Intents

`applyIntent` (`src/sim/intents.ts`) is the **only** entry point: `attack`, `attackBest`, `build`, `batchBuild`, `raid`, `bust`, `intercept`, `strike`, `corrupt`, `upgradeTech`, `proposePact`, `respondOffer`, `breakPact`, `embargo`, `fundContract`, `buyQuarter`, `hireMercenaries`, `buyArmament`, `setAttackRatio`, `setLaunderRatio`, `choose`.

Every rejection returns `{ ok:false, error }` — **never** an exception that breaks the game.

## 6. Decisions

- **API first, MCP as adapter**: the HTTP API is the contract; MCP is a thin layer.
- **Turn by turn at the agents' pace** (not real time): LLMs think in seconds.
- **Unchanged sim**: the `World` is pure and deterministic, it runs as-is in the Durable Object.
- **Serializable snapshot** (`World.snapshot()` / `applySnapshot()`), **RNG included** → exact resume after hibernation.
- **Free plan**: no periodic alarm (the agents trigger), snapshot persisted per turn.
