# Police — Faction anti-leader et corruption

> Statut : **v2 (DealerFront)** — réécriture complète.
> L'ancienne version « patrouilles / suspicion / dealer unique » est **obsolète** en mode cartel et **abandonnée**.

## Objectif

Définir la **police** comme une **faction adverse non jouable**, **anti-leader (anti-snowball)** : sa **Pression** monte avec la part de **contrôle du leader** et la **Heat accumulée**. Elle sanctionne la domination pour rééquilibrer la partie, tout en restant **corruptible** — un levier économique pour le joueur.

## Règles

### Rôle

- Faction **non jouable**, agissant comme **contre-pouvoir**. Elle ne cherche pas à gagner : elle **frappe le cartel dominant**.
- **Cible primaire** = la faction au plus fort **Contrôle** (le **leader**), pondérée par sa **Heat** accumulée. Les factions non-leadeuses sont largement épargnées (à équilibrer).
- **Causalité pure** (R3) : toute hausse de Pression est **traçable** à un événement en jeu (contrôle gagné, Heat, crime).

### Pression

- **Pression `P_p` ∈ [0, 100]**, propre à la police. Elle monte avec :
  - la **part de contrôle du leader** (∝ contrôle de la faction dominante / contrôle total) ;
  - l'**activité criminelle** cumulée (ex-Heat) ;
  - les **crimes visibles** (victimes, captures, trahisons).
- Formule de principe (**à équilibrer**) : `dP_p/dt = a × (contrôle_leader / contrôle_total) + b × Heat + c × crimes − décroissance`.
- **Décroissance** : si le leader **perd le lead**, ou sans activité récente, `P_p` **redescend** lentement (anti-snowball symétrique). Taux **à équilibrer**.
- **Anti-rubber-banding** : la Pression ne dépend **pas** de la performance du joueur en tant que personne, mais de **faits en jeu** (contrôle, Heat) — R1 respecté.

### Effets (paliers)

| Palier | `P_p` | Effet |
|---|---|---|
| **PA** | 0–39 | Surveillance — ambiance tendue, patrouilles visibles |
| **PB** | 40–69 | **Raid ciblé** — retire du Contrôle sur un quartier du leader |
| **PC** | 70–89 | **Raid multiple** — plusieurs quartiers + **saisie** de Cash propre |
| **PD** | 90–100 | **Liquidation** — échec du joueur (`win-conditions.md`) |

- **Raids** : retirent du **Contrôle** sur un/des quartiers du leader et peuvent **détruire des bâtiments**. Cooldown entre raids **à équilibrer**.
- **Saisies** : perte de **Cash propre** proportionnelle au palier (**à équilibrer**).
- **Liquidation** : fin de session sur échec ; la police ne s'acharne pas au-delà.

### Corruption

- **Dépenser du Cash sale ou propre** → **réduit la Pression**. Le **contact corrompu** (`factions.md`) sert d'intermédiaire.
- **Risque** : le contact peut **sauter** (événement) ; le canal se referme et/ou la Pression remonte. Probabilité **à équilibrer**.
- **Dépendance économique** : corrompre coûte cher et **scale mal** (coût croissant, à équilibrer) → pas d'immunité permanente achetable.
- La corruption est **par faction** : le joueur protège son cartel, pas les gangs IA (sauf via pactes).

### Lisibilité

- La **Pression** doit être **visible** : indicateur/ambiance (couleur, fréquence des sirènes, densité de patrouilles ; `ui-ux.md`, `art-direction.md`).
- Elle doit être **causale et auditable** : toute hausse est explicable par un événement affichable (contrôle, Heat, raid, crime).

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Échelle de Pression `P_p` | 0–100 | fixé |
| Contribution du contrôle du leader | `a` (à définir) | à équilibrer |
| Contribution de la Heat | `b` (à définir) | à équilibrer |
| Contribution des crimes | `c` (à définir) | à équilibrer |
| Décroissance de la Pression | lente (**TBD**) | à équilibrer |
| Seuil raid ciblé (PB) | 40 | à équilibrer |
| Seuil raid multiple + saisie (PC) | 70 | à équilibrer |
| Seuil liquidation (PD) | 90–100 | à équilibrer |
| Contrôle retiré par raid | **TBD** | à équilibrer |
| Cooldown entre raids | **TBD** | à équilibrer |
| Perte de Cash propre (saisie) | ∝ palier, **TBD** | à équilibrer |
| Coût de corruption | croissant, **TBD** | à équilibrer |
| Réduction de Pression par corruption | **TBD** | à équilibrer |
| Risque que le contact saute | **TBD** | à équilibrer |
| Pondération de ciblage des non-leadeurs | faible, **TBD** | à équilibrer |

## Cas limites

- **Leader qui perd le lead** : `P_p` **baisse** (décroissance) ; la police reporte son ciblage sur le nouveau leader.
- **Corruption achetée en double** : une seconde corruption pendant la fenêtre active **ne cumule pas** (rendement décroissant ou ignorée) — **TBD**.
- **Raid pendant une bagarre** : un raid peut toucher un quartier en pleine conquête ; il **profite** aux attaquants (répartition du Contrôle retiré **à trancher**).
- **Joueur non-leader** : il subit peu de Pression mais reste ciblé par la Heat qu'il génère.
- **Liquidation d'un leader IA** : la police peut éliminer un gang IA dominant ; le joueur récupère le terrain (causalité, pas de cadeau scripté).
- **Fin de session (20–30 min)** : si la durée s'achève avant `P_p = 100`, la police ne termine pas la partie ; le score / `win-conditions.md` tranche.

