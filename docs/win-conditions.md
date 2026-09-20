# Win Conditions — Victoire, défaite et fin de partie

> Statut : **v2 (battle royale)** — plus de seuil de contrôle, de cash ni de temps : **dernier cartel en jeu**.
> Solo vs IA, **6 factions**, partie sans limite de durée.

## Objectif

Définir les conditions de **victoire**, de **défaite** et la **fin de partie** de DealerFront, ainsi que le **récap de fin**. Le jeu est un **battle royale** : on gagne en restant le **dernier cartel en jeu**. L'économie n'est plus une condition de victoire mais le **moteur** de la guerre (Membres, tech, bâtiments).

## Règles

### Victoire

Victoire **unique** : être le **dernier cartel en jeu**.

- Une faction est **éliminée** quand elle ne possède plus aucun quartier.
- La partie se termine dès que le joueur est le seul survivant (`aliveCount() === 1`).
- **Aucun seuil de contrôle, aucun seuil de Cash propre, aucune horloge.** La domination totale est le moyen, pas la condition : tenir une part écrasante déclenche la police (anti-snowball), donc gagner trop lentement ou trop brutalement se paie.

### Défaites

Trois causes de défaite, toutes **traçables** :

1. **Élimination** : le joueur tombe à **0 quartier** → défaite immédiate.
2. **Faillite** : **Cash propre ET Cash sale à 0** pendant **300 ticks (30 s)** → défaite. Une trésorerie qui repasse > 0 **réarme** la fenêtre.
3. **Liquidation policière** : la **Pression** atteint le seuil de liquidation (`docs/police-ai.md`) → défaite immédiate.

- Un joueur **éliminé** ne peut plus agir ; la partie est terminée pour lui (récap figé).
- Si **plusieurs factions s'éliminent au même tick**, le départage est déterministe (quartiers, Membres, Cash, id).

### Fin de partie

- **Aucune limite de temps** : la partie se joue jusqu'à ce qu'il ne reste qu'un cartel (ou jusqu'à la défaite du joueur).
- L'IA **achève les faibles** (priorité d'élimination) pour garantir une résolution — sinon les parties stagneraient à plusieurs survivants.

### Récap de fin

Le récap (voir `docs/ui-ux.md`) affiche : **rang final**, **quartiers possédés / 992**, **Cash propre blanchi**, **quartiers pris**, **gangs éliminés**, **raids/saisies subis**, **durée de survie**, cause de fin explicite (`Victoire (dernier survivant)`, `Élimination`, `Faillite`, `Liquidation policière`).

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Carte | Paris IRIS — 992 quartiers | fixé |
| Factions | **6** (joueur + 5 gangs IA) | fixé |
| Condition de victoire | dernier cartel en jeu | fixé |
| Limite de temps | **aucune** | fixé |
| Seuil de contrôle / cash | **supprimés** | fixé |
| Fenêtre de faillite | 300 ticks (30 s) | fixé |
| Encirclement | cluster fermé ≥ 8 quartiers **et** ≥ 35 % de la faction **et** plus petit que l'encercleur | fixé |

## Cas limites

- **Dernier survivant au forceps** : si le joueur atteint ~80 % de la carte, la police peut le liquider avant la fin (anti-snowball assumé).
- **Stagnation** : l'IA priorise l'élimination des faibles → pas de partie infinie à 4 survivants.
- **Cluster minuscule** : un cluster < 8 quartiers ou < 35 % de la faction ne capitule pas (pas de grignotage gratuit).
- **Empire quasi complet** : un cluster plus gros que l'encercleur ne capitule jamais.

## Dépendances

- `pillars.md` — R1/R3/R8 (fin causale).
- `combat.md` — capture, encirclement.
- `police-ai.md` — liquidation, anti-snowball.
- `factions.md` — 6 factions, IA d'élimination.
- `npc-events.md` — événements à choix intra-run.
- `scoring.md` — classement (puissance).

## Critères de validation

- [x] Aucune victoire tant qu'un rival est en jeu.
- [x] Une partie finit par se conclure (élimination d'un camp).
- [x] Toute fin est causale et traçable.
- [x] Simulation massive : 94 victoires / 6 défaites (100 seeds), 0 sans-fin.

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Condition de victoire | **Dernier survivant** (battle royale) |
| 2 | Temps | Illimité (plus de session) |
| 3 | Seuils contrôle/cash | **Supprimés** |
| 4 | Factions | **6** |
| 5 | Police | Conservée, létale au-delà de 80 % de domination |
| 6 | Récap | Survie + stats, pas de score composite |
