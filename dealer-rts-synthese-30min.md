# Dealer RTS — Feedback Complet + Synthèse Gamedesign 30 min

> **Analyse basée sur** : lecture du bundle `index-C07yph_X.js` (1.69 Mo), extraction des constantes/formules du code.
> **Cible** : partie 25–35 min (médiane 30 min), 6 cartels, Paris IRIS 992 quartiers, battle royale.
> **Référence** : OpenFront (peinture territoire, pertes troupes, expansion) + économie de guerre + convois drogue + police.

---

## 0. État actuel du code — constantes extraites

### Données de départ (par faction, `AR`)

| Ressource | Valeur initiale |
|---|---|
| Membres | 3 000 |
| Produit | 0 |
| Cash sale | 2 000 |
| Cash propre | 1 000 |
| Tech (armement/protection/logistique) | 0/0/0 |
| Ratio d'attaque | 20% fixe |
| Ratio blanchiment | 50% |
| Embargos subis | 0 |

### Bâtiments (`lR` — coûts et effets)

| Bâtiment | Coût propre | Coût membres | Effet par tick |
|---|---|---|---|
| logement | 800 | 0 | +25 demandeur × rush factor |
| labo | 600 | 20 | +1.5 produit/tick (× zone + sabotage) |
| vente | 500 | 15 | consomme 2 produit/tick → +60 sale/produit |
| façade | 500 | 10 | blanchit 60 cash sale → propre (−25% commission) |
| planque | 500 | 0 | +2 000 cap membres, +1.5× défense locale |
| guetteur (contre) | 350 | 0 | −15% dégâts attaquants/unité (max 60%), anti-sabotage |
| dépôt | 400 | 0 | +2 000 cap membres |
| atelier | 400 | 0 | Débloque 1 niveau de tech (max par atelier) |

**Coût croissant** : `baseCost × 1.35^nombreExistants × discountConversion`

### Zones et bonus (`xR`)

| Zone | Bâtiment boosté | Multiplicateur |
|---|---|---|
| résidentiel | logement | ×1.5 |
| commercial | vente | ×1.5 |
| nuit | vente | ×1.3 |
| industriel | labo | ×1.5 |
| blanchi | façade | ×1.6 |
| police | guetteur | ×1.6 |
| parc | planque | ×1.5 |

### Heures de pointe (`CR`)

| Zone | Type | Pic | Amplitude |
|---|---|---|---|
| commercial | vente | 13h | +40% |
| nuit | vente | 23h | +50% |
| résidentiel | logement | 19h | +30% |
| industriel | labo | 02h | +20% |
| blanchi | façade | 11h | +15% |

Formule : `facteur = 1 + amplitude × cos(2π × (heure - pic) / 24)`

### Recrutement

```
recrues = (8 × recruitDemand + 25 × housingDemand × sabotageFactor(logement))
          × (1 - membres/maxMembers)
          × (1 + 0.2 × logistique_level)
```

**Cap membres** : `maxMembers = 2000 + modulesOwned×1500 + logement×2000 + dépôt×2000`

### Opérations (coûts exacts du code)

| Opération | Coût | Effet | Cooldown |
|---|---|---|---|
| Raid (`Iz`) | 2 500 sale + 800 membres | −35 Contrôle, détruit bâtiment, annule construction | 300 ticks (30s) |
| Descente (`Mz`) | 2 000 sale + 600 membres | Vole 40% valeur bâtiment (20% si 1 guetteur, 0 si 2+) | 250 ticks (25s) |
| Sabotage (`Nz`) | 1 500 sale | −50% rendement 300 ticks (30s) | 250 ticks (25s) |
| Interception (`zz`) | 500 membres | Vole 25% convoi + coupe 250 ticks | 300 ticks (30s) |
| Tueur à gage (`cz`) | 3 000 propre + 1 000 membres | −40 Contrôle centre, −20 Contrôle voisins, détruit bâtiments | 100 ticks (10s) |

