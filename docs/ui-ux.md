# UI/UX — God-view interface (DealerFront)

> Status: **v1 (DealerFront)** — rewritten for cartel mode: control overlays, faction colors, multi-resource HUD.
> Note: the **solo command HUD** (§ Loop panel, bottom bar, build menus) was removed with solo mode — the client is now arena tables + live spectator only. The map rendering rules below still apply to the spectator.

## Objective

Define a **remote command** interface: read the situation at a glance (possession, control, pressure) and give orders per quarter, **without micro or a character**.

## Rules

### Camera

- **Wide god view**: free camera (pan + zoom), **fixed iso**, significant zoom-out (you see the city). No more tight follow camera.
- Navigation: drag (**pan**), wheel (**zoom**) — handled by MapLibre.

### Reading the map

| Information | Rendering | Forbidden |
|---|---|---|
| **Possession** (faction) | **Colored translucent fill** + outline on quarters, **faction color** (`art-direction.md`) | Decorative color |
| **Quarter Control** | Number 0–100 (or thin gauge) shown on the selected/hovered quarter, fill gradient | — |
| **Buildings** | **Icons** per type (Lab, Storefront, Front, Safehouse, Workshop, Counter-intel, Depot) | — |
| **Neutral** | Gray (no faction fill), garrison shown on hover | — |
| **Police** | Visible stations + **Pressure** indicator; zones under raid in red | — |
| **Alerts** (incoming attack) | Red border + direction, sound | — |

### Command

- **Selection**: quarter click, **drag-rectangle** for multi-select.
- **Contextual order menu**: Attack / Reinforce / Build / Convert / (Hitman) — `command.md`.
- **Preview** before confirming: committed Influence, estimated losses, affected quarters.
- **Global panel**: tech (branches), police corruption, diplomacy (factions), log.

### HUD

- **Resources**: Product, Dirty cash, Clean cash, **Influence** (+ max).
- **Police Pressure** + state.
- **Faction list**: control %, status (pact/embargo/traitor), leader.
- **Milestones**: control % threshold, Clean cash threshold.
- **Log**: recent events (captures, raids, betrayals).
- **Map**: muted basemap, faction fills, selection/heat outlines, convoys.

### Screens (MVP = 3)

| Screen | Content |
|---|---|
| **City selection** | Paris (529 IRIS quarters) |
| **Game view** | God-view map + overlays + HUD + command |
| **End recap** | Score, final control, cause, causal chain |

## Numeric parameters

| Parameter | Value | Status |
|---|---|---|
| Zoom (visible tiles) | wide: ~90–200 | to balance |
| Color per faction | 6 colors (see `art-direction.md`) | fixed |
| Preview | required before attack | fixed |
| Recap duration | **TBD** | TBD |

## Edge cases

- **Color overlap**: a contested quarter must remain readable (outline = attacker, fill = owner).
- **Huge selection**: bound the selection size to preserve readability (`TBD`).
- **Multiple alerts**: prioritize incoming attacks (no visual spam).
- **Colorblind mode**: distinguish factions by **color + pattern/outline** (`art-direction.md`).

## Dependencies

- `pillars.md` — P5/P6, R4/R6.
- `command.md` — orders and preview.
- `territory.md`, `combat.md`, `economy.md`, `tech.md`, `factions.md`, `police-ai.md`.
- `art-direction.md` — faction palette.
- `scoring.md` / `win-conditions.md` — recap.

## Validation criteria

- [ ] Possession and control are readable without opening a menu.
- [ ] You can give a per-quarter and batch order with preview.
- [ ] The HUD is not an unreadable dashboard (clear hierarchy).
- [ ] The recap explains the endgame without external documentation.

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Camera | wide god view (pan/zoom, fixed iso) |
| 2 | Possession | colored fill + outline (color = info) |
| 3 | Command | selection + contextual orders + preview |
| 4 | HUD | resources, pressure, factions, log |
| 5 | Screens | 3 (selection, game, recap) |

---

## Implementation (P7) — state in force

