# Command — Command interface (god view)

> Status: **v1 (DealerFront)** — replaces `orders.md` (orders of a single dealer). You command a **cartel**, not a character.

## Objective

Define **how the player commands from afar**: quarter selection, faction orders, order batches, and abandonment of single-character micro-management.

## Rules

### Principle

- **God view**: you observe the city in a wide view (`ui-ux.md`) and give **faction orders**.
- **No more character**: no individual movement, no dealer order queue, no tight follow camera.
- Orders apply to **one quarter**, a **selection** or a **border**.

### Available orders

| Order | Target | Effect |
|---|---|---|
| **Attack** | Adjacent neutral or enemy quarter | Commits Influence (see `combat.md`) |
| **Reinforce** | Owned quarter | Transfers Influence to restore/increase Control |
| **Build** | Owned quarter | Places a building (Lab, Storefront, Front, Safehouse, Workshop, Counter-intel, Depot) — `economy.md` |
| **Convert** | Existing building | Turns a city building into a cartel building — `economy.md` |
| **Research (tech)** | Global (via Workshop) | Upgrades a branch (Armament/Protection/Logistics) — `tech.md` |
| **Corrupt** | Global | Spends to reduce police Pressure — `police-ai.md` |
| **Diplomacy** | Faction | Propose a pact, embargo — `factions.md` |
| **Heavy strike** | Enemy quarter | Telegraphed area strike (if tech) — `combat.md` |

### Planning

- **Batch orders**: multi-select (drag-rectangle) to attack/build on several quarters.
- **Preview**: before confirming, show the committed Influence, estimated losses and affected quarters.
- **No micro**: the player plans, the simulation executes at a fixed step (10 Hz).

### Abandoned (vs old mode)

- A dealer's individual order queue, personal committing actions, ZQSD keyboard movement, a character inventory. See `pillars.md` (P5 redefined).

## Numeric parameters

| Parameter | Value | Status |
|---|---|---|
| Max selection size | **TBD** | TBD |
| Order cooldown (anti-spam) | **TBD** | TBD |
| Number of simultaneous orders | **TBD** | TBD |
| Preview (losses/cost) | required | fixed |

## Edge cases

- **Impossible order** (non-adjacent / no longer owned quarter): rejected with feedback, no silent queueing.
- **Attack without enough Influence**: rejected or limited to available Influence (to decide → `TBD`).
- **Replanning**: no cost (we are in god view); avoid spam via cooldowns.
- **Mixed selection** (owned + enemy): each quarter receives the relevant order, invalid ones are ignored.

## Dependencies

- `pillars.md` — P5 (command), R1.
- `territory.md`, `combat.md`, `economy.md`, `tech.md`, `factions.md`, `police-ai.md`.
- `ui-ux.md` — presentation of orders and preview.

## Validation criteria

- [ ] All loop orders (`core-loop.md`) are accessible without a character.
- [ ] Batch orders work (multi-select).
- [ ] The impossible order is cleanly rejected.
- [ ] No action depends on individual character control.

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Model | Faction orders per quarter/selection |
| 2 | Micro | Removed (god view) |
| 3 | Planning | Batches + preview (cost/losses) |
| 4 | Old `orders.md` | Replaced by this file |
