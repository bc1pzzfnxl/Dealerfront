# Art Direction — Functional B&W + faction colors (DealerFront)

> Status: **v1 (DealerFront)** — adds **faction colors** (possession information) while keeping the brutalist B&W.

## Objective

Fix the art direction: city in **grayscale** (brutalist, chamfered), and **strictly informative color** — now used for **faction possession** and alerts.

## Rules

- The **terrain and buildings** stay **gray** (no decorative color).
- **Color is information**: faction possession, alerts, functional signals.
- **A single active hue per element** (no overlapping meanings).
- Style: **chamfered low-poly**, concrete masses, softened edges (brutalist spirit).

### Grayscale (environment)

Same as the previous mode: 9 steps from `#0E1013` → `#F2F4F7`, high contrast, cool grays.

### Functional colors

| Element | Treatment | Meaning |
|---|---|---|
| **Faction possession** | Colored **translucent** fill + crisp outline on quarters | Quarter owner |
| **Player** | Player faction color, more pronounced outline | "you" |
| **Neutral quarter** | Gray (no fill) | Unowned |
| **Control** | More or less opaque fill depending on Control (0–100) | Possession durability |
| **Police / raid** | **Red** reserved for alert/raid | Immediate danger |
| **Police Pressure** | Progressive mood (vignette/tint) | Rising tension |
| **Pact / traitor** | Dedicated marker (icon/outline) | Diplomatic status |

### Faction palette (6)

Proposed (to refine in the art phase), **also distinct in grayscale** (different values):

| # | Name | Hex (indicative) | Equivalent gray |
|---|---|---|---|
| 1 | Player | `#6FB7E8` (blue) | light |
| 2 | Gang A | `#E0A030` (amber) | light-medium |
| 3 | Gang B | `#7FD08A` (green) | medium |
| 4 | Gang C | `#A97BD8` (purple) | medium-dark |
| 5 | Gang D | `#E23B2E` (red) | dark |
| 6 | Gang E | `#2FB0A0` (turquoise) | medium |

- The fills are **translucent** (≈ 35%) + **opaque outline** to remain readable over the B&W.
- **Colorblind mode**: add a **pattern** (hatching/dots) per faction, since color is not enough.

### Shading

- 3 tones + cast shadows, low ambient / strong directional (sharp contrast, brutalist).

## Numeric parameters

| Parameter | Value | Status |
|---|---|---|
| Grayscale | 9 steps `#0E1013`→`#F2F4F7` | fixed |
| Possession fill | ~35% opacity + 1–2 px outline | to balance |
| Faction palette | 6 colors (above) | to refine |
| Colorblind pattern | 6 distinct patterns | to define |
| Police pressure mood | vignette opacity ∝ Pressure | to balance |

## Edge cases

- **Contested quarter**: fill = owner, outline = attacker (do not mix).
- **Crowd of factions**: beyond 6, provide variants (hue + pattern).
- **B&W readability**: test in grayscale alone — possession must remain distinguishable (via values/patterns).
- **Police color (red) vs red faction**: if a faction is red, reserve a variant (desaturated red) or a pattern for the police.

## Dependencies

- `pillars.md` — P6/R5.
- `ui-ux.md` — overlays, legend, colorblind mode.
- `territory.md` / `factions.md` — possession and statuses.

## Validation criteria

- [ ] No purely decorative color.
- [ ] Possession is readable (color + outline) without hiding the terrain.
- [ ] The 6 factions are distinguishable in B&W (values/patterns).
- [ ] The police/alert remains visually prioritized.

## Decisions made (log)

| # | Question | Decision |
|---|---|---|
| 1 | Color | informative (faction possession) |
| 2 | Fill | translucent + outline, opacity ∝ Control |
| 3 | Factions | 6 colors + patterns (colorblind) |
| 4 | Red | reserved for police/alert |
| 5 | Style | chamfered brutalist kept |

---

## Implementation (P7) — state in force

> **Authoritative** section for `src/render/*` and `src/styles.css`.

- **Environment**: city in chamfered grayscale (`CityMeshes`, `palette.ts`, 9 gray steps).
- **Possession**: translucent colored fill (opacity 0.5), **darkened according to Control** (`0.45 + 0.55 × control`).
- **Attack outline**: square ring in the **attacker's color** (contested quarter: fill = owner, outline = attacker).
- **Building icons**: 8 shapes (box / cylinder / cone / octahedron) + 8 gray values → readable without color.
- **Red**: reserved for **alerts** (attack outlines on the minimap, vignette on alert).
- **Police Pressure**: ambience vignette (amber tint) with opacity ∝ Pressure; **pulsing red** on alert.
- **Colorblind mode**: replaces hues with **distinct gray values** + **symbols** (`FACTION_SYMBOLS`).

### Deviations from the target

- **Patterns** (hatching/dots) not implemented: colorblind mode relies on **value + symbol**.
- Red variant if a faction is red: **not handled** (the red faction stays `#E23B2E`).

---

## Implementation (P16) — pastel, color code and animations

- **Factions**: **pastel** palette (`#8FC7E8`, `#E8C57A`, `#8FD8A5`, `#B79DE0`, `#E88C80`, `#6FD0C4`) on the map, the minimap and the UI badges.
- **Cartel buildings colored by type** (`BUILDING_COLORS`): Lab green, Storefront amber, Front pink, Safehouse lilac, Depot beige, Workshop sky blue, Counter-intel powder red, Recruitment blue-gray. The **shape** remains distinct (cylinder/cone/octahedron…).
- **Quarter grid**: discreet outline on each module → the city structure is readable.
- **Borders**: thick colored outline where two owners touch (OpenFront style).
- **Animations**: **siege** outline pulsing (attacker color), **flash** on capture, build-site **growth** then **pop** on building delivery.
- **City**: soft gray, silhouettes per zone (stands, signs, neon, chimneys).

---

## Implementation (P25) — Icon system

- **Single source**: `lucide-react` (ISC, already installed), `currentColor` strokes — color comes from the faction or the state, never from decoration (R5).
- **One action = one logo**: every action button carries an icon, **never text alone**.
- Faction symbols (`●■▲◆`) remain, complemented by color; **colorblind mode** keeps gray + symbol.