> **Authoritative** section for `src/App.tsx`, `src/render/*`. The map rendering is **mapcn / MapLibre** (`src/render/WorldMap.tsx`).

### Screens (3)

- **City selection**: **Paris** map (529 IRIS quarters) + objective reminder, click = start.
- **Game view**: god-view map + overlays + HUD.
- **End recap**: cause, Clean cash, control, **score + rank**, quarters taken, gangs eliminated, raids/seizures, duration.

### Reading the map

- **Possession**: fill **per faction** (`fill-color` via `feature-state`), **opacity ∝ Control**.
- **Attacked quarter**: **outline** in the **attacker's color** (the strongest), drawn on the map.
- **Buildings**: shown in the Quarter panel (label + effect); the built quarter carries its faction color.
- **Selection**: thick **white** outline. **Local heat**: **orange** outline ∝ heat. **Convoys**: animated dots colored by faction.
- **Police**: **ambience vignette** whose intensity follows Pressure; turns **pulsing red** when the player is targeted and on alert (recent raid or `P ≥ 70`).

### HUD

- **Cartel**: Members, Control, Quarters, Product, Dirty cash, Clean cash, Production, **Objective** (control threshold + Clean cash).
- **Police**: Pressure gauge, tier, target, raids, **Corrupt** button.
- **Factions**: symbol + color, **leader** tag, control %, Clean cash.
- **Log**, **time left**, Pause / New seed / **Colorblind** buttons.

### Colorblind mode

- Toggle: factions switch to **distinct gray values** (no more hue), complemented by a **symbol** per faction in the legend. Preference persisted (`localStorage`).

### Deviations from the target

- **Multi-select** (drag-rectangle) and **numeric preview** before attack: not implemented (click selection).
- **Sound alerts** and **pact/embargo markers**: not implemented (no diplomacy).
- Zoom/pan is handled by MapLibre (drag = camera).

---

## Implementation (P9) — HUD layout (zones, no scroll)

> **Authoritative** section for `src/App.tsx` and `src/styles.css`. The HUD is a **full-screen grid** overlay (`pointer-events` only on the panels); it **does not scroll** in game.

### Triage by zone

| Zone | Content | Role |
|---|---|---|
| **Top bar** (`topbar`) | Brand + map, **resources** (Members, Product, Dirty cash, Clean cash), **Control**, Quarters, Production, **objective** (threshold + Clean cash) and **time left** | Always visible, at-a-glance reading |
| **Left column** (`panel-left`) | Selected **quarter** (profile, logistics, heat) + **orders** (build / attack / raid / bust / interception / strike) | Contextual **action** panel |
| **Right column** (`panel-right`) | **Police** (Pressure, target, raids, corruption), **Tech** (3 branches), **Diplomacy** (relations, pacts, merged factions) | **Steering** panel |
| **Bottom bar** (`panel-bottom`) | **Log** + key reminders + buttons (Pause / New seed / Colorblind) + tick | Mood / control |

### Rules

- The **faction legend merged** with Diplomacy (symbol + color + control % + relation + Pact/Betray action) to remove a panel.
- The **cartel stats** (ex-"Cartel" card) moved into the **top bar**.
- The map controls (zoom) are bottom-right.
- Verified **without scroll** at 1600×900 and 1366×768; `overflow-y: auto` remains as a fallback on the columns if the screen is very small.

---

## Implementation (P10) — player guidance

> Objective: **mechanically simple, tactically deep** — the game suggests, the player decides.

- **Contextual advisor** (top of the left panel): a single instruction, prioritized
  (objective → bootstrap **Lab → Storefront → Front** → empty quarters → expansion → laundering).
- **Recommended building**: the `Q` key and the highlighted button follow the **bootstrap priority**,
  then the **target composition** (`chooseBuildType`) — same rules as the AI.
- **Readable effects**: each building exposes its effect (`BUILDING_EFFECT_LABELS`) in a tooltip and
  under the menu; the developed quarter shows the current effect.