**Cooldown unique** : `hitmanCooldown` partagé entre Raid, Descente, Sabotage, Interception, Tueur.

### Système de combat

```
envoyés = floor(membres × 0.20)   // Sz = 20% fixe, pas de curseur
minimum = 400 membres             // Fz
travelTime = 12 ticks             // 1.2s
maxAttaquesSimultanées = 4        // Dz

dégâts/tick = min(5, max(0.5, envoyés × 0.0004 × attackPower / baseDefense))
pertes/tick = dégâts × 8         // Tz = 8

baseDefense = zoneDef × planqueDef × (1 + defenseBonus) × traitorMod
attackPower = 1 + 0.1 × armement_level

régén contrôleur = (1 + 0.2 × logistique) × 1.2   // hors combat
```

**Valeurs de défense par zone** : résidentiel=1.0, commercial=1.2, nuit=1.1, industriel=0.8, parc=1.4, police=2.0, blanchi=1.0, vacant=0.5.

**Capture** : contrôle ≤ 0 → quartier pris avec `contrôle = clamp(8, 48, 16+26×survivants)`

**Encerclement** (tous les 5 ticks) : si groupe ≥8 quartiers, <35% du total faction, entièrement encerclé → tout bascule, contrôle=30.

### Police

```
pressionChange = 0.02 × dominationRatio + 0.0015 × crime − 0.002
dominationFloor = max(0, ownedLeader/totalModules − 0.8) × 250
```

| Seuil | Niveau | Effet |
|---|---|---|
| <40 | Surveillance | Aucun |
| ≥40 | Raid | 1 module touché, −25 Contrôle, cooldown 600 ticks |
| ≥70 | Crackdown | 3 modules touchés + 10% cashPropre saisi |
| ≥95 | Liquidation | Élimination du joueur |

**Corruption** : `coût = min(1 000 000, 3 000 × 1.8^uses)`, −20 Pression, 15% backlash (+10 Pression).

### Score

```
score = modulesOwned × 1 000 000 + membres + cashPropre × 0.001
```

### Événements aléatoires (toutes les 1 200 ticks après 600, 50% chance)

| Event | Choix A | Choix B |
|---|---|---|
| Livraison risquée | +3 500 sale, heat ×3 | +4 000 propre |
| Indicateur parle | −6 000 sale, −12 Pression | +6 000 total, +8 Pression |
| Façade concurrente | Façade gratuite | +5 000 sale |

### Conditions de fin

| Condition | Issue |
|---|---|
| 0 quartier | Défaite |
| 1 seul cartel restant | Victoire |
| cashPropre=0 ET cashSale=0 pendant 300 ticks | Défaite (faillite) |
| Pression ≥95 | Défaite (liquidation) |

---

## 1. Feedback play-test — ce que j'ai ressenti (simulé par lecture code)

### 0-30s : Lancement

- Accroche forte : « Le cartel sur la vraie carte de Paris, 992 quartiers, 6 cartels, battle royale ».
- **Problème** : 3 000 membres + 2 000 sale + 1 000 propre. Aucune idée de ce que ça vaut. Pas de jauge comparative.
- 6 factions : Cartel (moi), Gang Nord/Est/Sud/Ouest, Syndicat. **Personnalité nulle** — même arbre IA, même skin.

### 1-5 min : Premiers clics

- Je place un labo. Il produit 1.5 produit/tick = **900 sale/s**. Mon labo coûte ~600 propre. **ROI en 0.7 seconde.** Absurde.
- Je place une vente. Elle consomme 2 produit/tick → +120 sale/tick. **En 10 secondes, 12 000 sale.** L'argent ne manque jamais.
- Le `launderRatio` est un slider à 50% que je ne vois pas. 1000 sale tentés → 500 blanchis → 375 propre. **Je perds 62.5% de valeur sans le savoir.**

### 5-15 min : Combat

