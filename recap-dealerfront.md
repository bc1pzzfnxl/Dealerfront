# Recap DealerFront — Arena `d252b87c`

**Résultat :** victoire « Last cartel standing » — 992 quartiers (100 % de contrôle) contre 0 pour le Cartel, en 1146 s (~19 min), avec 1 325 captures.

---

## 1. Stratégie employée

### Boucle de jeu principale
Chaque cycle (≈ toutes les 5–10 s réelles) :

1. `get_state` pour rafraîchir la liste `targets` (neutres + quartiers ennemis adjacents) et `emptyQuarters` ;
2. Vague d'`attack` sur **tous** les targets listés, ennemis d'abord ;
3. `batchBuild` pour produire/ construire automatiquement ;
4. `hireMercenaries` dès que le cash sale le permettait (≈ 8 k+) ;
5. `buyArmament` dès que disponible ;
6. `corrupt` dès que la pression policière approchait les seuils critiques.

### Ordre de priorité
1. **S'agrandir vite** sur les neutres (faible résistance : garrison 60) pour construire un avantage économique et démographique ;
2. **Pousser frontalement** le Cartel dès que la liste de targets incluait ses quartiers (garrison 170–250, plus coûteux) ;
3. **Baisser l'attackRatio** au début (0.1) pour ne pas épuiser les troupes, puis le monter progressivement (0.2 → 0.4 → 0.5) en fin de partie pour noyer les derniers points de résistance ;
4. **Mitiger la pression policière** en permanence car au-delà de 70 → saisie, 95 → liquidation instantanée de la partie.

### Gestion économique
- Zone-matching des bâtiments : atelier → zone industrielle, storefront → commercial, front → laundry, housing/counter → résidentiel.
- `launderRatio` ajusté selon les besoins (0.3 pour financer la construction, 0.1 pour accumuler le cash sale destiné aux mercenaires).
- Le product dépassait très largement la capacité de vente (5 storefronts) : gisement de revenus inexploité.

### Leçons clés apprises en partie
- `buyQuarter` est toujours impossible → expansion uniquement par l'attaque.
- `assault impossible` = pool de troupes engagées simultanément saturé (ratio × membres) → il faut faire monter `attackRatio` ou laisser les assauts se résoudre.
- `safehouse` n'a jamais pu être construit (zone inconnue), `workshop` non-rebuildable sur son propre quartier.
- `hire impossible` même avec 450 k de cash sale → cap logistique (housing) probable.
- La pression monte naturellement avec la taille de l'empire : il faut `corrupt` en continu, sous peine de défaite instantanée malgré la dominiance.

---

## 2. Le jeu : points positifs

| Point | Détail |
|---|---|
| **Boucle addictive** | Le rythme (5 ticks/s, budget d'actions) crée une vraie urgence de micro-gestion, on ne s'ennuie jamais. |
| **Lisibilité des cibles** | `targets` / `emptyQuarters` rendent les décisions immédiates : on sait toujours quoi frapper et quoi construire. |
| **Pression policière** | Mécanique anti-snowball efficace : même en menant 992–0, la pression à 90+ nous a réellement mis en danger. C'est le seul vrai suspense de la fin de partie. |
| **Tension expansion / survie** | Grandir augmente la pression, corrompre coûte cher, recruter coûte cher : il faut arbitrer en continu. |
| **Multi-agent live** | Deux factions qui réagissent en temps réel, l'IA ennemie a contre-attaqué et pris des quartiers — la carte bouge. |
| **Transparence des erreurs** | Chaque échec d'action renvoie une raison (`assault impossible`, `hire impossible`…) qui permet d'apprendre en partie. |
| **Design de zone** | Les zones (industrielle, commerciale, laundry…) forcent à regarder la carte plutôt que de spammer un seul bâtiment. |

---

## 3. Le jeu : points négatifs

| Point | Détail |
|---|---|
| **Trop d'actions « automatiques »** | `batchBuild`, `attackBest`, les cibles listées en clair : le jeu joue beaucoup tout seul. La stratégie se résume à « spammer la liste de targets ». |
| **Expansion mono-mécanique** | `buyQuarter` mort-né, pacts/fonds inutiles en 1v1, une seule voie de conquête : l'attaque. Peu de choix structurels. |
| **Économie peu lisible** | Cash sale / propre, transit, ratios : les effets de `launderRatio` ou les caps (hire impossible) ne sont jamais expliqués. On apprend par essai-erreur. |
| **Bâtiments opaques** | Zones non documentées (safehouse introuvable), pas de cap connu, pas de coût affiché. La couche « city builder » est frustrante. |
| **Snowball dominant** | Une fois l'avantage pris, la seule counter-play ennemie était de piocher nos quartiers marginaux. Aucun événement (raid majeur, trahison, unité spéciale) ne renversait la dynamique. |
| **Pression policière mal dosée** | Monte trop vite quand on gagne, mais `corrupt` la reset quasi intégralement → elle devient une simple « touche à spammer » plutôt qu'un vrai dilemme. |
| **Profondeur tactifique nulle** | Pas de terrain, pas de types d'unités, pas de defensive bonus visible : l'attaque est toujours meilleure que la défense → le defender est puni. |
| **Fin de partie longue** | Les 15 derniers quartiers ont pris ~3 minutes de spam alors que l'issue était déjà connue. |

---

## 4. Leviers de pression que je voudrais voir

1. **Pression policière conditionnelle et cumulative**
   - Chaque `corrupt` augmente le coût du suivant (inflation de la corruption) et laisse une trace (chance de « corrupteur » démasqué → perte de cash propre).
   - Les seuils devraient appliquer des **pénalités progressives** (−x % troupes par palier) avant la liquidation, pas un simple 70/95 binaire.

2. **Coût d'opportunité territorial**
   - Chaque quartier tenu augmente l'entretien (upkeep) et la pression : être grand doit faire mal, pas seulement grossir.
   - Bonus de défense en terrain connu (garrison reçoit +20 % dans ses quartiers) pour punir le « doom-wave ».

3. **Rareté des mercenaires / de l'armement**
   - Marché dynamique : le prix des mercenaires monte avec le nombre engagés dans la partie (toutes factions confondues).
   - Cooldown global d'armement partagé, pour créer des fenêtres de vulnérabilité.

4. **Événements de milieu de carte**
   - Raids policiers ciblés sur les quartiers les plus productifs, informant l'adversaire d'une fenêtre d'attaque.
   - Quartiers neutres « gang rival » qui se défendent sérieusement, forçant à choisir ses offensives.

5. **Fog of war partiel**
   - Ne révéler que les quartiers adjacents + une reconnaissance coûteuse : supprimer la liste `targets` gratuite force à explorer et à se tromper.

6. **Victoires alternatives**
   - Victory par contrôle économique (x % du produit mondial) ou par corruption du conseil municipal, pour que domination militaire totale ne soit pas la seule voie.

---

## 5. Ce jeu force-t-il à réfléchir, ou est-il « un peu débile » ?

**Verdict : la couche actuelle est plutôt « débile » au sens stratégique — mais les fondations sont bonnes.**

### Pourquoi c'est peu poussé aujourd'hui
- La boucle optimale tient en une phrase : *« frappe tout ce que la liste te montre, construis quand c'est vide, corrompt quand la pression monte. »* Il n'y a pres jamais de **choix douloureux** : pas de dilemme « attaquer A ou défendre B », pas de renoncement, pas d'information cachée.
- Les systèmes (économie, diplomatie, renseignement) existent dans le catalogue d'actions mais sont **désactivés ou inutiles en 1v1** → il ne reste qu'un jeu de vitesse de clic/boucle d'actions.
- La profondeur vient surtout du **temps réel et du budget d'actions** (skill d'exécution) plus que de la réflexion (strategie). C'est un jeu de micro, pas de macro.

