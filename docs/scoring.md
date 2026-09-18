# Scoring — Score final (DealerFront)

> Statut : **v1 (DealerFront)** — réécrit pour le mode cartel (contrôle + blanchiment). Remplace l'ancien score « dealer ».

## Objectif

Calculer un **score final réaliste et transparent** à partir d'événements réellement survenus, et un **récap causal** de fin de partie.

## Règles

### Modèle de calcul

```
Score = Cash_propre × (1 + b_contrôle + b_diversité + b_discrétion)
        − pénalités (police subie, quartiers perdus)
```

- **Base = Cash propre blanchi** (seul l'argent effectivement blanchi compte).
- **`b_contrôle`** : bonus lié à la part de quartiers contrôlés en fin de partie (jusqu'à +30 %).
- **`b_diversité`** : bonus pour la variété des quartiers/façades exploités (jusqu'à +10 %).
- **`b_discrétion`** : bonus pour avoir maintenu la **Pression police** basse (jusqu'à +20 %).
- **Pénalités** : saisies policières (Cash propre perdu), quartiers perdus en fin de partie.

### Composantes

| Composante | Rôle | Détail |
|---|---|---|
| **Cash propre** | Base du score | Argent blanchi effectivement. |
| **Contrôle final** | Bonus principal | Part des 256 quartiers contrôlés (objectif de victoire). |
| **Diversité** | Bonus modéré | Nb de quartiers/façades distincts exploités. |
| **Discrétion** | Bonus | Temps passé sous les seuils de Pression police. |
| **Pénalités** | Malus | Saisies, quartiers perdus. |
| **Violence** | Malus | Éliminations de gangs (voir ci-dessous). |

### Violence

- Dans le mode DealerFront, la violence passe par les **bagarres** et les **tueurs à gage**.
- Les **éliminations de gangs** (factions réduites à 0) pèsent négativement (multiplicateur), de façon **traçable**.
- Un run « propre » (aucune élimination) doit pouvoir **surclasser** un run plus riche mais violent.

### Backend traçable

- Chaque événement (capture, construction, blanchiment, raid, corruption, élimination) est **loggé** avec sa **cause systémique**.
- Le **récap** détaille la **chaîne causale** (pourquoi la Pression a monté, quel quartier a basculé), cohérent avec R6.
- **Aucun arrondi « gamifié »**.

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Base | Cash propre | fixé |
| `b_contrôle` | 0 → +30 % | à équilibrer |
| `b_diversité` | 0 → +10 % | à équilibrer |
| `b_discrétion` | 0 → +20 % | à équilibrer |
| Multiplicateur éliminations | négatif fort (coefficients TBD) | TBD |
| Pénalité de saisie police | **TBD** | TBD |
| Seuils de Pression basse (discrétion) | **TBD** (`police-ai.md`) | TBD |

## Cas limites

- **Match nul / fin simultanée** : départage déterministe (ex. contrôle, puis Cash propre, puis ordre de faction) — `win-conditions.md`.
- **Éliminé tôt** : score figé à l'état d'élimination, récap affiché.
- **Cash propre énorme mais 0 contrôle** : le bonus de contrôle ne peut pas compenser la défaite (la victoire exige les deux).
- **Aucune composante ne dépend de la difficulté de base** (équité).

## Dépendances

- `pillars.md` — R1/R2/R3/R6.
- `core-loop.md`, `territory.md`, `economy.md`, `combat.md`, `police-ai.md`, `win-conditions.md`.
- `ui-ux.md` — présentation du récap.

## Critères de validation

- [ ] Le score est intégralement dérivable du log d'événements.
- [ ] Un run sans élimination surclasse un run violent plus riche (test de scénario).
- [ ] Le récap explique la cause de la fin en une phrase compréhensible.
- [ ] Aucune composante ne dépend de la difficulté de base.

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Base | Cash propre |
| 2 | Bonus | Contrôle (+30 %), diversité (+10 %), discrétion (+20 %) |
| 3 | Violence | Éliminations = malus traçable |
| 4 | Backend | Log causal individuel, récap sans arrondi |

---

## Implémentation (P6) — formule en vigueur

> Section **faisant foi** pour `World.score` / `World.rankings` (`src/sim/world.ts`).

```
score = max(0, Cash_propre × (1 + b_contrôle + b_diversité + b_discrétion) × violence − pénalités)
```

| Terme | Valeur |
|---|---|
| `b_contrôle` | `0,30 × min(1 ; contrôle / 0,60)` |
| `b_diversité` | `0,10 × (types de bâtiments présents / 8)` |
| `b_discrétion` | `0,20 × (1 − Pression police / 100)` |
| `violence` | `1 − min(0,5 ; 0,15 × éliminations)` |
| `pénalités` | `saisies × 50 000 + quartiers perdus × 5 000` |

- Faction **éliminée** → score **0**.
- **Classement** (départages déterministes) : score → Cash propre → contrôle → id.
- Le récap expose score et rang (`World.summary()`), affichés par `App.tsx`.
