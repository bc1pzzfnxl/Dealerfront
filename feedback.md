# Feedback Dealer-RTS (DealerFront) — Audit Critique & Expérience Joueur

> Test à l'aveugle réalisé en conditions réelles sur navigateur (sans consultation préalable de la documentation ni du GDD).

---

## 1. Premier contact & Onboarding (Les 2 premières minutes)

### Le modal « Comment Jouer » : un mur de texte bloquant

- **Bug CSS d'affichage / Overflow** : Sur une résolution standard (1920×891 de viewport), le modal dépasse verticalement la fenêtre (`bottom: 1043px`). Le conteneur n'a pas d'overflow interne, ce qui crée une barre de défilement sur le `<body>` de la page entière. Le bouton de fermeture « Compris, jouer » est rejeté hors-champ sous la ligne de flottaison. Un joueur moins insistant croira le jeu gelé ou mal chargé.
- **Syndrome du « Manuel d'aviation »** : Le modal déverse d'un coup l'intégralité des mécaniques (8 types de bâtiments, 6 types de zones, multiplicateurs horaires, logistique convoi, tueur à gage, corruption). Personne ne retient 20 règles abstraites avant d'avoir posé son premier clic.
- **Absence de guidage pas-à-pas** : Une fois le modal fermé, le joueur est abandonné sur une carte sans surbrillance de son quartier de départ, sans objectif séquentiel explicite.

### « Mais où suis-je sur la carte ? »

- Au lancement, la caméra est centrée sur Paris (zoom 11.4). Les 992 quartiers IRIS ressemblent à un quadrillage sombre et uniforme.
- Le joueur possède 1 seul quartier (id 0, Salpêtrière 4), représenté par un minuscule polygone bleu perdu au milieu de la carte.
- Aucun halo clignotant, aucun marqueur « Vous êtes ici », aucun encadré n'indique clairement la couleur assignée au joueur ni son point de départ. Il faut déduire son identité en recoupant la couleur de la barre de contrôle avec les 4 pastilles colorées sur la carte.

---

## 2. Gameplay & Ergonomie des Contrôles

### La boucle économique de base : bonne idée, mais étouffée par le zonage

