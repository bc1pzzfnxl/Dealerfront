# Dealer RTS — Synthèse Gamedesign : 30 min, façon OpenFront, Économie de guerre

> Cible : partie **25–35 min (médiane 30 min)**, 6 cartels sur Paris IRIS (992 quartiers), battle royale, dernier survivant.
> Référence principale : **OpenFront** (peinture de territoire, % engagé, expansion, goulots) + surcouche **économie de guerre** (produit → sale → propre) + **convois de drogue** + **police**.
> État actuel déduit du client : boucle fonctionnelle mais illisible, snowball 40%, cooldown hitman unique, Q indécouvrable, lexique module/quartier.

---

## 1. Vision en une phrase

**Peindre Paris en 30 minutes : ton économie finance ta guerre, tes convois nourrissent ton front, la police punit les gourmands.**

### Piliers (non-négociables)

1. **Expansion lisible** comme OpenFront : 1 geste = attaquer, 1 chiffre = % engagé, 1 couleur = à qui appartient quoi.
2. **Économie de guerre, pas tableur** : 3 flux visibles/s, 0 calcul mental, tout est un débit.
3. **Convois physiques** : la drogue se déplace sur la carte, se vole, se coupe. Pas de téléportation magique.
4. **Police comme 7e joueur** : Heat local + Pression globale avec seuils affichés.
5. **Fin en 30 min garantie** : horloges de mort convergentes, pas de turtle infini.

### Anti-piliers

