# Open Questions — Questions vivantes (DealerFront)

> Fichier vivant : décisions non tranchées. Une question résolue est **retirée** et reportée dans la spec concernée.
> Les valeurs **implémentées** vivent dans les sections « Implémentation » des specs.

## Fondations

- [ ] Fourchette opportunité/danger propre au mode. → `difficulty.md`, `procgen.md`
- [ ] Équilibrage fin économie ↔ conquête (rendements, vitesse, durée de partie). → `economy.md`, `combat.md`

## Territoire

- [ ] Sort des bâtiments quand un quartier change de main : **détruits** (code actuel) vs **transférés** (spec). → `territory.md`
- [ ] Distance min entre spawns / nombre de quartiers de départ (spawns fixes aux coins aujourd'hui). → `procgen.md`

## Économie

- [ ] **Coût croissant par type** (par nombre de bâtiments du même type). → `economy.md`

## Factions & police

- [ ] Profils/QI des gangs IA (6 factions fixées). → `factions.md`
- [ ] **Cerveau IA** (QI, perception locale, peur, loyauté) — agents/PNJ abandonnés. → `factions.md`

## UI/Art

- [ ] Sélection multiple (glisser-rectangle) et taille de sélection max. → `ui-ux.md`
- [ ] Motifs de faction (hachures) en complément des valeurs/symboles. → `art-direction.md`

## Tech

- [ ] Adoption du style **intents → executions** (OpenFront) dans le core solo. → `tech-stack.md`
