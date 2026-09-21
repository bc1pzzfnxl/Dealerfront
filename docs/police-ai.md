# Police — Anti-leader faction and corruption

> Status: **v2 (DealerFront)** — full rewrite.
> The old "patrols / suspicion / single dealer" version is **obsolete** in cartel mode and **abandoned**.

## Objective

Define the **police** as a **non-playable opposing faction**, **anti-leader (anti-snowball)**: its **Pressure** rises with the **leader's control** share and **accumulated Heat**. It punishes domination to rebalance the game, while remaining **corruptible** — an economic lever for the player.

## Rules

### Role

- **Non-playable** faction, acting as a **counter-power**. It does not try to win: it **strikes the dominant cartel**.
- **Primary target** = the faction with the highest **Control** (the **leader**), weighted by its accumulated **Heat**. Non-leader factions are largely spared (to balance).
- **Pure causality** (R3): every Pressure increase is **traceable** to an in-game event (control gained, Heat, crime).

### Pressure

- **Pressure `P_p` ∈ [0, 100]**, specific to the police. It rises with:
  - the **leader's control share** (∝ dominant faction control / total control);
  - accumulated **criminal activity** (ex-Heat);
  - **visible crimes** (victims, captures, betrayals).
- Principle formula (**to balance**): `dP_p/dt = a × (leader_control / total_control) + b × Heat + c × crimes − decay`.
- **Decay**: if the leader **loses the lead**, or with no recent activity, `P_p` **falls** slowly (symmetric anti-snowball). Rate **to balance**.
- **Anti-rubber-banding**: Pressure does **not** depend on the player's performance as a person, but on **in-game facts** (control, Heat) — R1 respected.

### Effects (tiers)

| Tier | `P_p` | Effect |
|---|---|---|
| **PA** | 0–39 | Surveillance — tense mood, visible patrols |
| **PB** | 40–69 | **Targeted raid** — removes Control from one leader quarter |
| **PC** | 70–89 | **Multiple raid** — several quarters + **seizure** of Clean cash |
| **PD** | 90–100 | **Liquidation** — player failure (`win-conditions.md`) |

- **Raids**: remove **Control** from one/several leader quarters and can **destroy buildings**. Cooldown between raids **to balance**.
- **Seizures**: loss of **Clean cash** proportional to the tier (**to balance**).
- **Liquidation**: session ends in failure; the police do not push beyond.

### Corruption

- **Spending Dirty or Clean cash** → **reduces Pressure**. The **corrupt contact** (`factions.md`) acts as an intermediary.
- **Risk**: the contact can **get burned** (event); the channel closes and/or Pressure rises. Probability **to balance**.
- **Economic dependency**: corrupting is expensive and **scales badly** (increasing cost, to balance) → no purchasable permanent immunity.
- Corruption is **per faction**: the player protects their cartel, not the AI gangs (except via pacts).

### Readability

- **Pressure** must be **visible**: indicator/mood (color, siren frequency, patrol density; `ui-ux.md`, `art-direction.md`).
- It must be **causal and auditable**: every increase is explainable by a displayable event (control, Heat, raid, crime).

## Numeric parameters

| Parameter | Value | Status |
|---|---|---|
| Pressure scale `P_p` | 0–100 | fixed |
| Leader control contribution | `a` (to define) | to balance |
| Heat contribution | `b` (to define) | to balance |
| Crime contribution | `c` (to define) | to balance |
| Pressure decay | slow (**TBD**) | to balance |
| Targeted raid threshold (PB) | 40 | to balance |
| Multiple raid + seizure threshold (PC) | 70 | to balance |
| Liquidation threshold (PD) | 90–100 | to balance |
| Control removed per raid | **TBD** | to balance |
| Cooldown between raids | **TBD** | to balance |
| Clean cash loss (seizure) | ∝ tier, **TBD** | to balance |
| Corruption cost | increasing, **TBD** | to balance |
| Pressure reduction per corruption | **TBD** | to balance |
| Risk that the contact gets burned | **TBD** | to balance |
| Non-leader targeting weight | low, **TBD** | to balance |

## Edge cases

- **Leader losing the lead**: `P_p` **falls** (decay); the police shift targeting to the new leader.
- **Corruption bought twice**: a second corruption during the active window **does not stack** (diminishing returns or ignored) — **TBD**.
- **Raid during a brawl**: a raid can hit a quarter mid-conquest; it **benefits** the attackers (distribution of the removed Control **to decide**).
- **Non-leader player**: they suffer little Pressure but are still targeted by the Heat they generate.
- **Liquidation of an AI leader**: the police can eliminate a dominant AI gang; the player takes over the territory (causality, no scripted gift).
- **Session end (20–30 min)**: if the duration ends before `P_p = 100`, the police do not end the game; the score / `win-conditions.md` decides.

