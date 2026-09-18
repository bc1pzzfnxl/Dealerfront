# Win Conditions — Victoire, défaite et fin de partie

> Statut : **ébauche (v0)** — modèle « DealerFront » (God view) proposé, seuils **à équilibrer**.
> Session cible **20–30 min**, solo vs IA (4–6 factions). Principe d'**overtime** inspiré d'OpenFront, à valider.

## Objectif

Définir les conditions de **victoire**, de **défaite** et la **fin de partie** de DealerFront, ainsi que le **récap de fin**. La partie se joue sur une horloge (temps cible) doublée d'une course au **contrôle territorial** et à l'**argent propre** : on ne gagne ni uniquement en tuant, ni uniquement en amassant.

## Règles

### Victoire

Victoire **à double condition**, à remplir **simultanément** avant la fin du temps :

1. **Contrôle territorial** : la faction joueur détient **≥ ~60 % des quartiers** (soit ~154 / 256), mesuré par le **nombre de quartiers** possédés (pas la somme des Contrôles).
2. **Puissance financière** : **Cash propre ≥ seuil** (`docs/economy.md`) — le seuil est **TBD / à équilibrer**, exprimé en multiple du revenu par quartier (ex. « X secondes de revenu total »).

- Remplir les deux conditions **à tout moment** avant l'échéance → **victoire immédiate** (fin de partie déclenchée, récap affiché).
- **Contrôle ≥ 60 % sans le cash** : la partie continue (il manque l'économie).
- **Cash ≥ seuil sans le contrôle** : la partie continue (il manque la conquête).
- La victoire n'est **jamais** déclenchée par une condition cachée ni par la performance relative aux IA (`pillars.md`, pas de rubber-banding).

### Défaites

Trois causes de défaite, toutes **traçables** :

1. **Liquidation totale** : la faction joueur tombe à **0 quartier** (dernier quartier capturé) → défaite immédiate.
2. **Faillite** : **Cash propre ET Cash sale à 0** (ou négatif) pendant **N ticks consécutifs** (`N` **TBD / à équilibrer**, ex. 30 s). Vendre des bâtiments, licencier des agents ou brader du Produit peut éviter le seuil ; une trésorerie qui repasse > 0 **réarme** la fenêtre.
3. **Liquidation policière** : la **Pression max** est atteinte (`docs/police-ai.md` — descente générale / arrestation du cartel) → défaite immédiate.

- La défaite **ne préempte pas** une victoire remplie au **même tick** : ordre de résolution = **victoire d'abord**, puis défaite.
- Un joueur **éliminé** (0 quartier) ne peut plus agir, mais la partie peut continuer entre IA jusqu'à l'échéance (le récap du joueur est figé).

### Fin de partie

- **Temps cible** : **20–30 min** (configurable au lancement ; 25 min par défaut, **à équilibrer**).
- À l'échéance, si aucune condition de victoire/défaite n'est remplie → la faction avec le **meilleur score composite** (`docs/scoring.md` : contrôle + Cash propre + ennemis éliminés) l'emporte ; le joueur **gagne** s'il est premier, sinon **match nul** ou **défaite** selon le rang (**TBD / à valider**).
- **Overtime (optionnel, inspiré d'OpenFront — à valider)** : à partir de 30 min, le **seuil de contrôle requis baisse de 2 %/min** (60 % → 58 % → 56 % …). Le cash requis **reste constant**. Cela force une résolution et évite les parties bloquées. **Non tranché** : peut être désactivé en mode standard.

### Récap de fin

Le récap (voir `docs/ui-ux.md`, `docs/scoring.md`) affiche :

- **Contrôle final** : quartiers possédés / 256 (et % de la carte).
- **Cash propre** final.
- **Quartiers pris** (total de captures réussies, hors expansion neutre ou avec, à préciser).
- **Ennemis éliminés** (factions réduites à 0 quartier).
- **Raids subis / raids évités** : attaques encaissées et attaques annulées/repoussées, y compris frappes de tueurs.
- **Cause de fin** explicite : `Victoire (contrôle + cash)`, `Liquidation totale`, `Faillite`, `Liquidation policière`, `Temps écoulé — rang`.
- **Chaîne causale** : chaque résultat renvoie aux événements loggés (cohérent avec le récap causal de `docs/scoring.md`).

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Quartiers | **256** | fixé |
| Seuil de contrôle (victoire) | **≥ 60 %** (~154 quartiers) | à équilibrer |
| Seuil de Cash propre (victoire) | multiple du revenu total (ex. X s de revenu) | à équilibrer |
| Temps cible de session | **20–30 min** (défaut 25) | à équilibrer |
| Overtime — début | 30 min | à valider |
| Overtime — baisse de seuil | **−2 %/min** | à valider |
| Faillite — fenêtre | **N** ticks consécutifs à 0 | TBD |
| Faillite — réarmement | dès que trésorerie > 0 | fixé |
| Liquidation totale | 0 quartier | fixé |
| Liquidation policière | Pression max (`police-ai.md`) | fixé |
| Ordre de résolution fin de partie | Victoire → Défaite | fixé |
| Factions | 4–6 (joueur + IA) | fixé |
| Règle temps écoulé | meilleur score composite l'emporte | à valider |

## Cas limites

- **Égalité de contrôle** (deux factions au seuil, ou fin au temps avec contrôle identique) : départage par le **Cash propre**, puis par le **nombre d'ennemis éliminés**, puis par le **nombre de quartiers** (égal par hypothèse) → **match nul** si tout est égal.
- **Élimination simultanée** (deux factions tombent à 0 quartier au même tick, ou le joueur et la dernière IA rivale) : la faction avec le **plus grand `I_eng`** engagé sur la dernière capture l'emporte ; si c'est le joueur qui tombe en même temps qu'il remplit la victoire, **victoire d'abord** (règle tranchée).
- **Victoire et défaite au même tick** : la **victoire est prioritaire** (ordre de résolution) ; le récap mentionne la défaite évitée.
- **Faillite pendant l'overtime** : la fenêtre de faillite continue de courir normalement ; l'overtime n'allège que le seuil de contrôle.
- **Fin de temps sans propriétaire unique** : si plusieurs IA dépassent le seuil de contrôle, la première à l'avoir atteint (horodatage tick) est classée au-dessus.
- **Joueur éliminé mais IA encore en course** : le récap est affiché immédiatement pour le joueur (rang figé) ; le détail des IA non résolues est marqué « — ».
- **Overtime désactivé** : si toutes les factions restent sous le seuil à 30 min, on applique la règle « temps écoulé — rang » sans baisse de seuil.
- **Reconquête du dernier quartier** : si le joueur reprend un quartier **le même tick** qu'il est éliminé, l'élimination est annulée (le tick est résolu sur l'état final).

## Dépendances

- `docs/territory.md` — comptage des quartiers, propriété, contrôle, cartes.
- `docs/factions.md` — liste des factions, IA, élimination, diplomatie.
- `docs/police-ai.md` — Pression de clôture / descente générale / arrestation (liquidation policière).
- `docs/scoring.md` — score composite, départages, récap causal.
- `docs/economy.md` — Cash propre/sale, seuil de richesse, faillite, revenus.
- `docs/combat.md` — captures, raids subis/évités, frappes de tueurs.
- `docs/core-loop.md` — structure temporelle d'un run (comparaison mono-dealer).
- `docs/ui-ux.md` — présentation du récap de fin et des bannières de fin.

## Critères de validation

- [ ] Une victoire exige **à la fois** le seuil de contrôle et le seuil de cash (impossible de gagner sur un seul axe).
- [ ] Les trois défaites sont atteignables et chacune produit une **cause de fin** distincte et lisible.
- [ ] La faillite ne se déclenche **jamais** sur un tick isolé (fenêtre N respectée) et se réarme si la trésorerie remonte.
- [ ] L'ordre « victoire → défaite » est vérifié pour un même tick.
- [ ] L'overtime (si activé) résout une partie autrement bloquée ; s'il est désactivé, la règle « temps écoulé » s'applique.
- [ ] Le récap contient contrôle final, cash propre, quartiers pris, ennemis éliminés, raids subis/évités et cause de fin.
- [ ] Aucune condition ne dépend de la performance relative du joueur (pas de rubber-banding).
- [ ] Une session standard se conclut en **20–30 min**.

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Condition de victoire | Contrôle ≥ ~60 % **ET** Cash propre ≥ seuil, avant l'échéance |
| 2 | Défaites | 0 quartier · faillite (N ticks à 0) · liquidation policière |
| 3 | Durée cible | 20–30 min (défaut 25) |
| 4 | Overtime | Optionnel : à 30 min, seuil −2 %/min — **à valider** |
| 5 | Fin au temps | Meilleur score composite ; départages cash → éliminés → nul |
| 6 | Ordre de résolution | Victoire prioritaire sur défaite au même tick |
| 7 | Récap | Contrôle, cash propre, quartiers pris, ennemis éliminés, raids, cause |
| 8 | Élimination simultanée | Plus grand `I_eng` ; égalité = départage score |
| 9 | Faillite — réarmement | Trésorerie > 0 annule la fenêtre |
| 10 | Inspiration | OpenFront (AGPL) pour l'overtime : idées reprises, code non repris |

---

## Implémentation (P6) — valeurs en vigueur

> Section **faisant foi** pour `src/sim/world.ts` (`WorldOptions`, `checkOutcome`, `summary`).

- **Durée de session** : **25 min par défaut (15 000 ticks)** ; configurable (`new World(seed, archetype, { timeLimitTicks })`).
- **Victoire** : `contrôle ≥ 60 %` **ET** `Cash propre ≥ 500 000`, à tout moment.
- **Défaites** : 0 quartier · **faillite** (`Cash propre ≤ 0` **et** `Cash sale ≤ 0` pendant **300 ticks = 30 s** ; réarmée dès que la trésorerie remonte) · **liquidation policière** (`P ≥ 95`).
- **Ordre de résolution** : victoire → défaite (une victoire au même tick annule une liquidation policière).
- **Fin au temps** : classement par **score composite** ; joueur 1er → victoire, sinon défaite « rang N ». **Pas de match nul** (rang strict).
- **Overtime** : implémenté mais **désactivé par défaut** (`overtime: false`) ; s'il est activé, le seuil baisse de **−2 %/min** après l'échéance (plancher 20 %).
- **Récap** (`summary()`) : contrôle, quartiers, Cash propre, quartiers pris, gangs éliminés, raids subis, saisies, score, rang, cause.
