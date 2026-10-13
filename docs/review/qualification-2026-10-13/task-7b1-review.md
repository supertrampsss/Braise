# Task 7B1 — revue indépendante

## Conformité

✅ Périmètre B1 conforme aux exigences fonctionnelles vérifiables. **Qualité : Needs fixes**, un point Important de duplication du contrôle de reprise ; aucun défaut numérique ou de suppression identifié.

Base : `5fe07e573a6ff6d9794e2b901133bdd5dbea130d`. Head : `4b3229d87855ea30d62b8f9f5a67bdaa3c34c5c9`.

Lecture du brief 7/7B, des rulings du ledger, du rapport 7B1 et du paquet complet `review-5fe07e5..4b3229d.diff`, en tranches. Une tranche de preuves a été relue parce que le premier affichage avait été tronqué. Aucun Git de reconstruction, aucune suite relancée, aucun changement de source/index/HEAD, aucun serveur ni publication.

## Points solides

- `scripts/build-semantic-target-v2.mjs:288` : entrée groupée bornée à huit, copie des identifiants avant attente ; préparation provisoire puis vérification de toutes les cibles avant la première activation (`:302–305`). `:272` relit l’identité du corpus avant activation. Quota par défaut 8 et plafond scalaire 64 préservés.
- `scripts/build-semantic-target-v2.mjs:24`, `:244` : seuil producteur 1 048 576, tri comparatif score descendant/id ascendant et repli SQLite. `scripts/verify-semantic-target-v2.mjs:20`, `:191` : seuil indépendant et reconstruction par placement dans des classes de scores, distincte du tri producteur. Calculs float64 dans l’ordre des dimensions, entrées float32 ; aucun appel au cosine producteur dans l’oracle.
- `scripts/verify-semantic-target-v2.mjs:215` : oracle exhaustif groupé, plus chemin scalaire SQLite forcé. `scripts/editorial-evidence-v2.mjs:426` : troisième frontière BEE indépendante réellement exécutée avant finalisation des archives. Les trois frontières ne sont pas remplacées par un reçu persistant.
- `scripts/evict-semantic-target-v2.mjs:84`, `:93`, `:98`, `:103` : vérification fraîche sous garde, copie structurée remise au callback, conservation privée des preuves originales, rehash global avant la première suppression et individuel avant chaque renommage. `:96` relit l’identité du corpus. `scripts/editorial-evidence-v2.mjs:429` termine toutes les archives avant de rendre la main à l’éviction.
- `scripts/qualify-semantic-batch-v2.mjs:40` : la reprise d’une archive refait les vérifications runtime et BEE ; les reçus ne deviennent pas une autorité numérique. Les callbacks de progression ne reçoivent pas les preuves privées utilisées pour supprimer.
- `tests/semantic-target-v2.test.ts:299` et suivants : égalité de huit cibles face au chemin scalaire SQL, falsification cohérente de checkpoints sans activation, corruption de rangs/ordre avec hashes recalculés, corruption tardive du corpus, échec d’archive et mutation du callback conservant les cibles. Les tests de limites et de chemin SQLite Windows complètent ces cas.

## Important — I1 : contrôle de checkpoint recopié intégralement

**`scripts/build-semantic-target-v2.mjs:336–339`**, doublon de **`:182–185`**.

La nouvelle préparation groupée recopie l’initialisation du checkpoint, la totalité du prédicat de validation (version, complétude, configuration, couverture, histogramme, parties), puis le choix vérification/suppression du fichier de scores. C’est un bloc de contrôle de reprise sensible, désormais maintenu deux fois dans le même producteur. Une correction ultérieure de validation peut facilement laisser l’une des deux entrées accepter un état refusé par l’autre.

Extraire un helper privé commun d’initialisation/validation du checkpoint incomplet et de vérification de son préfixe durable ; conserver le traitement du checkpoint déjà complet propre à l’entrée scalaire. Cela ne mutualise aucun calcul numérique entre producteur et oracles et ne compromet donc pas leur indépendance.

Sévérité **Important** suivant le template de revue imposé, qui classe explicitement la duplication verbatim d’un bloc logique dans cette catégorie. Aucun comportement incorrect actuel n’est allégué pour ce doublon. Une correction locale avec les tests ciblés de reprise/falsification suffit ; pas de raison de répéter les benchmarks complets uniquement pour cette extraction.

## Critical / Minor

Aucun Critical. Aucun autre Minor retenu.

## Vérifications de preuves

Contrôle read-only exécuté avec Node, sans calcul des scores ni nouvelle production :

- Les cinq fichiers de scripts ont exactement les SHA annoncés par `docs/program/qualification-2026-10-12/task7b1-final-group8.json:3`.
- Pour les huit IDs 1572,493,372,848,69,198,239,502 : lecture de chaque BEE historique sélectionné par son SHA exact, vérification de son digest canonique, comparaison du manifeste avec la référence du benchmark, puis `checkRuntimeArchive` sur l’archive réelle. **8/8 manifestes exacts, 35 objets par archive, 280 objets dont les hashes et liens sont valides**.
- `work/task7b1-targeted-final.log:269` : 43 tests, 43 pass, 0 fail, 0 skipped, durée 25,781 s. Aucun rerun de cette suite. Les seuls avertissements SQLite sont ceux de l’environnement déjà explicitement admis par ruling ; les trois skips EPERM de l’ancienne baseline ne sont pas attribués à B1.
- Rapport de typecheck exit0, journal final vide ; journal de build se terminant par « Build complete ». Aucun nouveau test global ni build lancé par le reviewer.
- Le journal réel final se termine par `benchmark-complete`, 164119 ms et huit références. Le premier lot de 1174651 ms porte sur une autre cohorte et une autre date ; la documentation le présente correctement comme comparaison observée, pas comme accélération universelle contrôlée.

## Contrôles ciblés hors hunks

- Risque de contournement des bornes/liaisons du corpus : lecture de `semantic-target-v2-common.mjs` pour la couverture complète et le hachage de chaque segment, et de `semantic-paths.mjs` pour le refus des composants liens/junctions.
- Risque d’archive incomplète acceptée avant suppression : lecture de `semantic-runtime-archive.mjs`, qui relit l’inventaire exact, tous les objets et le lien BEE/manifeste avant retour.
- Risque de régression sur checkpoint complet et locks : compléments non présents dans les hunks coupés de `build-semantic-target-v2.mjs` (gestion du checkpoint complet, quota, verrou vivant, vérification du préfixe durable).
- Risque de perte des entrées d’index lors des huit captures préparées à l’avance : lecture ciblée de `editorial-evidence-v2.mjs:470`. L’installation relit l’index sous son verrou pour chaque ajout et conserve les révisions ; pas d’écrasement par un snapshot périmé.

## Limites du verdict

La revue porte sur B1 uniquement. Task7 reste en attente des véritables décisions éditoriales 400, du calendrier 365 et de la qualification runtime/R2. Les 365 candidats numériques restants ne sont pas des approbations. V1/UI/flags/migrations/publication restent hors de ce changement et aucun obstacle de ces phases ultérieures n’est imputé à B1.

**Décision : correction I1 puis relecture limitée à l’extraction avant l’accord de lancement long.**
