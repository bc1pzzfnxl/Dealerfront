# Factions — AI gangs, diplomacy and agents

> Status: **v1 (DealerFront)** — "cartel" mode in God view, solo vs AI.
> This file **absorbs the old `agents.md`**: autonomous agents become faction gangs/NPCs.

## Objective

Define the **6 factions** of **DealerFront** mode — the player plays **the cartel**, against **5 AI gangs** — as well as **diplomacy** (pacts, requests, embargoes, betrayals) and the **notable agents/NPCs** that populate them. **Battle royale** over **992 quarters** (Paris IRIS), with no time limit, with a balanced **economy ↔ conquest** loop.

Inspirations: **OpenFront** (territory, alliances, traitors) + management (Heat, police). The OpenFront values are cited as a starting point and **to balance**.

## Rules

### Factions

- **6 factions**: the **player** + **5 AI gangs** (`FACTION_COUNT = 6`), battle royale.
- Each faction has: **Influence** (troop resource), **quarters** (IRIS; owner + **Control 0–100**), **buildings** (Lab, Storefront, Front, Safehouse, Workshop, Counter-intel, Depot) and abstract resources (**Product**, **Dirty cash**, **Clean cash**).
- **Spawn**: 4 farthest built quarters (greedy sampling over Paris). Each faction starts on **1 quarter** + starting **Members**.
- **Quarter Control**: 0–100; it is gained/lost through conquest, spent Influence, police raids (`police-ai.md`) and betrayals. A quarter at Control 0 changes owner (`territory.md`).

### Faction AI

- Each AI gang **reuses the agent brain**: **IQ ~N(50, 20)** bounded 10–90, **local perception** (~8 tiles, never the whole map), **routine/agenda**, **fear + loyalty** (0–100), probabilistic errors ∝ (100 − IQ).
- **Objectives** (dynamic priority, to balance):
  1. **Expand onto neutrals** (unowned quarters);
  2. **Launder** (Dirty cash → Clean cash);
  3. **Defend** (reinforce threatened quarters);
  4. **Attack the leader** (faction with the highest Control; anti-snowball shared with the police);
  5. **Honor or betray pacts** according to loyalty/fear and the balance of power.
- **AI difficulty**: variable attack/expansion cadence (OpenFront inspiration — Easy 65–100, Medium 55–70, Hard 45–60, Impossible 30–50 ticks; **to balance**). Neutral tribes: `attackRate = rand(40, 80)` ticks, `triggerRatio 50–60%`, `reserveRatio 30–40%`, `expandRatio 10–20%`, initial troops 10,000 (inspiration, **to balance**).
- **Non-omniscience**: an AI only "knows" through perception/memory/routine; every decision is traceable (R3).

### Diplomacy

- **Pacts / alliances**: default duration **3,000 ticks (5 min; OpenFront inspiration, to balance)**. A **request** waits **200 ticks** (to balance); re-request **cooldown** **300 ticks** (to balance).
- **Embargo**: temporary, **3,000 ticks** (to balance); blocks economic exchanges between factions.
- **Relations**: variable per faction pair. **Attacking** a faction drops the relation by **−60 (Easy) to −100 (Impossible)** (OpenFront inspiration; to balance). Relations condition pact acceptance and targeting.
- **Defection / betrayal**: a faction (AI, or player via their agents) can betray. **Likely betrayal** if **Loyalty < 20 and Fear < 20** (thresholds inherited from the agent brain). The traitor suffers a temporary penalty (**300 ticks**; defense ×0.5, speed ×0.8; OpenFront inspiration, to balance) and a reputation drop.
- **Reputation**: aggregate of relations; it modulates AIs' propensity to pact, to attack a traitor, or to let them get hit by the police.

### Notable agents / NPCs

The **autonomous agents** of the old system become **faction NPCs** (owned by a gang, or independent):

| Role | Function | Interaction | Faction integration |
|---|---|---|---|
| **Dealer** | Moves Product | Serves or scams | Generates Dirty cash for their faction |
| **Watcher** | Watches a quarter | Alerts or informs | Reveals enemy/police movements |
| **Informant** | Provides intel | Informs or gets bought | Sold between factions for payment |
| **Corrupt contact** | Dirty agent | Reduces police Pressure for payment | Useful to all factions (`police-ai.md`) |
| **Rival** | Local competition | Consumes clients/fronts | Can be recruited or eliminated |
| **Hitman** | Targeted violence | Can be hired | Removes an enemy agent/NPC (victims → score) |

