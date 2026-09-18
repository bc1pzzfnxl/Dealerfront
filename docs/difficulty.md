# Difficulty — Philosophie, formules O/D et budget de difficulté

> Statut : **affiné (v2)** — formules O/D, détection par action, délais 3 paliers, variance et budgets par archétype tranchés.

## Objectif

Fixer la **philosophie de difficulté** (non négociable), les **formules** des scores d'opportunité (O) et de danger (D), et les **valeurs de référence** traduisant des données réelles de criminologie en paramètres de jeu compressés sur 30 minutes.

## Règles — Philosophie (non négociable)

- **Pas de rubber-banding** : le jeu n'ajuste jamais l'IA ou les règles pour compenser la performance du joueur.
- **Pas de méta-progression** : aucun lien entre les parties (pas d'XP, pas de déblocage permanent).
- **Difficulté de base aléatoire mais visible** : fixée à la génération, communiquée par observation directe du monde (nombre de postes visibles, densité de patrouilles) — jamais par un chiffre caché ou un score annoncé.
- **Difficulté évolutive = causalité pure** : toute montée de tension découle des actions du joueur (Heat, témoins, patrouilles alertées).

> Voir `pillars.md` R1–R4.

## Formules des scores O et D

Les scores sont calculés **à la génération**, par carte, puis agrégés en un ratio `O/D`.

### Score d'opportunité O (complet)

`O = Σ_z [ Profit_z × DensitéClients_z × Accessibilité_z ] + α·N_façades − β·D_moyenne(labo → points de vente)`

| Terme | Description |
|---|---|
| `Profit_z` | Profit potentiel de la zone `z` (type de zone/client). |
| `DensitéClients_z` | Densité de clients PNJ potentiels. |
| `Accessibilité_z` | Facilité d'accès depuis le reste du réseau. |
| `N_façades` | Nombre de façades de blanchiment disponibles. |
| `D_moyenne(labo→vente)` | Distance moyenne labo → points de vente (pénalise la logistique trop longue). |
| `α`, `β` | Poids à équilibrer. |

### Score de danger D (complet)

`D = Σ_z [ CouverturePatrouille_z + ProximitéPoste_z + DensitéTémoins_z ] + γ·Σ_z H_base(z)`

| Terme | Description |
|---|---|
| `CouverturePatrouille_z` | Densité/couverture de patrouilles de base. |
| `ProximitéPoste_z` | Proximité et nombre de postes de police. |
| `DensitéTémoins_z` | Potentiel de témoins civils (`city-sim.md`). |
| `H_base(z)` | Danger de base de la zone (postes de police, `police-ai.md`). |
| `γ` | Poids à équilibrer. |

### Fourchette cible

- **Ratio O/D entre 0,90 et 1,10** (variance acceptée mais limitée : pas de run trivial, pas de run injouable).
- Hors fourchette → **correction automatique** (ajout/retrait d'une patrouille, déplacement d'un poste, ajustement d'une zone de profit) ; si l'échec persiste après **N itérations**, la seed est **régénérée**.
- Le ratio n'est **jamais recalculé pendant la partie** (R1).

## Paramètres chiffrés — Valeurs de référence (ancrées dans le réel)

### Sources utilisées (criminologie réelle, abstraite pour le jeu)

- **Temps de réponse policière** : dans les grandes agglomérations, la moyenne pour un appel prioritaire varie fortement — environ **5 à 9 min** dans les villes les mieux dotées / incidents les plus graves, jusqu'à **15–20 min** (voire plus) dans les zones sous-dotées ou pour des appels moins critiques.
- **Taux d'élucidation réel** : une minorité des infractions sont résolues par arrestation (de l'ordre de **35–40 %** pour les crimes violents, **~12 %** pour les atteintes aux biens). Pour la drogue spécifiquement, l'écrasante majorité des arrestations concerne la **possession simple** ; la vente/fabrication ne représente qu'une **fraction (~15–16 %)** des arrestations — l'activité de deal organisée est structurellement plus difficile à intercepter que la consommation visible.

### Détection par action (fourchettes)

Tirage à l'intérieur de la fourchette selon l'action :

| Action | Détection (dossier fermé) | Détection (dossier ouvert) |
|---|---|---|
| Transport / déplacement porteur | 8–10 % | 60–70 % |
| Vente | 8–15 % | 60–85 % |
| Blanchiment (action engageante longue) | 12–18 % *(à équilibrer)* | 70–85 % *(à équilibrer)* |

- **Détection cumulée sur zone** (`H_L` > seuil 60) : croissance progressive, jamais de palier brutal **avant** le seuil ; **palier net** une fois le seuil franchi.

### Délais de réaction (3 paliers, alignés `police-ai.md`)

| Palier structurel | `H_G` | Délai de réaction |
|---|---|---|
| P1 — agent seul | 0–29 | 90–150 s |
| P2 — duo motorisé | 30–54 | 60–90 s |
| P3 / P4 — renforcé / descente | 55–100 | 15–30 s |

### Budgets cibles par archétype

Chaque archétype a un **ratio O/D cible propre**, toujours **dans la fourchette globale** 0,90–1,10 (valeurs à équilibrer) :

| Archétype | Cible O/D | Intention |
|---|---|---|
| Centre-ville dense / night-life | ≈ 0,95 | Riche mais dangereux |
| Quartier résidentiel | ≈ 1,05 | Calme, opportunité modérée |
| Zone industrielle/portuaire | ≈ 1,00 | Production/logistique |
| Quartier universitaire/étudiant | ≈ 1,00 | Volatile (jour/nuit) |
| Zone portuaire/frontalière | ≈ 0,95 | Import risqué, douane active |

### Tableau récapitulatif des paramètres

| Paramètre | Valeur / fourchette | Statut |
|---|---|---|
| Fourchette O/D globale | 0,90–1,10 | fixé |
| Cible O/D par archétype | 0,95–1,05 selon archétype | à équilibrer |
| Composantes de O | profit, densité clients, accessibilité, façades, distance labo→vente | fixé |
| Composantes de D | patrouilles, postes, témoins, `H_base` | fixé |
| Poids `α`, `β`, `γ` | **TBD** | TBD |
| Détection transport | 8–10 % / 60–70 % | à équilibrer |
| Détection vente | 8–15 % / 60–85 % | GDD |
| Détection blanchiment | 12–18 % / 70–85 % | à équilibrer |
| Délais de réaction | 90–150 / 60–90 / 15–30 s | fixé (3 paliers) |
| Nombre max d'itérations de correction | **N** (ex. 5) **TBD** | TBD |
| Critère de régénération de seed | échec après N itérations | fixé |

## Cas limites

- **Compression temporelle** : les valeurs réelles sont ramenées à l'échelle de la session (30 min) ; la proportionnalité doit rester cohérente.
- **Correction impossible** : si N itérations ne ramènent pas le ratio dans la fourchette, régénérer la seed (jamais d'acceptation hors fourchette).
- **Perception de l'aléa** : la difficulté de base doit être *lisible* avant le run (choix parmi 3 villes, `ui-ux.md`), sinon elle est injuste (R4).
- **Rubber-banding déguisé** : toute mécanique qui « compense » la performance est interdite, même présentée comme du confort.
- **Score indépendant de la difficulté** : le score final ne contient **aucun** bonus/malus de difficulté (sinon inéquitable entre runs, `scoring.md`).
- **Archétype extrême** : même le plus riche ou le plus calme reste borné par la fourchette globale.

## Dépendances

- `pillars.md` — R1–R4.
- `procgen.md` — applique les formules O/D, corrections et régénérations.
- `police-ai.md` — consomme les probabilités et les délais par palier.
- `police-ai.md` — seuils de Pression et danger de base.
- `city-sim.md` — densité de clients/témoins par zone.
- `scoring.md` — pas de bonus/malus de difficulté.

## Critères de validation

- [ ] Aucun paramètre de difficulté n'est recalculé pendant le run (audit anti-rubber-banding).
- [ ] Les probabilités/délais sont cohérents avec la logique réelle décrite ci-dessus.
- [ ] Le ratio O/D de chaque carte reste dans [0,90 ; 1,10] après correction.
- [ ] Deux runs sur la même carte avec la même séquence d'actions donnent le même résultat (déterminisme, hors choix).
- [ ] La difficulté de base est lisible sans connaître les formules.

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Composantes de O | Complètes (profit, clients, accès, façades, distance) |
| 2 | Composantes de D | Complètes (patrouilles, postes, témoins, `H_base`) |
| 3 | Détection | Fourchettes par action (transport/vente/blanchiment) |
| 4 | Délais de réaction | 3 paliers : 90–150 / 60–90 / 15–30 s |
| 5 | Contrôle de variance | Correction auto puis régénération après N itérations |
| 6 | Budgets archétype | Cible propre par archétype, dans la fourchette globale |