### Ce qui, à l'inverse, demande déjà de réfléchir
- Le **timing de montée d'attackRatio** (trop tôt = troupes épuisées, trop tard = on laisse l'ennemi respirer).
- La **gestion cash sale vs propre** pour financer mercenaires sans tomber en faillite de construction.
- Le **rythme de corrupt** : trop tard = liquidation, trop tôt = ressources gaspillées.
- Le **zone-matching** des bâtiments impose de lire la carte.

Ce sont de bons instincts de design — il faut les rendre **décisifs** plutôt qu'optionnels.

---

## 6. Comment rendre le jeu plus stratégique

### A. Supprimer les actions « auto »
- Retirer la liste `targets` gratuite : ne donner que les quartiers **révélés**, et exiger une action `recon` (coûteuse, avec délai) pour voir plus loin.
- Limiter `batchBuild` à un nombre max de constructions, ou supprimer le smart-building : forcer le choix atelier vs logement vs boutique.

### B. Créer de vrais dilemmes
- **Fronts multiples** : une carte plus grande avec 3+ factions rend impossible de tout attaquer → décider où concentrer.
- **Défense récompensée** : bonus de terrain, pièges, ou « embuscade » qui punit l'attaquant qui over-commit.
- **Diplomatie utile même en duel** : pactes de non-agression temporaires avec contreparties, trahisons possibles, intelligence partagée.

### C. Rendre l'économie lisible et tendue
- Afficher coûts, caps, et effets marginaux (« ce locker coûte +2 % pression/tour »).
- Faire de l'entretien une vraie ligne de compte : l'empire géant doit **choisir** quelles zones abandonner.
- Plafonner le stockage de produit pour forcer à investir dans la distribution plutôt qu'accumuler.

### D. Dynamiser la pression policière
- Paliers de pénalité progressives avant liquidation.
- `corrupt` avec coût croissant et risque (démasquement) → transformer la touche en **arbitrage risque/rendement**.
- Raids ciblés prévisibles (tour de préparation) qui donnent une fenêtre d'attaque à l'adversaire.

### E. Réduire la fin de partie creuse
- Déclencher la victoire automatique à un seuil (ex. 80 % du contrôle) ou accélérer les ticks quand un camp est sous 5 % de quartiers.

### F. Couche « meta » pour la réflexion
- Objectifs de cartes variables (contrôle, économie, corruption du maire).
- Renseignement : mentir sur ses effectifs, faux mouvements.
- Unités spécialisées (éclaireurs, contre-insurrection) pour que la composition de force compte, pas seulement le nombre.

---

## En une phrase

> DealerFront aujourd'hui est un **excellent jeu d'exécution temps réel** mais un **mauvais jeu de gestion stratégique** : il suffit d'ajouter du **brouillard de guerre, des coûts d'opportunité réels et une pression policière progressive** pour transformer le spam de cibles en vraies décisions.
