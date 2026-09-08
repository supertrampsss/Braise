# Reprise du corpus et livraison GitHub, 8 septembre 2026

## Périmètre

Le checkout avait disparu. La source canonique Sites a été clonée à nouveau dans `/workspace/sites/braise` depuis `5f349c1f1eaf0dc114bc85cbfa9a4fe3c69e23da`. Le bail de reprise a été poussé avant les écritures. Le code applicatif, les données V1 et les preuves éditoriales ne sont pas modifiés par cette tranche.

## Livraison déjà confirmée

La publication privée v6 est confirmée par Sites : déploiement `appgdep_6aa03b5159048191af3127e9683225f7`, statut `succeeded`, mis à jour le 8 septembre 2026 à 16:45:18 UTC. Elle utilise la source `5f349c1f1eaf0dc114bc85cbfa9a4fe3c69e23da`, avec la même URL et sans activation V2.

Le miroir GitHub `supertrampsss/Braise` existe au commit d'import `9b2e6980fef903e3d75f7122ae5512be6434caa0`. C'est un instantané, pas un transfert de l'historique Git complet. Son absence de données nécessaires au build est explicitée dans `GITHUB-DATA-ASSETS.md`. Aucun transfert de fragments opaques refusés n'est retenté.

## Restauration locale

La source française complète a été téléchargée à nouveau sous son nom exact `wiki.fr.vec`. Sa taille de 3 027 096 151 octets et son SHA-256 `bc68b0703375da9e81c3c11d0c28f3f8375dd944c209e697c4075e579455ac2a` correspondent aux preuves d'origine. La reconstruction et les vérifications exhaustives intégrée puis séparée ont réussi : 1 013 881 entrées admises, 248 segments, aucune divergence. Le manifeste `e1c07accdc55196c180968d710030e938b861bd7b6c7bf2c0f764e030f365cf7` et l'inventaire sémantique `8440d4e963ae309c5761818a58bcf752d1aa5750b6b6876d94a055ca177f732d` correspondent exactement aux empreintes historiques.

L'index de présence a également été reconstruit puis vérifié séparément : 1 013 881 entrées, 65 536 feuilles, manifeste `77178f6fc85de9d5523db3f13141b751abdeb1c6b2d3ad6a4d020346a795c426` identique à l'original. Node utilisé pour cette reprise : v24.19.0. Aucun temps d'exécution ni pic mémoire nouveau n'est revendiqué.

Commandes de reprise :

```sh
node scripts/build-semantic-corpus-v2.mjs --source work/source/wiki.fr.vec --output work/semantic-v2-real
node scripts/verify-semantic-corpus-v2.mjs --source work/source/wiki.fr.vec --output work/semantic-v2-real
node scripts/build-semantic-index-v2.mjs --corpus work/semantic-v2-real --output work/semantic-v2-targets-real
node scripts/verify-semantic-index-v2.mjs --corpus work/semantic-v2-real --output work/semantic-v2-targets-real
mkdir -p work/semantic-v2-targets-real/fr-fasttext-complete-bc68b0703375-0f34b2449278/targets
node scripts/verify-editorial-catalogue-v2.mjs --corpus work/semantic-v2-real --targets work/semantic-v2-targets-real --evidence data/editorial-v2-evidence --catalogue data/editorial-v2-catalogue.json
```

La reconstruction n'a pas modifié les empreintes d'origine. Les sorties locales sous `work/` sont reproductibles mais ne constituent pas une sauvegarde durable du corpus. L'index de présence est restauré ; les colonnes numériques restent absentes, conformément au staging vide de B2f. Elles devront être préparées et vérifiées pour les usages qui en dépendent.

## Vérifications et limites

La relecture indépendante ASTRA maximale a contrôlé les 40 preuves archivées, leurs chaînes de révision et les 33 dossiers. Le vérificateur numérique a ensuite recalculé exhaustivement les scores, histogrammes et voisinages des 33 dossiers actuels sur le corpus restauré, sans divergence. Les 32 approbations et le rejet sont conservés ; aucune nouvelle cible n'est approuvée par cette reprise. La sortie `evidenceReady: 32` exclut le dossier rejeté, mais celui-ci fait bien partie des 33 dossiers numériquement vérifiés. Les résultats exacts figurent dans `RECOVERY-MEASUREMENTS.json`.

Les 147 tests, TypeScript et le build sont des résultats du code B2f, pas de nouveaux contrôles exécutés par cette tranche documentaire. Aucun test navigateur, qualification R2/Worker, ouverture publique ou activation publicitaire n'est déclaré.

Le rapport B1E est corrigé : les fichiers locaux ne sont pas durablement garantis et seules les mesures du JSON enregistré font foi. Cette correction documentaire n'est pas une nouvelle mesure du lecteur.

## Suite et retour

La restauration exacte et la revalidation sont terminées. Reprendre les candidats éditoriaux restants après contrôle du bail et de la présence effective du staging. Il reste 333 approbations pour le calendrier minimal de 365 jours et 368 pour l'objectif de 400. Conserver V1 en production jusqu'aux conditions effectives d'activation V2. Une annulation de cette tranche se fait par nouveau commit documentaire ; ne pas supprimer les sources, les preuves, les données de jeu ou les publications existantes.