- Je clique attaquer sur un quartier voisin. 20% de mes troupes sont envoyées (fixe, pas de curseur). 600 membres partent. **Pas de feedback visuel.**
- Dégâts : 0.24/tick contre 100 Contrôle. **41.6 secondes pour capturer un quartier neutre.** Le défenseur ne fait rien. Pas de combat, juste un timer.
- Je lance un Raid : −2 500 sale − 800 membres pour −35 Contrôle et bâtiment détruit. **Je perds plus que ce que je gagne.** La Descente vole 40% et coûte moins.
- **Le cooldown unique** (`hitmanCooldown`) me bloque pendant 30 secondes après chaque opération. **Je ne peux faire QU'UNE action toutes les 30 secondes dans un RTS.** C'est étouffant.

### 15-25 min : Police

- Ma Pression monte. Je vois un raid à Pression ≥40 : 1 module, −25 Contrôle. Gérable.
- À ≥70 : 3 modules touchés + 10% cashPropre saisi. **Là ça pique.**
- À ≥95 : **mort instantanée.** Pas de timer, pas de warning. 95 = dead.
- **Le problème critique** : `dominationFloor = (ownedLeader/totalModules − 0.8) × 250`. Si je possède 80%+ de la carte, la Pression monte de **5/s minimum**. De 40 à 95 = **11 secondes pour mourir**. Le leader est puni de sa victoire en ~10s.

### 25-30 min : Fin de partie

- Si 2 joueurs survivent → **stalemate infini**. Pas de timer de fin. Pas de victoire économique à 30 min.
- Le score `modulesOwned × 1 000 000` veut dire que la seule chose qui compte, c'est le nombre de cases. L'économie est accessoire.

---

## 2. Top 5 des bugs critiques (du code)

| # | Bug | Impact | Fix |
|---|---|---|---|
| 1 | **Cooldown unique** pour 5 opérations | 1 action/30s, RTS immobile | 5 cooldowns séparés |
| 2 | **Leader meurt en 11s** (dominationFloor × 250) | Le meilleur joueur perd automatiquement | Baisser dominationFloor ou plafonner à 60 |
| 3 | **Pas de pertes mutuelles** en siège | Attaquer = timer, pas combat | Les défenseurs infligent des pertes aux assaillants |
| 4 | **ROI absurdement rapide** (labo en 0.7s) | Pas de tension économique | Coûts ×10 ou rendements ÷10 |
| 5 | **20% d'attaque fixe** | Pas de choix tactique | Curseur Rush 10-80% |

---

## 3. Vision en une phrase

**Peindre Paris en 30 minutes : ton économie finance ta guerre, tes convois nourrissent ton front, la police punit les gourmands.**

### Piliers (non-négociables)

1. **Expansion lisible** comme OpenFront : 1 geste = attaquer, 1 chiffre = % engagé, 1 couleur = à qui appartient quoi.
2. **Économie de guerre, pas torrent** : tension sur l'argent, choix entre investir et attaquer.
3. **Convois physiques** : la drogue se déplace sur la carte, se vole, se coupe.
4. **Police comme 7e joueur** : seuils lisibles, telegraphing, pas de mort surprise.
5. **Fin en 30 min garantie** : victoire économique ou attrition.

---

## 4. Pacing cible 30 minutes

```
00:00–03:00  INSTALLATION   3 quartiers, 1 labo + 1 PdV. Zéro guerre.
03:00–10:00  EXPANSION      3 → 10 quartiers. Premiers convois. 1er event.
10:00–20:00  GUERRE ÉCO     10 → 25 quartiers. 1er cartel éliminé.
20:00–27:00  ATTRITION      3 restants. Leader Heat×2. 2e élimination.
27:00–32:00  FINALE         1v1. Anti-turtle + victoire éco possible.
```

### Leviers de durée

