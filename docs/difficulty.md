# Difficulty — Philosophy, O/D formulas and difficulty budget

> Status: **obsolete (v2, old mode)** — balancing is now done by massive simulation (`sim:mass`) on the Paris map.

## Objective

Fix the **difficulty philosophy** (non-negotiable), the **formulas** of the opportunity (O) and danger (D) scores, and the **reference values** translating real criminology data into game parameters compressed over 30 minutes.

## Rules — Philosophy (non-negotiable)

- **No rubber-banding**: the game never adjusts the AI or the rules to compensate for player performance.
- **No meta-progression**: no link between games (no XP, no permanent unlock).
- **Base difficulty random but visible**: set at generation, communicated by directly observing the world (number of visible stations, patrol density) — never by a hidden number or an announced score.
- **Evolving difficulty = pure causality**: every tension increase follows from the player's actions (Heat, witnesses, alerted patrols).

> See `pillars.md` R1–R4.

## O and D score formulas

The scores are computed **at generation**, per map, then aggregated into an `O/D` ratio.

### Opportunity score O (complete)

`O = Σ_z [ Profit_z × ClientDensity_z × Accessibility_z ] + α·N_fronts − β·D_mean(lab → storefronts)`

| Term | Description |
|---|---|
| `Profit_z` | Potential profit of zone `z` (zone/client type). |
| `ClientDensity_z` | Density of potential NPC clients. |
| `Accessibility_z` | Ease of access from the rest of the network. |
| `N_fronts` | Number of available laundering fronts. |
| `D_mean(lab→store)` | Mean distance lab → storefronts (penalizes overly long logistics). |
| `α`, `β` | Weights to balance. |

### Danger score D (complete)

`D = Σ_z [ PatrolCoverage_z + StationProximity_z + WitnessDensity_z ] + γ·Σ_z H_base(z)`

| Term | Description |
|---|---|
| `PatrolCoverage_z` | Base patrol density/coverage. |
| `StationProximity_z` | Proximity and number of police stations. |
| `WitnessDensity_z` | Potential for civilian witnesses (`city-sim.md`). |
| `H_base(z)` | Base danger of the zone (police stations, `police-ai.md`). |
| `γ` | Weight to balance. |

### Target range

- **O/D ratio between 0.90 and 1.10** (variance accepted but limited: no trivial run, no unplayable run).
- Out of range → **automatic correction** (add/remove a patrol, move a station, adjust a profit zone); if the failure persists after **N iterations**, the seed is **regenerated**.
- The ratio is **never recomputed during the game** (R1).

## Numeric parameters — Reference values (grounded in reality)

### Sources used (real criminology, abstracted for the game)

- **Police response time**: in large metropolitan areas, the average for a priority call varies widely — about **5 to 9 min** in the best-equipped cities / most serious incidents, up to **15–20 min** (or more) in under-resourced areas or for less critical calls.
- **Real clearance rate**: a minority of offenses are solved by arrest (on the order of **35–40%** for violent crimes, **~12%** for property offenses). For drugs specifically, the overwhelming majority of arrests concern **simple possession**; sale/manufacture accounts for only a **fraction (~15–16%)** of arrests — organized dealing activity is structurally harder to intercept than visible consumption.

### Detection per action (ranges)

Draw within the range depending on the action:

| Action | Detection (closed case) | Detection (open case) |
|---|---|---|
| Transport / courier movement | 8–10% | 60–70% |
| Sales | 8–15% | 60–85% |
| Laundering (long committing action) | 12–18% *(to balance)* | 70–85% *(to balance)* |

- **Cumulative detection per zone** (`H_L` > threshold 60): gradual growth, never a sharp step **before** the threshold; a **clear step** once the threshold is crossed.

### Reaction times (3 tiers, aligned with `police-ai.md`)

| Structural tier | `H_G` | Reaction time |
|---|---|---|
| P1 — lone agent | 0–29 | 90–150 s |
| P2 — motorized duo | 30–54 | 60–90 s |
| P3 / P4 — reinforced / bust | 55–100 | 15–30 s |

### Target budgets per quarter profile

Each quarter profile (Paris: arrondissement, IRIS type) modulates opportunity and danger around the global range 0.90–1.10:

| Archetype | O/D target | Intention |
|---|---|---|
| Dense city center / nightlife | ≈ 0.95 | Rich but dangerous |
| Residential quarter | ≈ 1.05 | Calm, moderate opportunity |
| Industrial/port zone | ≈ 1.00 | Production/logistics |
| University/student quarter | ≈ 1.00 | Volatile (day/night) |
| Port/border zone | ≈ 0.95 | Risky import, active customs |

### Parameter summary table

| Parameter | Value / range | Status |
|---|---|---|
| Global O/D range | 0.90–1.10 | fixed |
| O/D target | 0.95–1.05 (quarter profiles) | to balance |
| Components of O | profit, client density, accessibility, fronts, lab→storefront distance | fixed |
| Components of D | patrols, stations, witnesses, `H_base` | fixed |
| Weights `α`, `β`, `γ` | **TBD** | TBD |
| Transport detection | 8–10% / 60–70% | to balance |
| Sales detection | 8–15% / 60–85% | GDD |
| Laundering detection | 12–18% / 70–85% | to balance |
| Reaction times | 90–150 / 60–90 / 15–30 s | fixed (3 tiers) |
| Max correction iterations | **N** (e.g. 5) **TBD** | TBD |
| Seed regeneration criterion | failure after N iterations | fixed |

## Edge cases

- **Time compression**: real values are scaled to the session length (30 min); proportionality must remain coherent.
- **Impossible correction**: the map is now **fixed** (Paris) → adjust the **market profiles** rather than regenerating a map.
- **Perception of randomness**: base difficulty must be *readable* before the run (choice among 3 cities, `ui-ux.md`), otherwise it is unfair (R4).
- **Disguised rubber-banding**: any mechanic that "compensates" performance is forbidden, even presented as convenience.
- **Score independent of difficulty**: the final score contains **no** difficulty bonus/malus (otherwise unfair between runs, `scoring.md`).
- **Extreme archetype**: even the richest or calmest remains bounded by the global range.

## Dependencies

- `pillars.md` — R1–R4.
- `procgen.md` — applies the O/D formulas, corrections and regenerations.
- `police-ai.md` — consumes the probabilities and per-tier reaction times.
- `police-ai.md` — Pressure thresholds and base danger.
- `city-sim.md` — client/witness density per zone.
- `scoring.md` — no difficulty bonus/malus.

## Validation criteria

- [ ] No difficulty parameter is recomputed during the run (anti-rubber-banding audit).
- [ ] The probabilities/times are consistent with the real logic described above.
- [ ] Each map's O/D ratio stays within [0.90; 1.10] after correction.
- [ ] Two runs on the same map with the same action sequence give the same result (determinism, aside from choices).
- [ ] Base difficulty is readable without knowing the formulas.

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Components of O | Complete (profit, clients, access, fronts, distance) |
| 2 | Components of D | Complete (patrols, stations, witnesses, `H_base`) |
| 3 | Detection | Ranges per action (transport/sales/laundering) |
| 4 | Reaction times | 3 tiers: 90–150 / 60–90 / 15–30 s |
| 5 | Variance control | Auto-correction then regeneration after N iterations |
| 6 | Budgets | O/D target per quarter profile, within the global range |
