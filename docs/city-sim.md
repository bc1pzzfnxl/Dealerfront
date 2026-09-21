# City Sim — The city as a living system

> Status: **refined (v2)** — day/night cycle (2 cycles), densities, witnesses, double camouflage and extended event pool decided.

## Objective

Describe the city as a **simulation** generating context and risk: civilian flows, zone types, density/camouflage and dynamic urban events. These elements are not decorative: they modulate detection, opportunity and Heat.

## Rules

### Day/night cycle — two cycles

- The 30-min run has **two day/night cycles** (≈ **15 min per cycle**).
- Civilian density per zone **varies by cycle** (see scale).
- Camouflage and danger readability evolve with the hour; night favors some zones (nightlife) and empties others (residential, university).

### Civilian density per zone (contrasted scale)

| Zone | Day density | Night density |
|---|---|---|
| Commercial / nightlife | 80 | 95 |
| Commercial (offices) | 75 | 50 |
| University / student | 70 | 20 |
| Residential | 40 | 30 |
| Park / buffer zones | 30 | 20 |
| Industrial | 15 | 10 |

*(Values 0–100, to balance.)*

### Density = camouflage (double effect)

Density acts in **two simultaneous ways**:

1. **Reduces suspicion rise** — you blend into the crowd: `suspicion rise × (1 − density / 150)` (coefficient **TBD**).
2. **Reduces the effective sight range of patrols** — `range` covers the quarter and its neighbors.

An empty street therefore exposes you more (little camouflage **and** patrols that see far).

### Civilian witnessing

- **Probabilistic**, at **local range (quarter + neighbors)**.
- Probability **∝ zone density** **and visibility of the player's action**.
- **Hiding** greatly reduces the probability; a **committing action** (sales, laundering) increases it (**increased risk while acting**).
- A witness who reports generates: **+police Pressure** (see `police-ai.md`) **and** an **approximate position** (`police-ai.md`, cross-referencing).

### Dynamic urban events

- **Frequency**: **1 to 3 per run**, weighted by phase (`core-loop.md`) — more frequent in the Alert phase.
- **Systemic causes**, never scripted on player progression (R3): drawn according to the city and the current state.
- **Proposed pool (extended MVP)**:

| Event | System effect |
|---|---|
| **Road check** | Mobile checkpoint on an axis; checks the product being transported. |
| **Protest** | Blocks a street **but distracts the police** (double risk/opportunity effect). |
| **Event crowd** | Empties or heavily fills a zone (density, profit, witnesses). |
| **Traffic jam / roadwork** | Blocks or slows an axis (lengthens trips). |
| **Power outage** (night) | Reduces visibility: increased camouflage, less effective patrols. |
| **Localized sweep** | Targeted bust on a zone (high one-off danger). |
| **Private party / festival** | Boosts density + profit + police in a zone. |
| **Alarm / incident** | Attracts police **and** civilians to a point (diverts attention). |

> The exact pool and draw weights are **to refine** (`open-questions.md`).

## Numeric parameters

| Parameter | Value | Status |
|---|---|---|
| Number of day/night cycles | 2 over 30 min (≈ 15 min/cycle) | fixed |
| Densities per zone (day/night) | see scale above | to balance |
| Density effect on suspicion rise | × (1 − density/150) | to balance |
| Density effect on sight range | × (1 − density/300) | to balance |
| Civilian witness range | quarter + neighbors | fixed |
| Witness probability | ∝ density × action visibility | **TBD** (coefficients) |
| Event frequency | 1–3 / run, weighted by phase | fixed |
| Event pool | 8 types (see table) | to refine |
| Event draw weights | **TBD** | TBD |

### Zone types

| Zone | Purpose | Characteristic |
|---|---|---|
| Residential | Regular customers | Low Heat, low profit |
| Commercial / nightlife | High profit, high traffic | Frequent patrols |
| Industrial | Good for labs | Few civilians, suspicious isolation if too much movement |
| Park / buffer zones | Transition | — |
| Police station | Police base | Source of patrols, structural danger |
| Laundering front | Laundering (bar, laundromat…) | Conversion infrastructure |
| Vacant lot / open square | Urban breathing room, open space | Passable, no buildings |

## Edge cases

- **Protest**: blocks a street **but distracts the police** (risk vs opportunity to document).
- **Empty zone** (night): camouflage drops in a readable way, without making the run unplayable.
- **Event on a critical zone** (e.g. front): behavior to define → **TBD** (event deferral vs effect applied).
- **Civilians during a committing action**: the witness risk increases; the action remains non-interruptible (tension).
- **Two camouflage effects**: verify they do not stack excessively in a very dense zone (risk of a "too safe" zone).
- **Power outage**: must not totally cancel the police threat (otherwise an exploit).

## Dependencies

- `pillars.md` — R3 (systemic events, not scripted), R4 (readability).
- `police-ai.md` — the city (witnesses, crowds) feeds **police Pressure**.
- `police-ai.md` — events and density modulate suspicion/sight range; witnesses give an approximate position.
- `procgen.md` — the city and `H_base` are produced by generation.
- `factions.md` — agents live according to the day/night cycle.
- `art-direction.md` — density/camouflage readable in B&W.

## Validation criteria

- [ ] Camouflage visibly depends on density (double effect verified).
- [ ] The two day/night cycles perceptibly change densities and danger.
- [ ] An urban event has a traceable, non-scripted system effect.
- [ ] Each zone type has a distinct, recognizable risk/opportunity profile.
- [ ] No event is tied to player progression (non-scripting audit).

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Day/night cycle | 2 cycles (≈ 15 min/cycle) |
| 2 | Densities per zone | Contrasted scale (day/night) |
| 3 | Civilian witnessing | Probabilistic, short range (~4 tiles) |
| 4 | Civilians & actions | Increased witness risk during a committing action |
| 5 | Event frequency | 1–3 / run, weighted by phase |
| 6 | Event types | 8 types (3 from the GDD + 5 added) |
| 7 | Camouflage effect | Double: reduces suspicion **and** sight range |
| 8 | Witnesses (base impl.) | Spawn ~0.4%/tick × exposure (×3 while acting), cooldown 6 s, max 4; **speed 2.6 tiles/s**; reaches the station → +4 local Heat + patrol suspicion |
