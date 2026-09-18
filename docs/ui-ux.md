# UI/UX — Interface god-view (DealerFront)

> Statut : **v1 (DealerFront)** — réécrite pour le mode cartel : overlays de contrôle, couleurs de faction, HUD multi-ressources.

## Objectif

Définir une interface **de commandement à distance** : lire la situation d'un coup d'œil (possession, contrôle, pression) et donner des ordres par quartier, **sans micro ni personnage**.

## Règles

### Caméra

- **God view large** : caméra libre (pan + zoom), **iso fixe**, dézoom important (on voit la ville). Plus de caméra suiveuse serrée.
- Navigation : glisser (pan), molette (zoom), bord d'écran/clavier (optionnel), **minimap cliquable** pour se téléporter.

### Lecture de la carte

| Information | Rendu | Interdit |
|---|---|---|
| **Possession** (faction) | **Aplat translucide coloré** + contour sur les quartiers, **couleur de faction** (`art-direction.md`) | Couleur décorative |
| **Contrôle du quartier** | Nombre 0–100 (ou jauge fine) affiché sur le quartier sélectionné/survolé, dégradé de remplissage | — |
| **Bâtiments** | **Icônes** par type (Labo, Point de vente, Façade, Planque, Atelier, Contre-espionnage, Dépôt) | — |
| **Neutre** | Gris (pas d'aplat de faction), garnison affichée au survol | — |
| **Police** | Postes visibles + indicateur de **Pression** ; zones sous raid en rouge | — |
| **Alertes** (attaque entrante) | Bordure rouge + direction, son | — |

### Commandement

- **Sélection** : clic quartier, **glisser-rectangle** pour sélection multiple.
- **Menu d'ordres contextuel** : Attaquer / Renforcer / Construire / Convertir / (Tueur) — `command.md`.
- **Prévisualisation** avant validation : Influence engagée, pertes estimées, quartiers concernés.
- **Panneau global** : tech (branches), corruption police, diplomatie (factions), journal.

### HUD

- **Ressources** : Produit, Cash sale, Cash propre, **Influence** (+ max).
- **Pression police** + état.
- **Liste des factions** : contrôle %, statut (pacte/embargo/traître), leader.
- **Milestones** : seuil de contrôle %, seuil de Cash propre.
- **Journal** : événements récents (captures, raids, trahisons).
- **Minimap** colorée (factions + police) cliquable.

### Écrans (MVP = 3)

| Écran | Contenu |
|---|---|
| **Sélection de ville** | 3 propositions (profils, postes, factions) |
| **Vue de jeu** | Carte god-view + overlays + HUD + commandement |
| **Récap de fin** | Score, contrôle final, cause, chaîne causale |

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Zoom (tuiles visibles) | large : ~90–200 | à équilibrer |
| Taille minimap | ~220 px | fixé |
| Couleur par faction | 6 couleurs (voir `art-direction.md`) | fixé |
| Prévisualisation | obligatoire avant attaque | fixé |
| Durée du récap | **TBD** | TBD |

## Cas limites

- **Superposition de couleurs** : un quartier contesté doit rester lisible (contour = attaquant, remplissage = propriétaire).
- **Sélection énorme** : borner la taille de sélection pour préserver la lisibilité (`TBD`).
- **Alertes multiples** : prioriser les attaques entrantes (pas de spam visuel).
- **Mode daltonien** : distinguer les factions par **couleur + motif/contour** (`art-direction.md`).

## Dépendances

- `pillars.md` — P5/P6, R4/R6.
- `command.md` — ordres et prévisualisation.
- `territory.md`, `combat.md`, `economy.md`, `tech.md`, `factions.md`, `police-ai.md`.
- `art-direction.md` — palette de factions.
- `scoring.md` / `win-conditions.md` — récap.

## Critères de validation

- [ ] On lit la possession et le contrôle sans ouvrir de menu.
- [ ] On peut donner un ordre par quartier et par lot avec prévisualisation.
- [ ] Le HUD n'est pas un dashboard illisible (hiérarchie claire).
- [ ] Le récap explique la fin de partie sans documentation externe.

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Caméra | god view large (pan/zoom, iso fixe) |
| 2 | Possession | aplat coloré + contour (couleur = info) |
| 3 | Commandement | sélection + ordres contextuels + prévisualisation |
| 4 | HUD | ressources, pression, factions, journal, minimap |
| 5 | Écrans | 3 (sélection, jeu, récap) |

---

## Implémentation (P7) — état en vigueur

> Section **faisant foi** pour `src/App.tsx`, `src/render/*`. Le rendu 3D est en `@react-three/fiber`.

### Écrans (3)

- **Sélection de ville** : 3 propositions (3 seeds → 3 profils), titre + objectif rappelé, clic = lancer.
- **Vue de jeu** : carte god-view + overlays + HUD.
- **Récap de fin** : cause, Cash propre, contrôle, **score + rang**, quartiers pris, gangs éliminés, raids/saisies, durée.

### Lecture de la carte

- **Possession** : aplat translucide (opacité 0.5) **dont la teinte s'assombrit avec le Contrôle**.
- **Quartier attaqué** : **contour** à la **couleur de l'attaquant** (le plus fort), dessiné sur la carte et en **rouge** sur la minimap.
- **Bâtiments** : **icône par type** (8 géométries distinctes — boîte, cylindre, cône, octaèdre… + valeur de gris propre).
- **Sélection** : anneau blanc.
- **Police** : **vignette d'ambiance** dont l'intensité suit la Pression ; passe en **rouge pulsant** quand le joueur est visé et en alerte (raid récent ou `P ≥ 70`).

### HUD

- **Cartel** : Membres, Contrôle, Quartiers, Produit, Cash sale, Cash propre, Production, **Objectif** (seuil de contrôle + Cash propre).
- **Police** : jauge de Pression, palier, cible, raids, bouton **Corrompre**.
- **Factions** : symbole + couleur, tag **leader**, contrôle %, Cash propre.
- **Journal**, **temps restant**, boutons Pause / Nouvelle seed / **Daltonien**.
- **Minimap** cliquable (sélection), raids en rouge.

### Mode daltonien

- Bascule : les factions passent en **valeurs de gris distinctes** (plus de teinte), complétées par un **symbole** par faction dans la légende. Préférence persistée (`localStorage`).

### Écarts avec la cible

- **Sélection multiple** (glisser-rectangle) et **prévisualisation chiffrée** avant attaque : non implémentées (sélection au clic).
- **Alertes sonores** et **marqueurs de pacte/embargo** : non implémentés (pas de diplomatie).
- Le zoom est borné (span 55–260) mais la taille de sélection multiple reste à définir.

---

## Implémentation (P9) — disposition du HUD (zones, sans scroll)

> Section **faisant foi** pour `src/App.tsx` et `src/styles.css`. Le HUD est une **grille plein écran** en surcouche (`pointer-events` seulement sur les panneaux) ; il **ne scrolle pas** en jeu.

### Triage par zone

| Zone | Contenu | Rôle |
|---|---|---|
| **Barre haute** (`topbar`) | Marque + seed, **ressources** (Membres, Produit, Cash sale, Cash propre), **Contrôle**, Quartiers, Production, **objectif** (seuil + Cash propre) et **temps restant** | Toujours visible, lecture d'un coup d'œil |
| **Colonne gauche** (`panel-left`) | **Quartier** sélectionné + **ordres** (bâtir / attaquer / tueur) | Panneau d'**action** contextuel |
| **Colonne droite** (`panel-right`) | **Police** (Pression, cible, raids, corruption), **Tech** (3 branches), **Diplomatie** (relations, pactes, factions fusionnées) | Panneau de **pilotage** |
| **Barre basse** (`panel-bottom`) | **Journal** (3 dernières entrées) + rappel des touches + boutons (Pause / Nouvelle seed / Daltonien) + tick | Ambiance / contrôle, laisse la place à la minimap |
| **Minimap** | Coin bas-droit (hors grille HUD) | Navigation |

### Règles

- La **légende de faction a fusionné** avec la Diplomatie (symbole + couleur + contrôle % + relation + action Pacte/Trahir) pour supprimer un panneau.
- Les **statistiques du cartel** (ex-carte « Cartel ») sont passées dans la **barre haute**.
- La barre basse réserve **~16,5 rem à droite** pour la minimap.
- Vérifié **sans scroll** en 1600×900 et 1366×768 ; `overflow-y: auto` reste en secours sur les colonnes si l'écran est très petit.

---

## Implémentation (P10) — guidage du joueur

> Objectif : **simple mécaniquement, profond tactiquement** — le jeu suggère, le joueur décide.

- **Conseiller contextuel** (haut du panneau gauche) : une seule consigne, priorisée
  (objectif → amorçage **Labo → Point de vente → Façade** → quartiers vides → expansion → blanchiment).
- **Bâtiment conseillé** : la touche `Q` et le bouton surligné suivent la **priorité d'amorçage**,
  puis la **composition cible** (`chooseBuildType`) — mêmes règles que l'IA.
- **Effets lisibles** : chaque bâtiment expose son effet (`BUILDING_EFFECT_LABELS`) en infobulle et
  sous le menu ; le quartier aménagé affiche l'effet en cours.
- **Aperçu d'attaque** : Membres engagés (20 %), Contrôle et **défense ×N** de la cible avant validation.
- **Refus explicité** : « Non adjacent — choisissez un voisin » ou « Membres insuffisants (min 400) »,
  jamais d'échec silencieux.

### Onboarding (P10)

- **Aide** affichée à la première partie (rouvrable via le bouton **Aide**) : but, boucle économique en 4 étapes, conquête, police, touches.
- **Panneau « Boucle »** (barre basse) : `Logement → Membres`, `Labo → Produit`, `Point de vente → Cash sale`, `Façade → Cash propre`, avec compteurs et **étape manquante mise en évidence**.
- **Conseiller** réordonné : capturer un 2ᵉ quartier → Labo → Point de vente → Façade → aménager → étendre → blanchir ; il indique la **ressource manquante** quand un bâtiment est hors de portée.
- **Contraste** : texte secondaire éclairci (`--muted`), coût des bâtiments lisible, boutons désactivés **lisibles** (bordure pointillée au lieu d'une opacité qui écrase le texte), coût en ambre quand il manque des fonds.

---

## Implémentation (P14) — Information, vision et renseignement

> La couleur de possession n'est plus universelle : l'information est **limitée**.

- **Vision de frontière** : le joueur connaît **ses quartiers + leurs voisins**, plus le rayon des **Contre-espionnages** qu'il possède, plus les zones **reconnaissées**.
- **Zone inconnue** : aplat **gris sombre**, ni propriétaire, ni contrôle, ni bâtiment, ni contour d'attaque ; l'infobulle affiche « Inconnu — reconnaissance requise ».
- **Code couleur de la base** : nos quartiers = **couleur pleine et lumineuse** ; connus mais adverses = **discrets** ; inconnus = **masqués**.
- **Renseignement** :
  - **Reconnaître** (bouton sur un quartier inconnu) : coûte **1 500 Cash sale**, révèle un carré de rayon 2 pendant **60 s**, cooldown **30 s**.
  - **Contre-espionnage** : révèle en permanence un rayon de 2 autour de lui (en plus de son effet anti-tueur).
- La **minimap** applique la même règle (inconnu = sombre, notre base = nette, adverses connus = atténués).