- Pas de micro RTS classique (pas de pathing d'unités).
- Pas de slider comptable sans prédiction.
- Pas de « non » sans « voici comment faire oui ».

---

## 2. Ce qu'on vole à OpenFront (et ce qu'on refuse)

### À copier

| Mécanique OpenFront | Adaptation Dealer RTS |
|---|---|
| % de troupes engagées à l'attaque | **Curseur Rush 10–80%** : % des Membres envoyés à l'assaut. Le reste défend. Afficher en live : `Attaque 120 (40%) / Défense restante 180`. |
| Peinture + % carte en topbar | Garder `Part carte / Quartiers / Membres/s`, mais ajouter **Rang live 1–6** et **leader**. Motivation battle royale. |
| Fronts faibles = cibles naturelles | `Attaque auto le voisin le plus faible` devient une **option**, pas le défaut. Défaut = je choisis. |
| Goulots / montagnes | Paris : Seine, périph, parcs = **ralentisseurs de siège**. Zonage existant (`Vie nocturne`, `Terrain vague`, `Friche`) devient tactique, pas juste bonus éco. |
| Parties < 30 min par attrition | Théorème OpenFront : le nº1 est gang-bangé. À reproduire via **butin dégressif + Heat du leader**. |

### À refuser

- Expansion gratuite infinie : OpenFront a le coût en troupes, nous on a **triple coût** (Membres + Contrôle à vider + Heat). Ne pas empiler les 3 sans les afficher.
- Diplomatie vide : si pacte = juste exclusion du rush auto, **le supprimer**. Pacte doit = non-agression + vision partagée 60s + trahison marquée.

---

## 3. Pacing 30 minutes — la partition cible

Hypothèse tick : 10 ticks/s (à confirmer dans `tick`). Tous les temps ci-dessous en temps réel.

```
00:00–03:00  INSTALLATION   3 quartiers, 1 labo + 1 PdV reliés, 1 façade. 0 guerre.
03:00–10:00  EXPANSION      3 → 10 quartiers. Premiers convois. 1er event. Police : avertissements.
10:00–20:00  GUERRE ÉCO     10 → 25 quartiers. 1er cartel éliminé. Raids police ciblés. Pics 13h/23h exploités.
20:00–27:00  ATTRITION      3 cartels restants. Leader à 35%+ carte = Heat x2 + embargo auto. 2e élimination.
27:00–32:00  FINALE         1v1. Contrôle regen divisé par 2 (anti-turtle). Liquidation ou dernier survivant.
```

### Leviers de durée (pour tenir 25–35)

- **Regen Contrôle** : base 4/s, divisée par 2 après 20:00, par 3 après 27:00. Empêche le stall.
- **Coût d'expansion** : siège = `Contrôle 100 + Défense`. Si partie > 32 min, `Contrôle max` passe de 100 → 70 (quartiers plus faciles à prendre).
- **Trésorerie à zéro** : actuel `trop longtemps` opaque → **90s de découvert autorisé avec compte à rebours visible**, puis liquidation. Pas de mort surprise.
- **Police finale** : à 25:00, `Raid multiple` sur top 1 et 2 systématique. Accélère la fin.

KPIs à logger : `T50% (temps pour 50% éliminations)`, `temps médian victoire`, `% victoires police vs joueur vs IA`, `écart-type durée`. Cible : médiane 29–31 min, P90 < 36 min.

---

## 4. Économie de guerre — débits cibles pour 30 min

### Chaîne unique (à marteler en onboarding)

```
Labo (Produit/s) --convoi--> PdV (Produit → Cash SALE) --façade--> Cash PROPRE
Membres ← Recrutement (soir) ← Cash PROPRE + Planque
Tech (Armement / Blanchiment / Contre-espionnage) ← Cash PROPRE + temps
Guerre ← Membres + Cash SALE (ops) + Cash PROPRE (bâtiments)
```

Règles verrous actuelles à garder :
- `1 bâtiment / quartier`.
- `Vente doit être reliée à un labo par chemin possédé`, sinon malus (actuel ~65% / invisible → passer à **0% + icône rouge**, pas de demi-mesure illisible).
- `Coût croissant +35% / même type` → garder mais **afficher le prochain prix sur le bouton** (`+35% : 800 → 1080`), pas dans l'aide.

### Débits cibles (ordre de grandeur pour 30 min)

| Bâtiment | Rendement de base (à 100% zone + heure neutre) | Coût base | Note |
|---|---|---|---|
| Labo | 1.2 Produit/s | 600 propre + 20 membres | Boost x1.6 en Friche |
| Point de vente | convertit 1.0 Produit/s → 90 Sale/s | 400 propre + 15 membres | Boost x1.5 Vie nocturne / riche, x1.3 pic 13h |
| Façade | blanchit 60 Sale/s → 54 Propre/s (taxe 10%) | 500 propre + 10 membres | Boost x1.4 zone commerciale |
| Planque | +0.8 Membre/s + 20 défense locale | 500 propre | Cap 2000 membres gardé |
| Guetteur (contre) | 1 = anti-sabotage, 2 = anti-descente (rayon 1) | 350 propre | Rendre le rayon visible |
| Poste (anti-police) | -0.5 Heat/s zone | 450 propre | Nouveau / à extraire du « poste de police » passif |

Stock 30 min visé : un joueur moyen qui tient 12 PdV reliés à 4 labos sort ~800 Sale/s pic, ~400 Propre/s après blanchiment. De quoi payer 1 bâtiment/45s + 1 op/60s + expansion continue. Si > 2x, nerf prix, pas rendement (le fantasme = gros chiffres).

### Membres / Troupes façon OpenFront — gains, pertes, cap (cœur 30 min)

Non, la v1 ne le modélisait pas assez : `2000 membres max` fixe + `+X/s` plat = pas de lien territoire → armée, donc pas de dilemme OpenFront (s'étaler pour grossir vs se densifier pour défendre). Voici la règle cible :

**Formule cap (à afficher `1420/1800 +11/s`) :**

```
Cap = 150 (base) + 60 x Quartiers possédés + 400 x Planque (max 3 comptées) + 100 x Niv. Recrutement
Exemple : 10 quartiers + 1 planque = 150 + 600 + 400 = 1150 cap.
20 quartiers + 2 planques = 150 + 1200 + 800 = 2150 → clamp 2500 absolu.
```

- Peu de quartiers / peu de bâtiments = petite armée, mécanique voulue : punir le turtle à 3 quartiers qui tech dans son coin.
- Perdre un quartier = cap qui baisse instantanément. Si `Membres > Cap` → **Sur-effectif** : -2%/s par désertion + `Membres/s` à 0 jusqu'à retour sous cap. Afficher en rouge. Ça rend les pertes de territoire douloureuses comme dans OpenFront.
- Planque détruite = double peine : -400 cap + -défense locale. D'où l'intérêt de les excentrer / protéger par guetteurs.

**Gains (flux/s, à lire en topbar) :**

```
Recrutement/s = 0.4 (base) + 0.25 x Quartier résidentiel + 0.8 x Planque + bonus soirée x1.8 (20h–23h)
Butin membres = 30% des défenseurs survivants du quartier capturé (ex-quartier ennemi rejoint)
Event / Contact : +50 ponctuel max, jamais plus (évite le jackpot qui casse les 30 min)
```

- Pas de don gratuit au spawn après 3:00 : sinon comeback infini.
- Overflow à 95% cap → alerte `Recrutement saturé — attaquez ou construisez Planque`, sinon gaspillage invisible actuel.

**Pertes (là où se joue OpenFront) :**

| Cause | Règle cible | Intent |
|---|---|---|
| Siège attaquant | 0.8 membre/s/100 Contrôle restant + 0.5 x Défenseurs/s | Attaquer un gros stack coûte cher, comme envoyer 40% dans un mur |
| Siège défenseur | 0.6 x Assaillants/s, min 1/s | Défendre saigne aussi, pas de hold gratuit |
| Neutre | 50% des pertes vs ennemi | Encourage l'expansion early, punit la guerre early |
| Op (Raid/Descente/Interception) | coût fixe payé avant (25/40/30, cf §8) + 10% des engagés si échec | Échec = double taxe |
| Raid police | -15% membres du quartier visé + bâtiment endommagé | Police comme reset anti-snowball |
| Sur-effectif | -2%/s désertion | Cap mordant |
| Banqueroute | -1%/s désertion globale si `Propre+Sale < 200` pendant 90s | L'éco finance la solde, sinon l'armée fond |

**Défense répartie (le % Rush) :**

- `Curseur Rush 10–80%` = part des Membres totaux projetable en attaque simultanée. Le reste est auto-réparti sur les quartiers frontières (pas les safe de l'arrière, contrairement à l'actuel).
- Bonus défenseur x1.25 + `planqueDefense` locale + `defenseBonus` de faction. Attaquant doit donc engager ~1.5x pour passer vite — même ratio qu'OpenFront.
- 2 attaques simultanées max (fronts), la 3e file en `File d'ordres`. Évite le multi-front ingérable sur 992 IRIS.

**Ce que ça change pour tenir 30 min :**

- Early (0–10 min) : cap ~500–900 → petites escarmouches à 100–200, pas de one-shot.
- Mid (10–20 min) : cap ~1200–1800 → vraies descentes à 400–600, 1er cartel tombe parce qu'il ne peut pas défendre 3 fronts.
- Late (20–30 min) : cap ~2000–2500 → 1v1 à 1500 vs 1500, mais regen Contrôle nerfée (§3) + Heat leader x2 empêchent le turtle.
- Si test > 35 min : baisser `60/quartier → 45/quartier` (moins d'armées = parties plus lentes ? non, l'inverse : moins de défense = sièges plus rapides). Si test < 25 min : monter défenseur x1.25 → x1.4.

### Tech (3 branches, 3 niveaux max, pas plus)

- Armement : débloque Descente N1, Sabotage N2, Interception N2, -20% coût ops N3.
- Blanchiment : +15% vitesse façade / niveau, -10% taxe.
- Contre-espionnage : +1 rayon guetteur N2, alerte raid 20s avant N1 (indispensable).
Coût : 800 / 1600 / 3200 propre + 30s chantier. Un seul chantier tech à la fois (choix).

---

## 5. Expansion façon OpenFront — règles proposées

1. **1 geste attaquer** : clic quartier ennemi/neutre adjacent → panneau `Attaquer [Q]` avec gros bouton. Q = raccourci, pas unique entrée.
2. **Adjacence stricte** au début, **Tête de pont** N2 Armement : 1 attaque non-adjacente / 3 min (évite l'enfermement spawn).
3. **Siège** : `Contrôle 100`, dégâts = `Membres engagés x 0.8/s - Défense x 0.5/s`. Regen 4/s hors combat. Quartier `se remplit de blanc` gardé + **chiffre** `72/100`.
4. **Capture** : neutre = gratuit (juste siège), ennemi bâti = **butin 20% (pas 40%)** + 60s de `Contesté` (re-prenable facilement, anti-razzie éclair). Le 40% actuel snowball trop.
5. **1 bâtiment / quartier gardé**, mais **file d'ordres `kz` et chantiers simultanés `Oz` affichés** (`File 2/5`, `Chantiers 1/2`) + `playerBatchBuild` renommé `Tout construire` avec preview `+6 bâtiments : -2400 propre -90 membres`.
6. **Zonage** : 5 zones max, 1 bonus chacune, picto permanent sur carte (pas que dans tooltip) :
   - Friche → Labo x1.6
   - Vie nocturne / riche → PdV x1.5
   - Commercial → Façade x1.4
   - Résidentiel → Recrutement x1.5
   - Administratif → Heat +50% (risque), à éviter sauf challenge

Erreurs à transformer en guides : `non adjacent / zone incompatible / quartier occupé / membres insuffisants / fonds insuffisants` → bouton grisé avec raison + **fantôme du prochain slot valide**.

---

## 6. Convois de drogue — le cœur à construire

État actuel : `convoys.find(to)`, `stealCargo produit/sale x stealRatio`, `intercept + disrupt 30s`. Bien mais invisible.

### Proposition : convois physiques obligatoires

- Tout Produit doit voyager **Labo → PdV** par convoi auto toutes les 15s, chemin = plus court en quartiers possédés.
- Visual : point animé sur la carte (réutiliser `floaters`, cap 24 → passer à 40 juste pour convois).
- Capacité : 30 Produit / convoi N0, 60 N2 logistique (nouvelle tech ou niveau Façade ? Non : niveau Planque).
- Si chemin coupé (quartier perdu) → convoi **bloqué, icône rouge**, Produit stocké au labo (cap 500, overflow perdu → incite à défendre les corridors).
- **Interception** : cliquer un convoi ennemi adjacent → coûte Membres, vole `stealRatio 30%`, coupe la ligne 30s (`sabotageUntil`). Cooldown **séparé** des autres ops (voir §8).
- **Convoi de cash** ? Non pour 30 min : trop de micro. Le cash reste abstrait instantané. Seul le Produit voyage.

Ça donne la géographie OpenFront : corridors, goulots (Seine), embuscades, et une raison de ne pas s'étaler en pieuvre.

---

## 7. Police : Heat + Pression lisibles

Actuel : `addHeat`, `pressure max`, `-12 Pression`, `+8 Pression`, raids `les plus chauds`.

### Règles cibles

- **Heat 0–100 / quartier** : +12 par construction, +20 par op, +8 par convoi intercepté chez toi, -0.5/s base, -2/s avec Poste, -X si `Contact fait baisser la Pression`.
- **Pression 0–100 globale** : moyenne des 5 Heats max + 10 par cartel éliminé (la police se concentre sur toi).
- Seuils affichés avec jauge :
  - Heat > 70 = **À risque** (icône flamme, tooltip `Raid possible`)
  - Pression > 60 = **Raid ciblé** possible dans 30s (telegraphing)
  - Pression > 85 = **Raid multiple + Liquidation** possible
- Contre-jeu : `Acheter indicateur -12 Pression (-6000 sale)` vs `Faire taire +6000 mais +8 Pression` (coût moral actuel inversé à corriger : faire taire devrait coûter **2000 propre + 8 Pression**, pas rapporter).
- **Postes de police refroidissent leur zone** : afficher le rayon froid en bleu. Construire à côté = hard mode volontaire.

---

## 8. Opérations — sortir du cooldown unique

Actuel : `hitmanCooldown` partagé pour Raid/Descente/Sabotage/Interception → faux choix.

### Cibles

| Op | Coût | Effet | Cooldown propre | Contre |
|---|---|---|---|---|
| Raid (tueur) | 800 sale + 25 membres | Détruit bâtiment, Contrôle -30, pas de capture | 90s | 1 guetteur : -50% dégâts (pas immunité) |
| Descente | 500 sale + 40 membres | Vole butin 20% + capture si Contrôle < 30 | 75s | 2 guetteurs = échec (affiché avant) |
| Sabotage | 400 sale | -50% rendement 60s | 60s | 1 guetteur = échec (affiché avant) |
| Interception | 30 membres | Vole 30% convoi + coupe 30s | 45s | Escorte (N2 Armement : 10 membres protègent) |

- **Pré-check affiché avant paiement** : `2 guetteurs — Échec probable`. Ne jamais faire payer un échec binaire caché (`Descente éventée` actuelle).
- `15% tueur`, `alerte les descentes`, `gêne descentes` (bonus actuels) à fusionner en **1 stat Discrétion** (Tech + Contacts).

---

## 9. Événements, Contacts, Diplo — rythme 30 min

- Events : actuel `tick<600, %1200, 50%` → garder le rythme (~toutes les 2 min après 1 min), **mais file max 1 + timer 45s** (pas d'exploit pause). 3 events actuels bons (`Livraison 3500 sale vs 4000 propre`, `Indicateur`, `Façade`), ajouter 2 guerre : `Taupe (vision 30s vs +Heat)` et `Embargo (-20% prix voisin vs guerre)`.
- Contacts (`Serpent / Comptable / Vieux / Frisé`) : 1 à la fois, **bonus passif + mission** (`Tech $`, `fait baisser Pression`, `propose pacte`). `Contact grillé` après 5 min → rotation forcée. Lisible.
- Pactes : max 1 à la fois, 3 min, **non-agression + vision**, trahison = `Embargo déclaré` + Heat +15 (tout le monde voit). `Pacte refusé / trahit $` loggé au journal.

---

## 10. Win / Lose — fermer la partie

- Victoire : `Dernier cartel` (toujours) + **Victoire économique** à 30:00 si 2+ survivants : plus gros `Propre cumulé + carte` gagne (évite prolongations infinies).
- Défaites : `Éliminé` (0 quartier), `Liquidation policière` (Pression 100 pendant 60s), `Banqueroute` (trésorerie propre+sale < coût PdV pendant 90s, timer visible).
- Écran fin : `Quartiers pris / Gangs éliminés / Raids subis / Temps de survie / Dernier survivant` (déjà là) + **courbe éco + carte finale + seed**. Bouton `Nouvelle partie / Nouvelle seed` gardé.

---

## 11. UX — passer d'illisible à OpenFront-net

1. Topbar 5 chiffres max : `Sale/s | Propre/s | Membres +/s | Carte % (Rang) | Pression`. Le reste en tooltip. Actuel `stock labos / à blanchir / propre / carte / quartiers / membres/s / en jeu` = 7, trop.
2. Bouton **ATTAQUER** + curseur Rush avec live défense. Q en secondaire.
3. Carte : 3 couches commutables (Territoire / Heat / Logistique convois). `Mode daltonien` existant à étendre aux 3 couches.
4. `File d'ordres`, `Journal`, `Comment jouer` : journal filtrable (Éco / Guerre / Police), aide en 3 missions interactives, pas mur de texte.
5. `Relancer / Nouvelle seed / couper le son` gardés. `API $` : exposer seed + stats pour debug équilibrage.

---

## 12. Plan d'équilibrage 25–35 min (prochaines itérations)

- [ ] Séparer `hitmanCooldown` en 4 cooldowns (90/75/60/45s).
- [ ] Butin 40% → 20% + état Contesté 60s.
- [ ] Convois visibles + Interception dédiée.
- [ ] Jauges Heat/Pression + telegraphing raid 20–30s.
- [ ] Timer banqueroute 90s visible + victoire éco à 30:00.
- [ ] Regen Contrôle dégressive 20:00 / 27:00.
- [ ] Pré-check guetteurs + prix suivant +35% sur boutons.
- [ ] Telemetry : durée, T50%, causes de fin, revenus/s à 10/20/30 min. Ajuster coûts ±15% jusqu'à médiane 30 min.

---

*Fichier généré pour cadrage 30 min — base : analyse statique du bundle actuel + textes FR in-game. À valider par 5 runs instrumentées.*
