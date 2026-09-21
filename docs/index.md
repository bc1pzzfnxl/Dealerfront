# Dealer RTS — Index des spécifications (mode DealerFront)

> Spécifications de **game design** du projet, une par système.
> Statut global : **v1 DealerFront** — bascule d'un dealer incarné vers un **god-view cartel** (contrôle de quartiers, économie, gangs IA, police).
> Le `GDD-dealer-rts.md` à la racine reste l'orchestrateur / historique.

## Le mode en une phrase

Jeu **solo** de stratégie/gestion sur une **carte réelle** (Paris, quartiers IRIS), où tu incarnes **le cartel** : **rester le dernier cartel en jeu** (battle royale), face à **5 gangs IA** et à la **police**.

Second mode : **arène agent vs agent** — 2 à 4 agents IA s'affrontent sans joueur humain (API HTTP/MCP), un humain regarde en direct. Voir `arena.md` et [`../MCP.md`](../MCP.md).

## Ordre de lecture

1. `pillars.md` — vision et règles non négociables.
2. `core-loop.md` — boucle et déroulé d'une partie.
3. `territory.md` — quartiers, Influence, Contrôle, expansion.
4. `combat.md` — bagarres, défense, tueurs.
5. `economy.md` — ressources et 7 bâtiments.
6. `tech.md` — arbre de matos.
7. `factions.md` — gangs IA, diplomatie, agents.
8. `police-ai.md` — police anti-leader + corruption.
9. `procgen.md` — ville préexistante, spawns, neutres.
10. `command.md` — interface de commandement.
11. `win-conditions.md` + `scoring.md` — fin de partie et score.
12. `ui-ux.md` + `art-direction.md` — présentation et couleur de faction.
13. `city-sim.md` + `difficulty.md` — contexte de ville et difficulté.
14. `tech-stack.md` — contraintes techniques.
15. `arena.md` — arène **agent vs agent** (serveur, HTTP/MCP, spectateur). Guide de branchement : [`../MCP.md`](../MCP.md).

## Gabarit des specs

`Objectif` → `Règles` → `Paramètres chiffrés` → `Cas limites` → `Dépendances` → `Critères de validation` → `Décisions tranchées`.
Les valeurs non tranchées sont **TBD** et listées dans `open-questions.md`.

## Statut des specs

| Fichier | Système | Statut |
|---|---|---|
| `pillars.md` | Vision + piliers | v3 DealerFront |
| `core-loop.md` | Boucle + déroulé | v3 DealerFront |
| `territory.md` | Quartiers / Influence / Contrôle | v1 DealerFront |
| `combat.md` | Bagarres / défense / tueurs | v1 DealerFront |
| `economy.md` | Ressources / 7 bâtiments | v1 DealerFront |
| `tech.md` | Arbre de matos | v1 DealerFront |
| `factions.md` | Gangs IA / diplomatie / agents | v1 DealerFront |
| `police-ai.md` | Police anti-leader + corruption | v2 DealerFront |
| `procgen.md` | Ville + mise en place | v1 DealerFront |
| `command.md` | Commandement god-view | v1 DealerFront |
| `win-conditions.md` | Victoire / défaite | v1 DealerFront |
| `scoring.md` | Score final | v1 DealerFront |
| `ui-ux.md` | Interface god-view | v1 DealerFront |
| `art-direction.md` | N&B + couleurs de faction | v1 DealerFront |
| `city-sim.md` | Types de zones / densité | v2 |
| `difficulty.md` | Philosophie + fourchette O/D | v2 |
| `npc-events.md` | Événements à choix / leurre | v2 |
| `tech-stack.md` | Stack technique | v2 DealerFront |
| `arena.md` | Arène agent vs agent (DO, HTTP/MCP, spectateur) | v1 |
| `open-questions.md` | Questions vivantes | vivant |

## Remplacements (ancien mode)

- Ancien *orders.md* → **`command.md`** (ordres de faction, plus de dealer unique).
- Ancien *agents.md* → **fusionné dans `factions.md`** (cerveau d'agent, rôles, services).
- Ancien *resources-heat.md* → **remplacé** par `economy.md` + `police-ai.md` (Heat → **Pression police**).

## Glossaire

| Terme | Définition |
|---|---|
| **Quartier** | Quartier IRIS réel ; unité de territoire (992 au total). |
| **Influence** | Ressource-troupe d'une faction (pool), sert à conquérir/défendre. |
| **Contrôle** | Solidité d'un quartier possédé (0–100) ; tombe à 0 → capture. |
| **Produit** | Ressource produite par les Labos, vendue. |
| **Cash sale** | Argent non blanchi obtenu à la vente. |
| **Cash propre** | Argent blanchi (Façades) ; base du score et de la victoire. |
| **Bâtiment** | Labo, Point de vente, Façade, Planque, Atelier, Contre-espionnage, Dépôt. |
| **Faction** | Le joueur ou un gang IA (6 au total). |
| **Pression police** | Jauge anti-leader (0–100) qui déclenche raids/saisies. |
| **Tueur à gage** | Action ciblée (tech) infligeant des dégâts de zone à un quartier. |
| **Pacte** | Alliance temporaire entre factions. |