- **Population**: **8–12 notable agents** per run (inherited from `agents.md`) spread across factions, + LOD civilians and police (`tech-stack.md`). Exact number **to balance**.
- An agent can **switch sides** if their faction is eliminated or through betrayal.

## Numeric parameters

| Parameter | Value | Status |
|---|---|---|
| Number of factions | 6 (player + 5 AI) | fixed |
| Starting quarters / faction | 1–2 + starting Influence | to balance |
| Spawns | 4 spaced built quarters (greedy) | fixed |
| Spawn immunity | 50 ticks | inspiration, to balance |
| Starting Influence | **TBD** | to balance |
| IQ distribution (AI/agents) | ~N(50, 20) bounded 10–90 | fixed |

| AI errors | probability ∝ (100 − IQ) | fixed (principle) |
| AI attack cadence (Easy/Medium/Hard/Impossible) | 65–100 / 55–70 / 45–60 / 30–50 ticks | inspiration, to balance |
| Neutral tribes — `attackRate` | rand(40, 80) ticks | inspiration, to balance |
| Neutral tribes — `trigger/reserve/expandRatio` | 50–60% / 30–40% / 10–20% | inspiration, to balance |
| Initial troops (neutrals) | 10,000 | inspiration, to balance |
| Pact duration | 3,000 ticks (5 min) | inspiration, to balance |
| Pact request wait | 200 ticks | inspiration, to balance |
| Re-request cooldown | 300 ticks | inspiration, to balance |
| Embargo duration | 3,000 ticks | inspiration, to balance |
| Relation impact (attack) | −60 (Easy) to −100 (Impossible) | inspiration, to balance |
| Betrayal threshold | Loyalty < 20 **and** Fear < 20 | fixed |
| Traitor effect | 300 ticks: defense ×0.5, speed ×0.8 | inspiration, to balance |
| Notable agents / run | 8–12 | fixed |

## Edge cases

- **Eliminated faction**: if it loses all its quarters, its agents become **independent** (recruitable) or join a high-loyalty faction; its pacts are canceled.
- **Alliance breaking**: a betrayal places the traitor under a temporary penalty and drops their reputation; the victims can form an **anti-traitor coalition**.
- **Agent switching sides**: possible if their faction dies, if they betray, or if they are bought; their memory (perception, relations) follows the switch.
- **AI without a quarter**: it tries to **retake neutrals**; with no accessible neutral, it becomes a mercenary (sells its agents) or requests a pact.
- **Pact with the player**: an AI can honor a pact while preparing a betrayal (low loyalty) — always traceable.
- **Snowball**: if a faction reaches a domination threshold, the police (`police-ai.md`) and the remaining AIs **jointly target** the leader.
- **Player last survivor**: the game tends toward victory (`win-conditions.md`) or liquidation by the police.

## Dependencies

- `territory.md` — quarters, owner, Control, conquest.
- `combat.md` — attack resolution, Influence, losses.
- `police-ai.md` — anti-snowball, contact corruption.
- `economy.md` — Product, Dirty cash, Clean cash, buildings, laundering.
- `win-conditions.md` — session end (20–30 min), liquidation.
- `agents.md` — **merged here**; this spec replaces it.
- `core-loop.md` / `scoring.md` — loop and evaluation.
- `ui-ux.md` / `art-direction.md` — faction readability (B&W, diplomacy).

## Validation criteria

- [x] A game concludes by elimination with **6 factions**.
- [ ] Each AI decision is traceable to its perception/memory/routine (R3 audit, no omniscience).
- [ ] Pacts, requests, cooldowns and embargoes behave as specified and are **readable** by the player.
- [ ] A betrayal occurs only with a traceable cause (loyalty < 20 and fear < 20, or solicitation).
- [ ] An agent can switch sides without memory inconsistency.
- [ ] A faction without quarters remains coherent (mercenary work, pact request).
- [ ] Anti-snowball targeting of the leader works without rubber-banding (R1).

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Number of factions | 6 (player + 5 AI gangs) |
| 2 | AI brain | Reuses the agent brain (IQ, perception, routine, fear, loyalty) |
| 3 | Spawn | 4 spaced built quarters, 1 quarter |
| 4 | Influence | Troop resource per faction |
| 5 | Diplomacy | Pacts 3,000 ticks; request 200; cooldown 300; embargo 3,000 |
| 6 | Betrayal | Loyalty < 20 **and** fear < 20; 300-tick penalty |
| 7 | Relations | Attack ∝ difficulty (−60 to −100) |
| 8 | Agents | Merged: roles = faction NPCs |
| 9 | Population | 8–12 notable agents / run |
| 10 | Anti-snowball | Remaining AIs + police target the leader |
| 11 | `agents.md` | Absorbed by this file |

