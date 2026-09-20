# Art Direction — N&B fonctionnel + couleurs de faction (DealerFront)

> Statut : **v1 (DealerFront)** — ajoute les **couleurs de faction** (information de possession) tout en gardant le N&B brutaliste.

## Objectif

Fixer la direction artistique : ville en **niveaux de gris** (brutaliste, chanfreiné), et **couleur strictement informative** — désormais utilisée pour la **possession de faction** et les alertes.

## Règles

- Le **terrain et le bâti** restent en **gris** (pas de couleur décorative).
- La **couleur est de l'information** : possession de faction, alertes, signaux fonctionnels.
- **Une seule teinte active par élément** (pas de superposition de sens).
- Style : **low-poly chanfreiné**, masses de béton, arêtes adoucies (esprit brutaliste).

### Échelle de gris (environnement)

Idem mode précédent : 9 pas de `#0E1013` → `#F2F4F7`, contraste élevé, gris froids.

### Couleurs fonctionnelles

| Élément | Traitement | Signification |
|---|---|---|
| **Possession de faction** | Aplat **translucide** coloré + contour net sur les quartiers | Propriétaire du quartier |
| **Joueur** | Couleur de faction du joueur, contour plus marqué | « vous » |
| **Quartier neutre** | Gris (aucun aplat) | Sans propriétaire |
| **Contrôle** | Remplissage plus ou moins opaque selon le Contrôle (0–100) | Solidité de la possession |
| **Police / raid** | **Rouge** réservé à l'alerte/raid | Danger immédiat |
| **Pression police** | Ambiance (vignette/teinte) progressive | Tension montante |
| **Pacte / traître** | Marqueur dédié (icône/contour) | Statut diplomatique |

### Palette de factions (6)

Proposée (à affiner en phase artistique), **distincte aussi en niveaux de gris** (valeurs différentes) :

| # | Nom | Hex (indicatif) | Gris équivalent |
|---|---|---|---|
| 1 | Joueur | `#6FB7E8` (bleu) | clair |
| 2 | Gang A | `#E0A030` (ambre) | moyen-clair |
| 3 | Gang B | `#7FD08A` (vert) | moyen |
| 4 | Gang C | `#A97BD8` (violet) | moyen-sombre |
| 5 | Gang D | `#E23B2E` (rouge) | sombre |
| 6 | Gang E | `#2FB0A0` (turquoise) | moyen |

- Les aplats sont **translucides** (≈ 35 %) + **contour opaque** pour rester lisibles sur le N&B.
- **Mode daltonien** : ajouter un **motif** (hachures/pointillés) par faction, la couleur ne suffisant pas.

### Shading

- 3 tons + ombres portées, ambiante basse / directionnelle forte (contraste franc, brutaliste).

## Paramètres chiffrés

| Paramètre | Valeur | Statut |
|---|---|---|
| Échelle de gris | 9 pas `#0E1013`→`#F2F4F7` | fixé |
| Aplat de possession | ~35 % d'opacité + contour 1–2 px | à équilibrer |
| Palette factions | 6 couleurs (ci-dessus) | à affiner |
| Motif daltonien | 6 motifs distincts | à définir |
| Ambiance pression police | opacité de vignette ∝ Pression | à équilibrer |

## Cas limites

- **Quartier contesté** : remplissage = propriétaire, contour = attaquant (ne pas mélanger).
- **Foule de factions** : au-delà de 6, prévoir des variantes (teinte + motif).
- **Lisibilité N&B** : test en niveaux de gris seuls — la possession doit rester distinguable (via valeurs/motifs).
- **Couleur de police (rouge) vs faction rouge** : si une faction est rouge, réserver une variante (rouge désaturé) ou un motif pour la police.

## Dépendances

- `pillars.md` — P6/R5.
- `ui-ux.md` — overlays, légende, mode daltonien.
- `territory.md` / `factions.md` — possession et statuts.

## Critères de validation

- [ ] Aucune couleur purement décorative.
- [ ] La possession est lisible (couleur + contour) sans masquer le terrain.
- [ ] Les 6 factions sont distinguables en N&B (valeurs/motifs).
- [ ] La police/alerte reste prioritaire visuellement.

## Décisions tranchées (log)

| # | Question | Décision |
|---|---|---|
| 1 | Couleur | informative (possession de faction) |
| 2 | Aplat | translucide + contour, opacité ∝ Contrôle |
| 3 | Factions | 6 couleurs + motifs (daltonien) |
| 4 | Rouge | réservé police/alerte |
| 5 | Style | brutaliste chanfreiné conservé |

---

## Implémentation (P7) — état en vigueur

> Section **faisant foi** pour `src/render/*` et `src/styles.css`.

- **Environnement** : ville en niveaux de gris chanfreinés (`CityMeshes`, `palette.ts`, 9 pas de gris).
- **Possession** : aplat coloré translucide (opacité 0.5), **assombri selon le Contrôle** (`0,45 + 0,55 × contrôle`).
- **Contour d'attaque** : anneau carré à la **couleur de l'attaquant** (quartier contesté : remplissage = propriétaire, contour = attaquant).
- **Icônes de bâtiments** : 8 formes (boîte / cylindre / cône / octaèdre) + 8 valeurs de gris → lisibles sans couleur.
- **Rouge** : réservé aux **alertes** (contours d'attaque sur la minimap, vignette en alerte).
- **Pression police** : vignette d'ambiance (teinte ambre) d'opacité ∝ Pression ; **rouge pulsant** en alerte.
- **Mode daltonien** : remplace les teintes par des **valeurs de gris distinctes** + **symboles** (`FACTION_SYMBOLS`).

### Écarts avec la cible

- **Motifs** (hachures/pointillés) non implémentés : le mode daltonien joue sur **valeur + symbole**.
- Variante de rouge si une faction est rouge : **non traitée** (la faction rouge reste `#E23B2E`).

---

## Implémentation (P16) — pastel, code couleur et animations

- **Factions** : palette **pastel** (`#8FC7E8`, `#E8C57A`, `#8FD8A5`, `#B79DE0`, `#E88C80`, `#6FD0C4`) sur la carte, la minimap et les pastilles UI.
- **Bâtiments de cartel colorés par type** (`BUILDING_COLORS`) : Labo vert, Point de vente ambre, Façade rose, Planque lilas, Dépôt beige, Atelier bleu ciel, Contre-espionnage rouge poudré, Recrutement gris-bleu. La **forme** reste distincte (cylindre/cône/octaèdre…).
- **Grille de quartiers** : contour discret sur chaque module → la structure de la ville est lisible.
- **Frontières** : contour épais coloré là où deux propriétaires se touchent (façon OpenFront).
- **Animations** : contour de **siège** qui pulse (couleur de l'attaquant), **flash** à la capture, **croissance** du chantier puis **pop** à la livraison du bâtiment.
- **Ville** : gris doux, silhouettes par zone (gradins, enseignes, néons, cheminées).

---

## Implémentation (P25) — Système d'icônes

- **Source unique** : `lucide-react` (ISC, déjà installé), tracés `currentColor` — la couleur vient de la faction ou de l'état, jamais d'un décor (R5).
- **Une action = un logo** : tout bouton d'action porte une icône, **jamais du texte seul**.
- Les symboles de faction (`●■▲◆`) restent, complétés par la couleur ; le **mode daltonien** conserve gris + symbole.
