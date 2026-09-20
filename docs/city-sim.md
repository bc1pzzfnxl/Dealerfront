# City Sim — La ville comme système vivant

> Statut : **affiné (v2)** — cycle jour/nuit (2 cycles), densités, témoins, camouflage double et pool d'événements étendu tranchés.

## Objectif

Décrire la ville comme une **simulation** génératrice de contexte et de risque : flux de civils, types de zones, densité/camouflage et événements urbains dynamiques. Ces éléments ne sont pas décoratifs : ils modulent la détection, l'opportunité et la Heat.

## Règles

### Cycle jour/nuit — deux cycles

- Le run de 30 min comporte **deux cycles jour/nuit** (≈ **15 min par cycle**).
- La densité de civils par zone **varie selon le cycle** (voir barème).
- Le camouflage et la lisibilité du danger évoluent avec l'heure ; la nuit favorise certaines zones (night-life) et vide les autres (résidentiel, universitaire).

### Densité de civils par zone (barème contrasté)

| Zone | Densité jour | Densité nuit |
|---|---|---|
| Commercial / night-life | 80 | 95 |
| Commercial (bureaux) | 75 | 50 |
| Universitaire / étudiant | 70 | 20 |
| Résidentiel | 40 | 30 |
| Parc / zones tampons | 30 | 20 |
| Industriel | 15 | 10 |

*(Valeurs 0–100, à équilibrer.)*

### Densité = camouflage (double effet)

La densité agit de **deux façons simultanées** :

1. **Réduit la montée de suspicion** — on se fond dans la foule : `montée de suspicion × (1 − densité / 150)` (coefficient **TBD**).
2. **Réduit la portée de vue effective des patrouilles** — `portée` couvre le quartier et ses voisins.

Une rue vide expose donc davantage (peu de camouflage **et** patrouilles qui voient loin).

### Témoignage civil

- **Probabiliste**, à **portée locale (quartier + voisins)**.
- Probabilité **∝ densité** de la zone **et visibilité de l'action** du joueur.
- **Se planquer** réduit fortement la probabilité ; une **action engageante** (vente, blanchiment) l'augmente (**risque accru en action**).
- Un témoin qui signale génère : **+Pression police** (voir `police-ai.md`) **et** une **position approximative** (`police-ai.md`, recoupement).

### Événements urbains dynamiques

- **Fréquence** : **1 à 3 par run**, pondérée par la phase (`core-loop.md`) — plus fréquents en phase Alerte.
- **Causes systémiques**, jamais scriptées sur la progression du joueur (R3) : tirage selon la ville et l'état courant.
- **Pool proposé (MVP étendu)** :

| Événement | Effet système |
|---|---|
| **Contrôle routier** | Checkpoint mobile sur un axe ; contrôle du produit transporté. |
| **Manifestation** | Bloque une rue **mais distrait la police** (double effet risque/opportunité). |
| **Affluence événementielle** | Vide ou remplit fortement une zone (densité, profit, témoins). |
| **Embouteillage / travaux** | Bloque ou ralentit un axe (rallonge les trajets). |
| **Coupure de courant** (nuit) | Réduit la visibilité : camouflage accru, patrouilles moins efficaces. |
| **Razzia localisée** | Descente ciblée sur une zone (danger ponctuel élevé). |
| **Fête privée / festival** | Boost densité + profit + police dans une zone. |
| **Alarme / incident** | Attire police **et** civils vers un point (détourne l'attention). |

> Le pool exact et les poids de tirage sont **à affiner** (`open-questions.md`).

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Nombre de cycles jour/nuit | 2 sur 30 min (≈ 15 min/cycle) | fixé |
| Densités par zone (jour/nuit) | voir barème ci-dessus | à équilibrer |
| Effet densité sur la montée de suspicion | × (1 − densité/150) | à équilibrer |
| Effet densité sur la portée de vue | × (1 − densité/300) | à équilibrer |
| Portée de témoignage civil | quartier + voisins | fixé |
| Probabilité de témoignage | ∝ densité × visibilité action | **TBD** (coefficients) |
| Fréquence des événements | 1–3 / run, pondérée par phase | fixé |
| Pool d'événements | 8 types (voir tableau) | à affiner |
| Poids de tirage des événements | **TBD** | TBD |

### Types de zones

| Zone | Vocation | Caractéristique |
|---|---|---|
| Résidentiel | Clients réguliers | Faible Heat, faible profit |
| Commercial / night-life | Gros profit, gros passage | Patrouilles fréquentes |
| Industriel | Bon pour les labos | Peu de civils, isolement suspect si trop de mouvement |
| Parc / zones tampons | Transition | — |
| Poste de police | Base police | Source de patrouilles, danger structurel |
| Façade de blanchiment | Blanchiment (bar, laverie…) | Infrastructure de conversion |
| Terrain vague / place ouverte | Respiration urbaine, espace ouvert | Traversable, aucun bâti |

## Cas limites

- **Manifestation** : bloque une rue **mais distrait la police** (risque vs opportunité à documenter).
- **Zone vide** (nuit) : le camouflage chute de façon lisible, sans rendre le run injouable.
- **Événement sur une zone critique** (ex. façade) : comportement à définir → **TBD** (report de l'événement vs effet appliqué).
- **Civils pendant une action engageante** : le risque de témoignage augmente ; l'action reste non interruptible (tension).
- **Deux effets du camouflage** : à vérifier qu'ils ne se cumulent pas de façon excessive en zone très dense (risque de zone « trop safe »).
- **Coupure de courant** : ne doit pas annuler totalement la menace policière (sinon exploit).

## Dépendances

- `pillars.md` — R3 (événements systémiques, pas scriptés), R4 (lisibilité).
- `police-ai.md` — la ville (témoins, affluence) alimente la **Pression police**.
- `police-ai.md` — les événements et la densité modulent suspicion/portée de vue ; les témoins donnent une position approximative.
- `procgen.md` — la ville et `H_base` sont produites par la génération.
- `factions.md` — les agents vivent selon le cycle jour/nuit.
- `art-direction.md` — densité/camouflage lisibles dans le N&B.

## Critères de validation

- [ ] Le camouflage dépend visiblement de la densité (double effet vérifié).
- [ ] Les deux cycles jour/nuit modifient perceptiblement les densités et le danger.
- [ ] Un événement urbain a un effet système traçable et non scénarisé.
- [ ] Chaque type de zone a un profil de risque/opportunité distinct et reconnaissable.
- [ ] Aucun événement n'est lié à la progression du joueur (audit de non-scripting).

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Cycle jour/nuit | 2 cycles (≈ 15 min/cycle) |
| 2 | Densités par zone | Barème contrasté (jour/nuit) |
| 3 | Témoignage civil | Probabiliste, portée courte (~4 tuiles) |
| 4 | Civils & actions | Risque de témoignage accru pendant une action engageante |
| 5 | Fréquence des événements | 1–3 / run, pondérés par phase |
| 6 | Types d'événements | 8 types (3 du GDD + 5 ajoutés) |
| 7 | Effet camouflage | Double : réduit la suspicion **et** la portée de vue |
| 8 | Témoins (impl. base) | Apparition ~0,4 %/tick × exposition (×3 en action), cooldown 6 s, max 4 ; **vitesse 2,6 tuile/s** ; rejoint le poste → +4 Heat locale + suspicion d'une patrouille |