---

## Implementation (P1–P4) — values in force

> **Authoritative** section for `src/sim/factions.ts` and `src/sim/bot.ts`. The diplomacy described above **is not yet implemented** (P5).

- **Number of factions**: `FACTION_COUNT = 6` (player + 5 gangs), battle royale.
- **Names**: the player is the **Cartel**; the AI gangs are named after their **real position** on the map (North/South/East/West + combinations, deduplicated) to avoid any inconsistency between the name and the geography.
- **Colors**: `#6FB7E8`, `#E0A030`, `#7FD08A`, `#A97BD8`, `#E23B2E`, `#2FB0A0` (color = faction information).
- **Starting resources**: Members **3,000**, Dirty cash **2,000** — **identical for all** (AI asymmetry comes from behavior, not the start).
- **AI**: one decision every **25 ticks (2.5 s)**; build / tech / hitman / attack according to `chooseBuildType` (see `economy.md`).
- **Balancing bot**: `bot.ts` (`autoPlay` / `playOut`) — same policy as the AI, with a configurable cadence to simulate a human pace (env `CADENCE`).
- **Diplomacy**: implemented in v1 (see P8 section below). **Notable agents/NPCs** and **variable difficulty**: not implemented.

---

## Implementation (P8) — diplomacy v1

> **Authoritative** section for `src/sim/diplomacy.ts` and `src/sim/world.ts`.

- **Relations**: **symmetric per-pair** matrix, 0–100, initial **60**; **drifts** `+0.02/tick` toward 60 (a war slowly closes).
- **Attacking** a faction: **−25** relation (or **betrayal** if a pact exists).
- **Pacts**: duration **1,500 ticks**, request valid **200 ticks**, re-proposal **cooldown** **300 ticks**, accepted if **relation ≥ 55** and if the proposer is not a runaway (`proposer_quarters ≤ 1.5 × target_quarters + 2`). Allies **do not attack each other**.
- **Betrayal**: attacking an ally (or breaking via the UI) → pact broken, **−50** relation, **300-tick traitor penalty** (defense ×0.5). An ally with relation < 20 can betray (10% probability per decision).
- **Anti-leader coalition**: an AI faction prioritizes a **leader** quarter with probability `leaderFocus × (leader_control − 1/nb_factions)` (`leaderFocus = 0.25`) → **no dogpile at parity**, increasing pressure as a cartel dominates.
- **UI**: **Diplomacy** panel (relation, pact/betray, received offers to accept/decline) + log entries.

### Deviations / not implemented

- **Embargo**: deferred (requires inter-faction economic exchanges, absent).
- **Notable agents / NPCs** (dealer, watcher, informant, corrupt contact, rival, NPC hitman): not implemented (the hitman remains a faction ability, not an agent).
- **Aggregate reputation**: approximated by the per-pair relation; no global reputation.
- **IQ / local perception / fear / loyalty**: the AI brain remains a simple deterministic policy (no bounded perception).

### Balancing (massive simulation, 20 APM, 100 seeds)

With the coalition (`leaderFocus = 0.25`) + diplomacy: **84 wins / 16 losses**, average control **~50%**, ~**24 min**, ~0.1 active pact at endgame. Without the coalition (`leaderFocus = 0`): 93% wins — so it is the **anti-leader targeting** that matters, not the pacts.

### Embargo (P12, player v1)

- The player can **declare an embargo**: duration **3,000 ticks**, **−35% dirty income** for the target, **−40 relation**, **pact forbidden** between the two while it lasts.
- An embargo on an **ally** breaks the pact (**betrayal**). AIs do not declare them (v1).
- **Notable agents/NPCs: abandoned** (decision) — watcher/informant have no role without fog, hitman/corruption/diplomacy already cover the rest. Only the **named corrupt contact** is kept.
