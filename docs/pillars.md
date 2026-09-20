# Pillars — Vision et règles non négociables (mode DealerFront)

> Statut : **v3 (DealerFront)** — passage d'un dealer incarné à un **god-view cartel**. Remplace la vision « un seul personnage ».

## Objectif

Fixer l'identité du jeu et les invariants qui s'appliquent à **tous** les systèmes. En cas de conflit, ces piliers priment.

## Vision / Pitch

Jeu de **stratégie/gestion solo**, vue **carte réelle** (Paris, quartiers IRIS) jouable en navigateur. Tu incarnes **le cartel** (God view) : tu ne contrôles plus un personnage, tu **commandes de loin**. Objectif : **rester le dernier cartel en jeu** (battle royale), face à **5 gangs IA** et à la **police**.

**Inspirations** : OpenFront (contrôle territorial temps réel, alliances, traîtres), gestion sous pression (Heat, police), Frostpunk (diegetic UI).

## Les piliers

### 1. Une partie = une histoire fermée
Aucune progression méta, aucun lien entre les runs. Chaque partie se suffit à elle-même.

### 2. Difficulté honnête
Jamais cachée, jamais adaptative (pas de rubber-banding). La difficulté de base est **fixée à la génération** (ville, factions, contrôle du neutre) et **lisible**. Elle évolue ensuite **par causalité pure** (prises de quartiers, Heat, police).

### 3. Simulation réaliste et traçable
Tout comportement (IA, police, économie) résulte d'un **système de règles cohérent et auditable**. Le joueur peut comprendre pourquoi il a perdu un quartier ou s'est fait liquider.

### 4. Gestion ET conquête, à égalité
Boucle **équilibrée** : l'**économie** (produire, vendre, blanchir) finance l'**armée** (Influence, tech) et la **conquête** (quartiers) nourrit l'**économie**. Ni jeu de construction passif, ni pur wargame.

### 5. Commandement de cartel (God view)
**Plus d'immersion RP ni de personnage unique.** On observe et on commande à distance : sélection de quartiers, ordres de faction, conquête. La profondeur vient de la **planification** (où frapper, quoi construire, quand blanchir, quand corrompre).

### 6. La couleur est de l'information (factions)
Exception assumée au N&B strict : la **couleur marque la possession** (factions) et les signaux fonctionnels. Le monde reste N&B ; la couleur ne décore jamais.

## Règles non négociables (transverses)

| # | Règle | Conséquence |
|---|---|---|
| R1 | **Pas de rubber-banding** | Le jeu n'adapte jamais les règles/IA à la performance du joueur. |
| R2 | **Pas de méta-progression** | Aucun lien entre les parties. |
| R3 | **Causalité pure** | Toute tension (Pression police, pertes de quartiers) a une cause en jeu traçable. |
| R4 | **Difficulté de base lisible** | Communiquée par observation du monde, jamais par un chiffre caché. |
| R5 | **N&B fonctionnel** | Le monde est en niveaux de gris ; la couleur est **informative** (factions, alertes). |
| R6 | **Feedback a posteriori** | Explications de fin de run, pas de pop-ups intrusifs. |
| R7 | **Pas d'omniscience IA** | Les gangs IA agissent sur ce qu'ils perçoivent/mémorisent, pas sur la vérité absolue. |
| R8 | **Fin causale** | La partie se termine par une cause (victoire, liquidation, faillite), jamais un simple minuteur. |

## Cas limites

- **Conflit pilier / fun** : une mécanique qui viole R1/R2/R3 est rejetée ou reformulée.
- **Lisibilité de la possession** : la couleur de faction ne doit jamais masquer la lisibilité du terrain (aplats translucides, contours).
- **God view vs gestion** : on doit pouvoir jouer **sans** micro (ordres par lot/quartier).

## Dépendances

- Référencé par **toutes** les specs. Mise en œuvre : `territory.md` (R3), `combat.md`, `factions.md` (R7), `police-ai.md` (R1/R3), `art-direction.md` (R5/R6), `ui-ux.md`.

## Critères de validation

- [ ] Aucune mécanique ne contredit R1–R8.
- [ ] Le jeu est jouable **sans personnage** (god view, ordres de quartier).
- [ ] La possession est lisible par la couleur sans casser le N&B du terrain.
- [ ] Chaque hausse de tension est traçable causalement.

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Modèle joueur | **God view cartel** (fin du dealer incarné) |
| 2 | Boucle | Économie ↔ conquête à égalité |
| 3 | Couleur | Autoriser la couleur comme **information de faction** |
| 4 | Piliers conservés | R1–R4, run fermé, causalité |
| 5 | Piliers remplacés | « un seul personnage » → **commandement de cartel** |