- **Attack preview**: committed Members (20%), Control and target **defense ×N** before confirming.
- **Explicit refusal**: "Not adjacent — choose a neighbor" or "Insufficient Members (min 400)",
  never a silent failure.

### Onboarding (P10)

- **Help** shown on the first game (reopenable via the **Help** button): goal, 4-step economic loop, conquest, police, keys.
- **"Loop" panel** (bottom bar): `Recruitment → Members`, `Lab → Product`, `Storefront → Dirty cash`, `Front → Clean cash`, with counters and the **missing step highlighted**.
- **Advisor** reordered: capture a 2nd quarter → Lab → Storefront → Front → develop → expand → launder; it indicates the **missing resource** when a building is out of reach.
- **Contrast**: secondary text lightened (`--muted`), building cost readable, disabled buttons **readable** (dotted border instead of opacity that crushes the text), cost in amber when funds are short.

---

## Implementation (P14) — Information, vision and intel

> Possession color is no longer universal: information is **limited**.

- **Border vision**: the player knows **their quarters + their neighbors**, plus the radius of the **Counter-intels** they own, plus **scouted** zones.
- **Unknown zone**: **dark gray** fill, no owner, no control, no building, no attack outline; the tooltip shows "Unknown — reconnaissance required".
- **Base color code**: our quarters = **full, bright color**; known but hostile = **discreet**; unknown = **masked**.
- **Intel**:
  - **Reconnoiter** (button on an unknown quarter): costs **1,500 Dirty cash**, reveals a radius-2 square for **60 s**, cooldown **30 s**.
  - **Counter-intel**: permanently reveals a radius of 2 around it (in addition to its anti-hitman effect).

### Diplomacy and information (P15)

- The **Diplomacy** panel **no longer** shows the control % of non-intel rivals: it displays `?` (unknown) or `~X%` (partially known via vision/reconnaissance).

### P16 — return to full information

- The **fog / intel** (P14) is **abandoned**: possession, control and buildings are **visible to all** (OpenFront-style readability). The vision/reconnaissance mechanics have been removed.

---

## Implementation (P25) — Game feel & iconic UI

> Decision: **one action = one visual response**. No player action must remain silent.
> References: OpenFront / Territorial.io (contextual commands, shortcuts, feedback), game feel theory (juice), motion design (Emil/Jakub).

### World juice (map)

- **Capture flash**: blurred white outline on taken quarters (`feature-state.flash`, ~0.7 s), derived from `capturedAt`.
- **Siege**: **animated dotted** outline in the attacker's color on assault targets (`feature-state.siege`).
- **Convoys**: the route (line at 35%) and the moving dot are visible; under `prefers-reduced-motion`, the dot advances in steps.
- **Local heat**: orange outline (unchanged).

### UI

- **Icons (lucide, `currentColor`)**: buildings (Housing=Users, Lab=FlaskConical, Storefront=Store, Front=Landmark, Safehouse=Shield, Depot=Warehouse, Workshop=Factory, Watcher=Eye), resources, operations. No more long labels.
- **Command bar** (left panel, non-owned quarter): icon grid Assault/Raid/Bust/Interception/Strike, **cost + shortcut** shown in the button, unavailability reason in a tooltip.
- **Compact top bar**: resource icons + two **objective bars** (Control, Clean cash); timer in **urgency** under 3 min.
- **Log feed**: 3 colored entries (gain / loss / info) with a short entry animation.
- **City selection**: pitch + visual loop reminder (Produce → Sell → Launder) + single CTA.
- **Recap**: victory (green accent) distinguished from defeat (red).

### Micro-interactions (frequency gate)

- Buttons: `scale(0.97)` on `:active`, 160 ms transitions. **Nothing** on keyboard shortcuts (never animated).
- `prefers-reduced-motion` cuts flash/siege/log/transitions (accessibility, non-optional).

### Multiplayer seeds (no network)

- `World.briefing()`: JSON **serializable** structure (objective, progression, rank) — reusable by a future lobby/share.
- `GameEvent` and `Floater` are pure and serializable (replay/share deferred).