- **Chaîne de production satisfaisante** : La chaîne `Labo (Produit) -> Point de vente (Cash sale) -> Façade (Cash propre)` fonctionne logiquement. Le retour visuel des convois animés (points bleus en transit entre bâtiments) est gratifiant.
- **La frustration punitive du zonage rigide** :
  - Dès la première conquête (quartier adjacent #432), le joueur découvre un quartier classé `Parc`.
  - Résultat : **7 bâtiments sur 8 sont grisés** (`zone incompatible`). Seule la `Planque` est autorisée.
  - Le joueur, qui a désespérément besoin d'un Point de vente ou d'une Façade pour convertir son stock, se retrouve avec un quartier inutile pour son économie de départ, sans avoir été prévenu avant la capture.
- **Confusion terminologique : le faux ami « BÂTI »** :
  - Dans l'encadré du quartier, la mention `BÂTI : Résidentiel` ou `BÂTI : Parc` prête à confusion : le joueur pense qu'un bâtiment y est déjà construit, alors qu'il s'agit uniquement du profil de zonage du terrain.

### Sélection, caméra et micro-gestion

- **Impossibilité de désélectionner** : Cliquer dans le vide (hors de Paris) ou appuyer sur `Échap` ne désélectionne pas le quartier en cours. Le panneau de gauche reste définitivement verrouillé sur la dernière sélection.
- **Ciblage difficile sans zoom maximal** : À l'échelle globale de Paris, les quartiers IRIS font 10 à 15 pixels de large. Cliquer sur un quartier précis relève du pixel-hunting. Le joueur est forcé de zoomer/dézoomer constamment pour naviguer.
- **Contraste de carte insuffisant** : Les bordures des quartiers neutres sont d'un gris très sombre sur fond noir (`#111`). Distinguer les limites réelles d'un quartier adjacent sans passer la souris dessus est fatigant pour les yeux.

---

## 3. Game Design & Équilibrage : Le gouffre Joueur vs IA

### Asymétrie brutale du rythme d'expansion

| Temps de jeu écoulé | Quartiers Joueur | Quartiers Gang Sud | Quartiers Gang Nord | Quartiers Gang Est |
| ------------------- | ---------------- | ------------------ | ------------------- | ------------------ |
| ~1 minute           | 1                | 7                  | 9                   | 9                  |
| ~5 minutes          | 3                | 81                 | 72                  | 88                 |
| ~12 minutes         | 4                | 148                | 120                 | 170                |
| ~20 minutes         | 4                | 288                | 210                 | 380                |

- **Constat accablant** : En 15 minutes, l'IA a colonisé **plus de 85 % de la ville de Paris**, pendant qu'un joueur humain découvrant l'interface en a conquis péniblement 4.
- **Cause racine** : L'IA exécute ses conquêtes et ses constructions instantanément et en parallèle sur l'ensemble de son empire. Le joueur humain, lui, est bridé par une boucle d'actions manuelle séquentielle lente :
  1. Trouver visuellement un quartier limitrophe libre.
  2. Cliquer dessus.
  3. Lancer l'assaut (`Q`) et attendre la fin du siège (plusieurs secondes).
  4. Recliquer sur le quartier conquis.
  5. Choisir un bâtiment compatible avec le zonage.
  6. Attendre le temps de construction.
- L'effet boule de neige (snowball) de l'IA est immédiat et irréversible. Le joueur est condamné à être un spectateur impuissant enclavé dans son arrondissement d'origine.

### Verrouillage technologique punitif

- L'arbre technologique (`Armement`, `Protection`, `Logistique`) nécessite impérativement un **Atelier**.
- L'Atelier ne peut être construit que sur une **Friche industrielle**.
- Si le spawn aléatoire du joueur se trouve dans un secteur résidentiel/commercial (ex: Salpêtrière, 13e) dépourvu de friche industrielle à moins de 6 quartiers de distance, **toute la tech et toutes les actions offensives avancées (Tueur à gages, Sabotage, Raid) sont bloquées à 0 pendant toute la partie**.

### La Police : une menace invisible

- Durant 20 minutes de jeu, avec un Heat grimpé à 100 sur le point de vente et une Pression policière oscillant entre 25 et 40 : **0 raid exécuté**.
- La mécanique de police anti-leader cible presque exclusivement le gang IA dominant, rendant la police complètement inoffensive et passive pour le joueur, qui n'en ressent jamais la menace directe.

### Incohérence géographique des gangs

- **Scramble des noms et positions** :
  - Le gang nommé **Gang Sud** apparaît au Nord-Est / Est.
  - Le gang nommé **Gang Nord** apparaît au Sud-Ouest.
  - Le gang nommé **Gang Est** apparaît au Nord.
- Cette inversion spatiale perturbe instantanément la lecture stratégique et donne une impression de génération procédurale non vérifiée.

---

## 4. Événements narratifs & Diplomatie

### Boucle des 3 événements en boucle infinie

- Seuls 3 événements tournent en boucle : *« Livraison risquée »*, *« Un indicateur parle »*, *« Façade concurrente »*.
- **Bug bloquant sur « Façade concurrente »** : Si le joueur clique sur l'option *« Racheter (Façade aménagée gratuitement) »* alors qu'aucun de ses quartiers libres n'est compatible avec une Façade (ou que tous ses quartiers sont déjà bâtis), **le clic ne produit aucun effet et ne ferme pas le modal**. Le joueur se retrouve coincé avec un bouton inopérant sans aucun message explicatif, forcé de cliquer sur *« Revendre »*.
- **Interruption en temps réel** : Les événements surgissent en plein écran sans mettre le jeu en pause, forçant des choix sous pression alors qu'un siège ou une vente se déroule en arrière-plan.

### Spam diplomatique

- Dès que le joueur approche d'une frontière ou que les relations se stabilisent, les 3 gangs IA bombardent simultanément le joueur de propositions de pacte (*« Gang Sud propose un pacte »*, *« Gang Nord propose un pacte »*).
- Les pactes figent la partie : l'IA ne nous attaque plus, et le joueur n'a aucun moyen militaire de rivaliser avec des empires de 300 quartiers.

---

## 5. Rendu Visuel, DA & Problèmes Techniques

### L'avalanche d'icônes au dézoom (Icon Clutter)

- Dès que l'IA contrôle une centaine de quartiers, **la carte devient illisible au zoom dézoomé**.
- Chaque quartier bâti affiche un badge circulaire blanc opaque. À l'échelle de Paris, ces badges se superposent en une masse informe de pastilles blanches qui masque entièrement la géographie et les couleurs des territoires.
- **Solution requise** : Implémenter un système de LOD (Level of Detail) : masquer les icônes de bâtiment individuelles dès que le zoom est inférieur à 13, ou regrouper les icônes par arrondissement.

### Mode Daltonien inefficace

- L'activation du mode « Daltonien » remplace les couleurs pastel des factions par des nuances de gris très proches (`#555`, `#777`, `#999`).
- Les symboles annoncés (●, ■, ▲, ◆) n'apparaissent **que dans le panneau latéral**, jamais sur les polygones de la carte.
- Résultat : la carte devient une masse monochrome grise indéchiffrable.

### Spam d'erreurs en console JavaScript

- La console affiche plus de **1 000 occurrences** de l'erreur non interceptée :
  `Error: The source 'iris' does not exist in the map's style.`
- La source MapLibre est nommée `'geojson-source-iris'` dans le style, mais un appel récurrent tente d'interroger la source `'iris'`.

### Journal d'événements étriqué

- Le panneau « JOURNAL » est limité à 3 lignes visibles sans défilement ni historique.
- Avec des ticks à 10 Hz et 3 IA qui capturent un quartier toutes les 2 secondes, les notifications défilent à toute vitesse et effacent immédiatement les alertes critiques concernant le joueur.

---

## 6. Synthèse des Recommandations Prioritaires

1. **Correction UX Immédiate** :
   
   - Corriger la hauteur / overflow du modal de tutoriel (`max-h-[85vh]`, `overflow-y-auto`) pour que le bouton « Compris, jouer » soit visible sur tous les écrans.
   - Régler la caméra au lancement sur un zoom centré sur le quartier du joueur, avec une pastille pulsante « Votre QG ».
   - Permettre la désélection d'un quartier avec la touche `Échap` ou un clic dans le vide.
   - Réparer le nom de source MapLibre (`'geojson-source-iris'`) pour éliminer l'erreur console de boucle.

2. **Équilibrage IA / Rythme de conquête** :
   
   - Brider la cadence d'expansion de l'IA en début de partie (cooldown d'assaut, coût de déploiement en troupes proportionnel à la distance du QG).
   - Introduire un outil de sélection / aménagement groupé (glisser pour sélectionner une grappe de quartiers adjacents et lancer un assaut simultané).

3. **Flexibilité du Zonage & Tech** :
   
   - Ne pas interdire à 100 % les bâtiments vitaux dans les zones défavorables : appliquer un malus de rendement (ex: −50 % de production dans un Parc) plutôt qu'un blocage total qui paralyse l'économie du joueur.
   - Permettre de débloquer le premier palier technologique sans Ateliers spécialisés (ou garantir une friche industrielle dans un rayon de 2 cases du spawn).

4. **Clarté Visuelle (LOD)** :
   
   - Masquer les badges de bâtiments au dézoom (zoom < 13).
   - Remplacer le terme `BÂTI` par `TYPE DE ZONE` dans la fiche quartier lorsqu'aucun bâtiment n'est encore construit.
