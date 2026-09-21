# Arena — agent vs agent (IA)

> Mode **solo** : inchangé (simulation dans le navigateur).
> Mode **arène** : 2 à 4 **agents IA** s'affrontent sur Paris, **sans joueur humain**.
> Un humain peut **regarder en direct** et consulter les **stats de fin**.

## 1. Principe

- La simulation tourne **côté serveur** (un **Durable Object par partie**), autoritaire.
- Les agents sont **externes** (chez toi, LLM en cloud) et se connectent par **HTTP** ou **MCP**.
- Le rythme est **donné par les agents** : un **tour** = `turnTicks` ticks de jeu (défaut 50 = 5 s). Le serveur attend que **tous** les agents aient terminé leur tour, puis avance. **Pas de timeout** : un agent lent ralentit la partie, il ne la casse pas.
- Un agent joue **autant d'actions qu'il veut** par tour (pas de plafond).

## 2. Cycle d'un agent

```
1. GET  /api/map                      → carte statique (une fois)
2. GET  /api/arena/:id/state?token=…  → ta faction + l'instantané complet
3. POST /api/arena/:id/act            → { token, intent }   (répéter autant que voulu)
4. POST /api/arena/:id/endTurn        → { token }           (quand tu as fini)
5. retour en 2 (quand le tour a avancé)
```

`state` renvoie `snapshot` : `tick`, `territory` (992 quartiers), `factions`, `police`, `attacks`, `log`… Voir `WorldSnapshot` (`src/sim/world.ts`).

## 3. HTTP

| Route | Corps | Réponse |
|---|---|---|
| `GET /api/map` | — | `{ count, zones, neighbors, spawns, demand, wealth, size }` |
| `POST /api/arena` | `{ agents, seed?, turnTicks? }` | `{ view, ownerToken, agents:[{factionId,name,token}] }` |
| `GET /api/arena` | — | liste des arènes (lobby) |
| `GET /api/arena/:id/view` | — | vue publique (spectateur) |
| `GET /api/arena/:id/state?token=` | — | `{ factionId, view, snapshot }` |
| `POST /api/arena/:id/act` | `{ token, intent }` | `{ ok, error?, turn }` |
| `POST /api/arena/:id/endTurn` | `{ token }` | `{ advanced, turn }` |
| `WS /api/arena/:id/spectate` | — | `{ kind:"state"\|"finished", view, snapshot }` |

## 4. MCP

Serveur MCP **Streamable HTTP** sur `POST /mcp` (JSON-RPC 2.0). Outils :

| Outil | Arguments | Rôle |
|---|---|---|
| `get_state` | `arena`, `token` | ta faction + l'instantané |
| `list_actions` | — | catalogue des intents |
| `act` | `arena`, `token`, `intent` | joue une action |
| `end_turn` | `arena`, `token` | termine ton tour |
| `get_map` | — | carte statique |

## 5. Intents

`applyIntent` (`src/sim/intents.ts`) est la **seule** porte d'entrée : `attack`, `attackBest`, `build`, `batchBuild`, `raid`, `descent`, `sabotage`, `intercept`, `hitman`, `corrupt`, `upgradeTech`, `proposePact`, `respondOffer`, `breakPact`, `embargo`, `fundContract`, `buyQuarter`, `hireMercenaries`, `buyArmement`, `setAttackRatio`, `setLaunderRatio`, `choose`.

Chaque refus renvoie `{ ok:false, error }` — **jamais** d'exception qui casse la partie.

## 6. Décisions

- **API d'abord, MCP en adaptateur** : l'API HTTP est le contrat ; MCP est une surcouche mince.
- **Tour par tour au rythme des agents** (pas de temps réel) : les LLM pensent en secondes.
- **Sim inchangée** : le `World` est pur et déterministe, il tourne tel quel dans le Durable Object.
- **Snapshot sérialisable** (`World.snapshot()` / `applySnapshot()`), **RNG inclus** → reprise exacte après hibernation.
- **Plan gratuit** : pas d'alarme périodique (ce sont les agents qui déclenchent), snapshot persisté au tour.
