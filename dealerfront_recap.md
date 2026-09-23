# DealerFront — Rapport Post-Mortem & Analyse Critique

## 1. Résumé de la Partie (Arène `d252b87c`)

- **Faction jouée** : Cartel (ID 0)
- **Résultat** : 2ème place (Défait à la fin par la police et le South-Westside Gang)
- **Durée** : 1 146 secondes (~19,1 minutes / 11 460 ticks)
- **Quartiers capturés** : **718** (sur les 992 quartiers IRIS de Paris)
- **Bilan financier final** : 
  - Dirty cash accumulé : ~180 100 $ (non blanchi)
  - Clean cash restant : 8 590 $
  - Pression policière finale : **90.3 / 95**

---

## 2. La Réalité de notre "Stratégie" : Le Paradoxe du Bot Automatique

Plutôt qu'une réflexion tactique poussée, la partie a été jouée par un script PowerShell asynchrone qui spammait l'API MCP en continu :

```powershell
while ($true) {
    if ($police.pressure -ge 65) { Act @{ type = "corrupt" } }
    if ($s.emptyQuarters.Count -gt 0) { Act @{ type = "batchBuild" } }
    Act @{ type = "attackBest" }
    Start-Sleep -Milliseconds 300
}
```

### Pourquoi un script bête et méchant plutôt que de la réflexion ?
1. **Simulation temps réel agressive (5 ticks/s)** : Prendre 5 à 10 secondes pour réfléchir au prochain coup fait perdre 25 à 50 ticks et plusieurs quartiers face à un script rapide.
2. **Fonctions "pilote automatique" fournies par le jeu** :
   - `attackBest` : le serveur calcule et attaque lui-même le quartier voisin le plus faible.
   - `batchBuild` : le serveur choisit et construit automatiquement le bâtiment optimal selon la chaîne logistique.
3. **Prime au spam d'API** : Le jeu favorise le joueur ou bot qui sature son quota d'actions (1 action par seconde de jeu, jusqu'à 10 en réserve).

---

## 3. Analyse Critique du Jeu : Points Positifs & Négatifs

### Points Positifs
- **Cadre géographique immersif** : L'intégration des 992 quartiers IRIS de Paris offre une vraie granularité territoriale.
- **Accessibilité technique (MCP / HTTP)** : Idéal pour tester des agents autonomes et des boucles de contrôle asynchrones.
- **Boucle économique simple et logique** :
  $$\text{Membres} \rightarrow \text{Labs (Produit)} \rightarrow \text{Storefronts (Dirty)} \rightarrow \text{Fronts (Clean)}$$
- **Parties rythmées** : Des affrontements dynamiques pliés en ~20 minutes.

### Points Négatifs (Pourquoi le jeu est aujourd'hui "débile")
- **Absence de dimension spatiale réelle** : Tous les quartiers se valent globalement. Aucun impact de la Seine, des ponts, des autoroutes, des gares ou du relief.
- **Absence de micro-gestion** : L'armée est un pool global unique sans positionnement physique de troupes.
- **Des boutons "Cheat-Code" qui tuent la tactique** : Quand `attackBest` et `batchBuild` existent, regarder la carte devient inutile.
- **Une jauge de police punitive et binaire** : Une simple barre de 0 à 100 qui monte quand on mène et termine en game over brutal à 95.
- **Diplomatie inutile** : Les pactes et contrats n'ont aucune utilité face à un rouleau compresseur d'expansion continue.

---

## 4. Leviers de Pression Souhaités

1. **Police sectorielle et spécialisée** :
   - **Brigade des Stups** : Cible et saisit les Labs et la production.
   - **Fisc / Douanes** : Gèle les Fronts et confisque le Clean cash.
   - **GIGN / RAID** : Lance des assauts ciblés sur le quartier général.
   - **Dénonciation / Renseignement** : Possibilité de "balancer" un rival pour orienter les descentes de police sur lui.
2. **Saturation du marché & Guerre des prix** :
   - Deux cartels vendant dans le même secteur font chuter les marges de vente.
   - Gestion de la pureté du produit (fort volume/basse qualité vs luxe/haute qualité).
3. **Moral, Salaires et Mutineries** :
   - Les hommes de main ont un moral et exigent leur paie à temps. En cas de défaite répétée ou de retard de salaire, risque de mutinerie ou de fuite vers un cartel rival.

---

## 5. Comment Rendre le Jeu VRAIMENT Stratégique ?

1. **Supprimer les raccourcis magiques** :
   - Supprimer `attackBest` et `batchBuild` pour obliger le joueur/l'agent à analyser les données du terrain et choisir explicitement ses modules.
2. **Topographie et Goulots d'étranglement (Chokepoints)** :
   - Traverser la Seine doit obligatoirement passer par les ponts parisiens (points névralgiques hautement défendables).
   - Les grandes gares et le périphérique doivent offrir des bonus logistiques majeurs pour les transferts de cash et de troupes.
3. **Brouillard de Guerre (Fog of War) & Renseignement** :
   - Rendre la carte opaque hors des zones frontalières.
   - Nécessité de payer des guetteurs ou des indics pour découvrir où l'adversaire cache ses usines ou ses réserves de cash.
4. **Lignes de ravitaillement et Enclavement** :
   - Un quartier coupé du territoire principal ne doit plus pouvoir envoyer son argent ni recevoir de renforts.
5. **Cooldowns de déplacement au lieu du spam d'actions** :
   - Lier la vitesse d'action à la distance géographique pour récompenser l'anticipation et pénaliser les scripts de spam binaire.
