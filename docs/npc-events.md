# NPC & Events — Leurre, PNJ notables et choix à conséquences

> Statut : **implémenté (P26)** — pool de 3 événements à choix, un à la fois, effets traçables. — leurre, informateur, contact corrompu, rival et choix tranchés ; périmètre MVP acté.
> Le **moteur d'agent** (cerveau, vie, QI, rôles, servir/trahir) est spécifié dans **`factions.md`** ; ce fichier couvre ses **usages notables** et les **événements à choix**.
> ✅ **Arbitrage GDD §14D acté** : les agents/rivaux sont **inclus dès le MVP** (le GDD les plaçait en post-MVP).

## Objectif

Décrire la couche « RPG légère / choix à conséquences » incluse dès le MVP : un leurre payant, des PNJ notables récurrents et des événements à choix dont les effets sont traçables et cohérents avec la causalité pure (aucun choix « scripté bon/mauvais »). Ces mécaniques enrichissent l'anticipation sans introduire de combat direct ni de méta-progression.

## Règles

### A. Leurre / distraction

- Le joueur peut générer un événement détournant l'attention d'une patrouille (fausse alerte, altercation provoquée, embouteillage déclenché).
- **Coût** : une **petite somme d'argent sale** + un risque de **Heat globale différée** — jamais gratuit (éviter un bouton « annule le danger »).
- **Découvrable** : la police peut **découvrir le leurre** ; si elle le découvre, le dossier monte (**+Heat globale**) : la police « sait » qu'on l'a bernée.
- C'est une **action du système d'ordres** (`command.md`).

### B. PNJ notables (couche RPG légère)

- **Informateur potentiel** — peut **dénoncer** le joueur (Heat locale) ou être **acheté en une fois** ; l'achat **réduit son risque de dénonciation pour le reste du run** (il n'est pas retourné en allié).
- **Contact corrompu** (agent véreux) — **réduit temporairement la Heat globale** dans une zone ; **paiement récurrent** ; **risque qu'il soit arrêté ou muté** en cours de run (perte de l'avantage + conséquence sur le dossier).
- **Rival de quartier** — **consomme l'opportunité** d'une zone négligée (clients, façades) ; **peut recourir à la violence selon son profil** (les profils agressifs recoupent les tueurs à gage d'`factions.md`).
- Les PNJ notables sont des **agents** au sens d'`factions.md` (QI, mémoire, relation, servir/trahir).

### C. Choix à conséquences intra-run

- **5+ événements à choix par run** (fréquence élevée), chacun avec un effet **traçable**, immédiat ou différé, sur Heat/opportunité/relations.
- Exemples : accepter une livraison risquée mais lucrative, dénoncer ou couvrir un PNJ pris en flagrant délit, choisir entre deux façades concurrentes.
- **Aucun choix n'est scripté bon/mauvais** : chacun a un coût et un bénéfice réels dans le système.

### D. Périmètre MVP

- **Tous les rôles sont au MVP** : vendeurs, guetteurs, tueurs à gage, informateur, contact corrompu, rival (`factions.md`).
- La violence (tueurs à gage, rival agressif) est **tracée** et pèse sur le score (`scoring.md`).

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Coût du leurre (argent sale) | petite somme, **TBD** | TBD |
| Chance de découverte du leurre | **TBD** | TBD |
| Heat globale si leurre découvert | **TBD** | TBD |
| Coût d'achat de l'informateur | **TBD** | TBD |
| Réduction du risque de dénonciation (informateur acheté) | **TBD** | TBD |
| Réduction de Heat globale (contact corrompu) | **TBD** | TBD |
| Paiement récurrent du contact | **TBD** (montant + fréquence) | TBD |
| Chance d'arrestation/mutation du contact | **TBD** | TBD |
| Vitesse de consommation d'opportunité (rival) | **TBD** | TBD |
| Profils de rival (pacifique / agressif) | **TBD** (répartition) | TBD |
| Nombre d'événements à choix par run | **5+** | fixé |
| Taille du pool d'événements à choix | **TBD** | TBD |
| Nombre de PNJ notables actifs simultanément | **8–12** (`factions.md`) | fixé |

## Cas limites

- **Leurre trop fort** : s'il annule systématiquement le danger, il viole l'esprit de risque → coût + découverte doivent être dissuasifs.
- **Rival violent** : selon son profil, il peut recourir à la violence (tracée, pénalité de score) ; les profils pacifiques consomment seulement l'opportunité.
- **Contact corrompu arrêté** : événement prévu (perte de l'avantage + conséquence sur le dossier) → valeurs **TBD**.
- **Choix à conséquence différée** : le joueur doit comprendre a posteriori l'effet du choix en fin de run (`scoring.md`, R6).
- **Cumul de PNJ hostiles** : risque de spirale injuste → **garde-fou** (plafond de hostiles simultanés + cooldowns) **TBD**.
- **Cohérence factions.md** : un PNJ notable suit le même moteur (mémoire, relation, QI) que tout agent ; pas d'exception.

## Dépendances

- `pillars.md` — R2 (pas de méta), R3 (causalité), R6 (feedback a posteriori).
- `factions.md` — moteur d'agent (QI, mémoire, relation, servir/trahir, rôles).
- `police-ai.md` — coûts et effets sur la Pression police.
- `city-sim.md` — les PNJ/événements s'inscrivent dans les zones et événements urbains.
- `command.md` — le leurre et les interactions sont des actions.
- `scoring.md` — choix, relations et violence intégrés au récap causal.
- `art-direction.md` — violet/mauve = interaction à choix disponible.

## Critères de validation

- [ ] Aucun choix n'est « gratuit » : chacun a un coût et un bénéfice mesurables.
- [ ] Le leurre n'est jamais un bouton « annule le danger » dominant (découverte + Heat globale).
- [ ] Les PNJ notables ont un état mémorisé et influencent réellement le run.
- [ ] Les effets des choix (dont la violence) sont traçables dans le récap de fin de run.
- [ ] Aucune mécanique de cette spec ne crée de progression persistante entre runs (R2).
- [ ] Tous les rôles listés sont effectivement présents au MVP.

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Coût du leurre | Argent sale + Heat globale différée |
| 2 | Découverte du leurre | Découvrable → +Heat globale (dossier) |
| 3 | Informateur | Achat ponctuel (réduit le risque de dénonciation du run) |
| 4 | Contact corrompu | Réduction de Heat globale + risque d'arrestation/mutation |
| 5 | Rival | Consomme l'opportunité + violence selon le profil |
| 6 | Choix à conséquences | 5+ par run |
| 7 | Périmètre MVP | Tous les rôles au MVP (acte l'écart avec GDD §14D) |