## Dépendances

- `win-conditions.md` — liquidation, fin de session, victoire.
- `factions.md` — leader, contrôle, contact corrompu, agents.
- `territory.md` — quartiers et Contrôle retiré par raids.
- `economy.md` — Cash propre saisi, coûts de corruption.
- `territory.md` — le contrôle du leader alimente la Pression.
- `ui-ux.md` / `art-direction.md` — lisibilité de la Pression (diégétique, N&B).

## Critères de validation

- [ ] La police cible le **leader** (faction au plus fort Contrôle) et non le joueur en particulier.
- [ ] Toute hausse de Pression est traçable à un événement en jeu (audit R3, anti-rubber-banding R1).
- [ ] Un raid **retire du Contrôle** et peut **détruire des bâtiments** ; une saisie retire du Cash propre.
- [ ] La corruption **réduit** la Pression sans jamais garantir l'immunité (risque + coût croissant).
- [ ] Le contact corrompu peut **sauter** (événement), avec conséquence visible.
- [ ] La Pression est **lisible** sans connaître les chiffres (ambiance/indicateur).
- [ ] Une session peut se terminer par liquidation si le joueur reste leader trop longtemps.

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Rôle de la police | Faction non jouable anti-leader (anti-snowball) |
| 2 | Ciblage | Faction au plus fort Contrôle, pondérée par la Heat |
| 3 | Pression | Variable 0–100, montée ∝ contrôle du leader + Heat + crimes |
| 4 | Décroissance | Si le leader perd le lead |
| 5 | Effets | Raids (Contrôle/bâtiments), saisies (Cash propre), liquidation |
| 6 | Paliers | 40 (raid ciblé) / 70 (raid multiple + saisie) / 90–100 (liquidation) |
| 7 | Corruption | Cash sale/propre → −Pression, coût croissant, risque de saut du contact |
| 8 | Lisibilité | Indicateur/ambiance diégétique, causalité auditable |
| 9 | Ancienne version | « Patrouilles/suspicion/dealer unique » abandonnée |
| 10 | Fin de session | La police ne termine pas avant liquidation ; le score tranche sinon |
| 11 | Police locale | **Heat par quartier** (0–100) : +capture 30, +tueur 20, +opération 15, +vente 0,15×demande, +façade 0,08×richesse ; décroissance **proportionnelle au heat** `0,08 × (1 + heat/30)` (un quartier chaud refroidit plus vite → équilibre sous 100 : demande 1 ≈ 26, demande 2 ≈ 82), ×3 dans les zones sous **surveillance policière**. Les **raids visent les quartiers les plus chauds** du leader et **détruisent leur bâtiment**. La **corruption refroidit** les quartiers du cartel (heat ÷2). |

---

## Implémentation (P5) — valeurs en vigueur

> Section **faisant foi** pour `src/sim/police.ts` et `src/sim/world.ts`. La police est **abstraite** (pas une faction sur la carte) ; elle vise le **leader**.

### Pression (par tick)

- `excès = max(0 ; part de carte du leader − 1/nb factions)` (part de carte = quartiers du leader / 256).
- `ΔP = 0,02 × excès + 0,0015 × crime − 0,002` (`−0,02` en plus si corruption active).
- **Plancher de domination** : `P ≥ excès × 200` — la corruption achète un répit, **jamais l'immunité**.
- **Crime** : `+1` par capture, décroît `× 0,985`/tick.
- Contrairement à la cible, la montée utilise la **part de carte** (et non la part du contrôle détenu entre factions).

### Paliers et effets

| Palier | `P` | Effet |
|---|---|---|
| Surveillance | 0–39 | Ambiance (HUD) |
| **Raid ciblé** | 40–69 | 1 quartier du leader : **−25 Contrôle**, bâtiment **détruit** |
| **Raid multiple + saisie** | 70–89 | 3 quartiers + **saisie de 10 % du Cash propre** |
| **Liquidation** | ≥ 95 | Joueur → **défaite** ; gang IA → quartiers rendus **neutres**, `P` retombe à 70 |

- **Cooldown de raid** : **600 ticks (1 min)**.

### Corruption

- Coût **Cash propre** : `3000 × 1,8^achats`, plafonné à **1 000 000** (scale mal).
- Effet : **−20 Pression**, fenêtre **150 ticks** (−0,02/tick).
- **Risque** : 15 % de **griller le contact** → **+10 Pression** (le coût est quand même payé).
- L'**IA** corrompt aussi (leader visé, `P ≥ 70`).

### Écarts avec la cible

- Pas d'entité « contact corrompu » ni de lisibilité diégétique (sirènes/patrouilles) — HUD seul pour l'instant.
- La police ne capture pas de quartier : elle ne fait que retirer du Contrôle.
- Pondération de ciblage des non-leadeurs : **aucune** (le leader est ciblé strictement).

### Équilibrage (simulation massive)

À **20 APM** (~28 min, 100 seeds) : **98 victoires / 2 défaites**, Pression finale ~71, ~21 raids/partie.
À 30 APM (~10 min) : 99 victoires / 1 défaite, ~6 raids/partie. La police pèse sans décider.

### Contact nommé (P12)

- Le contact corrompu porte un **nom** (déterministe par seed). S'il est **grillé**, un **nouveau contact** prend le relais et la Pression remonte de 10.