- **Regen Contrôle** : base `1.2/s` (× logistique), nerfée à 0.6 après 20:00, 0.4 après 27:00.
- **Banqueroute** : 300 ticks de zéro = 30s, avec **compte à rebours visible**.
- **Police finale** : à 25:00, raid multi sur top 1 et 2.
- **Victoire éco** à 30:00 : si 2+ survivants, score = modules×1M + membres + propre×0.001.

---

## 5. Économie de guerre — reformulée pour 30 min

### Chaîne

```
Labo (Produit) ──convoi──> PdV (→ Sale) ──façade──> Propre
Propre ──> Recrutement (Membres) + Tech + Bâtiments
Sale ──> Opérations militaires
```

### Rendements cibles (post-équilibrage)

| Bâtiment | Rendement/s (neutre) | Coût | ROI | Note |
|---|---|---|---|---|
| Labo | 900 sale/s (1.5×60) | 600 propre | 0.7s | **DIVISER PAR 10** → 90 sale/s, ROI 6.7s |
| Vente | consomme 20 produit/s | 500 propre | instantané | **DIVISER PAR 10** → 2 produit/s |
| Façade | 60 sale→45 propre/s | 500 propre | 11s | OK mais commission 25% trop élevée |
| Planque | +2 000 cap +1.5× déf | 500 propre | — | Bon, mais pas visible |
| Guetteur | −15% dégâts/unité | 350 propre | — | Rayon invisible à corriger |

### Commission blanchiment

Actuel : **25% de perte**. C'est énorme. Un joueur qui fait 10 000 sale/s ne récupère que 7 500 propre/s. **Casser le jeu en mid-game.** → Proposer **10%** (9 000 propre/s) avec risque de police.

### Cap membres (proposé)

```
Cap = 2000 + 1500×quartiers + 2000×logements + 2000×dépôts
```

Actuel : 3 000 membres de base + formule qui explose vite (10 quartiers + 1 logement = 22 000 cap). **Trop gros.** → Proposer cap plus serré avec désertion au-dessus.

---

## 6. Expansion — règles proposées

1. **Curseur Rush 10-80%** au lieu de 20% fixe. Afficher : `Attaque 600 (40%) / Défense 900`.
2. **Pertes mutuelles** : les défenseurs infligent `pertes = damage × 8` aux assaillants. Attaquer un quartier fort coûte cher.
3. **Butin 40% → 20%** + état Contesté 60s anti-snowball.
4. **1 bâtiment/quartier gardé**, file d'ordres `kz=12`, chantiers simultanés `Oz=2` affichés.
5. **Zonage** : 8 zones, bonus visibles en permanence sur carte.

---

## 7. Opérations — fix proposés

### 5 cooldowns séparés

| Opération | Coût | Effet | Cooldown | Contre |
|---|---|---|---|---|
| Raid | 2 500 sale + 800 membres | −35 Contrôle, détruit bâtiment | 30s | Guetteur : −15%/unité (max 60%) |
| Descente | 2 000 sale + 600 membres | Vole 20% valeur, capture si Contrôle < 30 | 25s | 2+ guetteurs = échec |
| Sabotage | 1 500 sale | −50% rendement 30s | 25s | 1+ guetteurs = échec |
| Interception | 500 membres | Vole 25% convoi, coupe 25s | 30s | Escorte N2 |
| Tueur à gage | 3 000 propre + 1 000 membres | −40 centre, −20 voisins | 10s | Guetteur : −15%/unité |

**Règle** : ne jamais payer un échec binaire. Afficher `2 guetteurs — Échec probable` avant paiement.

---

## 8. Police — fix proposés

### Seuils (garder l'existante mais nerfer dominationFloor)

| Seuil | Effet | Fix |
|---|---|---|
| ≥40 | Raid 1 module, −25 Contrôle | Garder, telegraphing 20s |
| ≥70 | 3 modules + 10% propre saisi | Garder |
| ≥95 | Liquidation | Garder, mais **plafonner dominationFloor à 60** au lieu de 250 |

