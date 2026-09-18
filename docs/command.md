# Command — Interface de commandement (god view)

> Statut : **v1 (DealerFront)** — remplace `orders.md` (ordres d'un dealer unique). On commande un **cartel**, pas un personnage.

## Objectif

Définir **comment le joueur commande de loin** : sélection de quartiers, ordres de faction, lots d'ordres, et abandon de la micro-gestion d'un personnage.

## Règles

### Principe

- **God view** : on observe la ville en vue large (`ui-ux.md`) et on donne des **ordres de faction**.
- **Plus de personnage** : pas de déplacement individuel, pas de file d'ordres de dealer, pas de caméra suiveuse serrée.
- Les ordres s'appliquent à **un quartier**, une **sélection** ou une **frontière**.

### Ordres disponibles

| Ordre | Cible | Effet |
|---|---|---|
| **Attaquer** | Quartier neutre ou ennemi adjacent | Engage de l'Influence (voir `combat.md`) |
| **Renforcer** | Quartier possédé | Transfère de l'Influence pour restaurer/augmenter le Contrôle |
| **Construire** | Quartier possédé | Pose un bâtiment (Labo, Point de vente, Façade, Planque, Atelier, Contre-espionnage, Dépôt) — `economy.md` |
| **Convertir** | Bâtiment existant | Transforme un bâtiment de la ville en bâtiment de cartel — `economy.md` |
| **Rechercher (tech)** | Globale (via Atelier) | Monte une branche (Armement/Protection/Logistique) — `tech.md` |
| **Corrompre** | Globale | Dépense pour réduire la Pression police — `police-ai.md` |
| **Diplomatie** | Faction | Proposer un pacte, embargo — `factions.md` |
| **Tueur à gage** | Quartier ennemi | Assassinat ciblé (si tech) — `combat.md` |

### Planification

- **Ordres par lot** : sélection multiple (glisser-rectangle) pour attaquer/construire sur plusieurs quartiers.
- **Prévisualisation** : avant validation, afficher l'Influence engagée, les pertes estimées et les quartiers concernés.
- **Aucune micro** : le joueur planifie, la simulation exécute à pas fixe (10 Hz).

### Abandonné (vs ancien mode)

- File d'ordres individuelle d'un dealer, actions engageantes personnelles, déplacement clavier ZQSD, inventaire d'un personnage. Voir `pillars.md` (P5 redéfini).

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Taille de sélection max | **TBD** | TBD |
| Cooldown d'ordre (anti-spam) | **TBD** | TBD |
| Nb d'ordres simultanés | **TBD** | TBD |
| Prévisualisation (pertes/coût) | requis | fixé |

## Cas limites

- **Ordre impossible** (quartier non adjacent / plus possédé) : refusé avec feedback, pas de mise en file silencieuse.
- **Attaque sans Influence suffisante** : refusée ou limitée à l'Influence disponible (à trancher → `TBD`).
- **Replanification** : pas de coût (on est en god view) ; éviter le spam par cooldowns.
- **Sélection mixte** (possédé + ennemi) : chaque quartier reçoit l'ordre pertinent, les invalides sont ignorés.

## Dépendances

- `pillars.md` — P5 (commandement), R1.
- `territory.md`, `combat.md`, `economy.md`, `tech.md`, `factions.md`, `police-ai.md`.
- `ui-ux.md` — présentation des ordres et de la prévisualisation.

## Critères de validation

- [ ] Tous les ordres de la boucle (`core-loop.md`) sont accessibles sans personnage.
- [ ] Les ordres par lot fonctionnent (sélection multiple).
- [ ] L'ordre impossible est refusé proprement.
- [ ] Aucune action ne dépend d'un contrôle individuel de personnage.

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Modèle | Ordres de faction par quartier/sélection |
| 2 | Micro | Supprimée (god view) |
| 3 | Planification | Lots + prévisualisation (coût/pertes) |
| 4 | Ancien `orders.md` | Remplacé par ce fichier |