## Dependencies

- `win-conditions.md` — liquidation, session end, victory.
- `factions.md` — leader, control, corrupt contact, agents.
- `territory.md` — quarters and Control removed by raids.
- `economy.md` — Clean cash seized, corruption costs.
- `territory.md` — the leader's control feeds Pressure.
- `ui-ux.md` / `art-direction.md` — Pressure readability (diegetic, B&W).

## Validation criteria

- [ ] The police target the **leader** (faction with the highest Control) and not the player in particular.
- [ ] Every Pressure increase is traceable to an in-game event (R3 audit, R1 anti-rubber-banding).
- [ ] A raid **removes Control** and can **destroy buildings**; a seizure removes Clean cash.
- [ ] Corruption **reduces** Pressure without ever guaranteeing immunity (risk + increasing cost).
- [ ] The corrupt contact can **get burned** (event), with a visible consequence.
- [ ] Pressure is **readable** without knowing the numbers (mood/indicator).
- [ ] A session can end in liquidation if the player stays leader too long.

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Police role | Non-playable anti-leader faction (anti-snowball) |
| 2 | Targeting | Faction with the highest Control, weighted by Heat |
| 3 | Pressure | Variable 0–100, rise ∝ leader control + Heat + crimes |
| 4 | Decay | If the leader loses the lead |
| 5 | Effects | Raids (Control/buildings), seizures (Clean cash), liquidation |
| 6 | Tiers | 40 (targeted raid) / 70 (multiple raid + seizure) / 90–100 (liquidation) |
| 7 | Corruption | Dirty/clean cash → −Pressure, increasing cost, risk of the contact getting burned |
| 8 | Readability | Diegetic indicator/mood, auditable causality |
| 9 | Old version | "Patrols/suspicion/single dealer" abandoned |
| 10 | Session end | The police do not end it before liquidation; the score decides otherwise |
| 11 | Local police | **Heat per quarter** (0–100): +capture 30, +strike 20, +operation 15, +storefront 0.15×demand, +front 0.08×wealth; decay **proportional to heat** `0.08 × (1 + heat/30)` (a hot quarter cools faster → equilibrium below 100: demand 1 ≈ 26, demand 2 ≈ 82), ×3 in zones under **police surveillance**. **Raids target the leader's hottest quarters** and **destroy their building**. **Corruption cools** the cartel's quarters (heat ÷2). |

---

## Implementation (P5) — values in force

> **Authoritative** section for `src/sim/police.ts` and `src/sim/world.ts`. The police are **abstract** (not a faction on the map); they target the **leader**.

### Pressure (per tick)

- `excess = max(0; leader's map share − 1/nb factions)` (map share = leader's quarters / 256).
- `ΔP = 0.02 × excess + 0.0015 × crime − 0.002` (`−0.02` extra if corruption is active).
- **Domination floor**: `P ≥ excess × 200` — corruption buys a reprieve, **never immunity**.
- **Crime**: `+1` per capture, decays `× 0.985`/tick.
- Unlike the target, the rise uses the **map share** (not the share of control held among factions).

### Tiers and effects

| Tier | `P` | Effect |
|---|---|---|
| Surveillance | 0–39 | Mood (HUD) |
| **Targeted raid** | 40–69 | 1 leader quarter: **−25 Control**, building **destroyed** |
| **Multiple raid + seizure** | 70–89 | 3 quarters + **seizure of 10% of Clean cash** |
| **Liquidation** | ≥ 95 | Player → **defeat**; AI gang → quarters returned to **neutral**, `P` drops to 70 |

- **Raid cooldown**: **600 ticks (1 min)**.

### Corruption

- Cost **Clean cash**: `3000 × 1.8^purchases`, capped at **1,000,000** (scales badly).
- Effect: **−20 Pressure**, window **150 ticks** (−0.02/tick).
- **Risk**: 15% chance to **burn the contact** → **+10 Pressure** (the cost is still paid).
- The **AI** also corrupts (targeted leader, `P ≥ 70`).

### Deviations from the target

- No "corrupt contact" entity and no diegetic readability (sirens/patrols) — HUD only for now.
- The police do not capture quarters: they only remove Control.
- Non-leader targeting weight: **none** (the leader is targeted strictly).

### Balancing (massive simulation)

At **20 APM** (~28 min, 100 seeds): **98 wins / 2 losses**, final Pressure ~71, ~21 raids/game.
At 30 APM (~10 min): 99 wins / 1 loss, ~6 raids/game. The police weigh in without deciding.

### Named contact (P12)

- The corrupt contact has a **name** (deterministic per seed). If they are **burned**, a **new contact** takes over and Pressure rises by 10.