### Corruption

Actuel : `3000 × 1.8^uses` → exponentielle, 15% backlash. **Trop risqué après 2 uses.**
→ Proposer : `5000 × 1.5^uses`, −15 Pression, 5% backlash +5 Pression.

### Heat

Actuel : `+30 capture, +20 hitman, +15 opération, +0.15/vente/tick, +0.08/façade/tick`.
Décroissance : `decay = 0.08 × (1 + heat/30) × (policeZone ? 3 : 1)`.
**Le Heat décroît trop vite dans les zones policières** (×3) → les joueurs construisent à côté des postes pour être immunisés. → Proposer ×2 au lieu de ×3.

---

## 9. Convois — état actuel

**4 routes max** (`Rz=4`). Pas de convoi physique. `convoys.find(to)` = lookup abstrait. L'interception vole 25% d'un montant invisible. **Le joueur ne voit jamais sa drogue voyager.**

→ **Convois physiques obligatoires** : points animés sur carte, Labo→PdV, chemin coupé = bloqué. Cap 4 routes → 8.

---

## 10. Diplomatie

| Constante | Valeur |
|---|---|
| Relation initiale | 60 |
| Durée pacte | 1 500 ticks (2.5 min) |
| Trahison | −50 relation, −50% défense pendant 300 ticks |
| Embargo | 3 000 ticks (5 min), −35% ventes |

**Problème** : la diplo est purement binaire (pacte ou pas). Pas de commerce, pas de tribut, pas de vision partagée. → Proposer : pacte = non-agression + vision 60s + trahison visible.

---

## 11. IA

| Comportement | Détail |
|---|---|
| Cycle | 1 action / 25 ticks (2.5s) |
| Priorité | Défense → Construction → Tech → Corruption → Ops → Attaque |
| Cible | Plus faible adjacent (60%) ou leader (25%) |
| Personnalité | **Aucune** — Gang Nord = Gang Est = Gang Sud |

→ Ajouter 3 archétypes : Turtle (def+tech), Aggro (rush 60%), Econo (blanchiment rapide).

---

## 12. UX

| Problème | Fix |
|---|---|
| Topbar = 7 chiffres | Réduire à 5 : Sale/s, Propre/s, Membres +/s, Carte% (Rang), Pression |
| Q = seule attaque | Gros bouton ATTAQUER + Q secondaire |
| « module » vs « quartier » | Uniformiser en « quartier » partout |
| Slider blanchiment invisible | Afficher ratio + prédiction « rupture sale dans X s » |
| Aide = mur de texte | 3 missions interactives |
| Zonage invisible | Picto permanent sur carte pour chaque zone |

---

## 13. Plan d'équilibrage (par ordre de priorité)

- [ ] **URGENT** : Séparer `hitmanCooldown` en 5 cooldowns indépendants.
- [ ] **URGENT** : Plafonner `dominationFloor` à 60 (au lieu de 250) pour éviter la mort en 11s.
- [ ] **URGENT** : Ajouter pertes mutuelles en siège (défenseurs attaquent assaillants).
- [ ] **URGENT** : Curseur Rush 10-80% au lieu de 20% fixe.
- [ ] Nerf éco : labo ×0.1 (90 sale/s au lieu de 900), vente ×0.1.
- [ ] Commission blanchiment 25% → 10%.
- [ ] Butin 40% → 20% + Contesté 60s.
- [ ] Convois physiques + Interception dédiée.
- [ ] Jauges Heat/Pression + telegraphing raid 20s.
- [ ] Timer banqueroute visible + victoire éco à 30:00.
- [ ] Pré-check guetteurs avant paiement.
- [ ] IA : 3 archétypes (Turtle/Aggro/Econo).
- [ ] Telemetry : durée, T50%, causes de fin.

---

*Fichier mis à jour après analyse du code source. Constantes et formules extraites du bundle.*
