# Task 7A — independent producer review

**Verdict: Approved — phase A uniquement.**

Base : `0886549b3231ee0026764d0ac2c9fd67f822bf85`.
Commit examiné : `70145326a4016eb4f7ea82814f35547f3522dde1`.

## Spec compliance — gaps et preuves

Aucun écart bloquant identifié dans le périmètre producteur de la phase A. Lecture du brief 7A, du rapport, des contraintes du brief parent et du paquet `review-0886549..7014532.diff`, puis inspection ciblée des sources modifiées et des preuves. Le paquet dépassait la capacité de sortie ; les sections source essentielles ont été examinées directement dans leurs fichiers.

- **Portabilité et refus des liens** : `scripts/semantic-paths.mjs:6-13` contrôle par `lstat` chaque composant avant `realpath`. L'éviction applique ce contrôle au staging et aux pages (`scripts/evict-semantic-target-v2.mjs:52,75`), puis refuse les liens des objets individuels (76-81). Le correctif ne confond plus automatiquement une différence d'orthographe Windows avec un lien. UUID complets conservés dans les noms SQLite courts ; test de l'ancien chemin de 261 caractères présent.
- **Oracle réel conservé** : le vérificateur confronte toujours chaque valeur au calcul indépendant, puis contrôle histogramme, rangs et ordre (`scripts/verify-semantic-target-v2.mjs:154-173`). Aucun changement de formule, précision, contrat, gzip ou asset V1 dans ce lot. Le pilote appelle le constructeur sans option de quota (`scripts/qualify-semantic-batch-v2.mjs:56`) et n'expose aucun contournement par CLI (73-80) : politique existante 8/64 préservée.
- **Transition contrôlée** : le résultat numérique est créé sous le verrou exclusif, gardé privé et transmis au callback sous forme de clone (`scripts/evict-semantic-target-v2.mjs:55,64-70`). La valeur renvoyée par le callback ne remplace jamais cette preuve. Avant renommage/suppression, pointeur, manifeste et toutes les pages sont relus et contrôlés (75-88). Une exception du callback quitte avant suppression et libère le verrou par `finally` (94).
- **Archive complète avant éviction** : `scripts/semantic-runtime-archive.mjs:55-79` copie le pointeur exact, le manifeste vérifié, toutes les pages valeurs/ordre et le BEE2, puis vérifie l'inventaire. L'appel est attendu dans le callback de capture (`scripts/editorial-evidence-v2.mjs:333-338,378-381`). Le contrôle d'archive exige l'ensemble exact des objets du manifeste (36-39). Les checkpoints viennent après cette transition (`scripts/qualify-semantic-batch-v2.mjs:60-66`).
- **Reprise sans attestation sérialisée de confiance** : la branche de reprise contrôle l'archive, relance le véritable vérificateur des scores et le contrôle indépendant BEE2, compare les identités puis reprend l'éviction officielle (`scripts/qualify-semantic-batch-v2.mjs:37-49`). Un inventaire hashé seul n'est pas présenté comme preuve numérique. Le test du faux ensemble archive/manifestes/hashes/checkpoint est effectivement passé et attend `Target score mismatch` (`tests/semantic-batch-v2.test.ts:110-145`).
- **Portée honnête** : sauvegardes R2 distinguées des clés runtime ; aucun transfert distant nouveau ni activation revendiqués. Les quatre inventaires sont marqués complets et totalisent bien 509 références / 4 258 556 169 octets. Le helper Node de transfert reste explicitement un prototype non livré. La phase B, les décisions éditoriales réelles jusqu'à 400 approbations, le calendrier 365 jours et la qualification runtime R2/Worker restent ouverts.

## Quality

- **Critical** : aucun constat.
- **Important** : aucun constat.
- **Minor** : aucun défaut suffisamment étayé nécessitant une correction dans ce périmètre.

## Checks et risques nommés

1. **Fausses preuves / suppression prématurée** : inspection du flot de capture, archive, clone du résultat, rehash avant suppression et reprise. Les assertions de tests couvrent corruption par callback, callback en erreur, échec d'archive, archive précédente conservée et faux reçu cohérent. Les mêmes chemins passent dans les journaux.
2. **Verrouillage / installation immuable — unique examen transversal ciblé** : lecture des primitives déjà existantes `acquireTargetCacheGuard`, `assertTargetCacheGuard`, `releaseTargetCacheGuard`, `installImmutable` et `durableWrite` dans `scripts/semantic-target-v2-common.mjs:43-57,144-166`, pour vérifier leur intégration aux nouveaux appels. Pas de revue élargie des modules inchangés ni du Game/UI.
3. **Résultats annoncés** : `work/task7a-full-tests.log` confirme 264 tests, 261 pass, 0 fail, 3 skipped, durée 78 827 ms. Les trois exclusions indiquent précisément Windows `EPERM` pour des liens symboliques fichier ; elles ne constituent pas des tests de sécurité exécutés. Le test de junction d'ancêtre et le test de chemin SQLite passent réellement. Le test lecteur attend acquisition/libération et termine le lecteur en `finally`.
4. **Typecheck / build / V1** : journal TypeScript sans diagnostic, journal build terminé avec l'avis Vinext documenté ; journal V1 `verified-frozen`, source SHA `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`, 120 cibles et tailles annoncées. Ces résultats sont des preuves du producteur inspectées, pas des exécutions répétées par cette revue. `git diff --check BASE HEAD` exécuté ici : aucun diagnostic.
5. **Preuves réelles 91 et 240** : événements du journal réel cohérents avec le JSON durable, les temps publiés et le flot de code qui réalise effectivement la vérification indépendante. Contrôle supplémentaire effectué ici, strictement en lecture : `loadActiveCorpus` + `checkRuntimeArchive` sur les deux archives, SHA des inventaires documentés, comparaison des reçus et absence des répertoires live après éviction. Résultats :

| Cible | Objets | Octets | Inventaire SHA-256 | Reçu / inventaire conservé / éviction |
| --- | ---: | ---: | --- | --- |
| 91 | 35 | 7 309 665 | `f70669925a98c8b0f3fc1d3de269b536fb2bcd5bccb70439a8e086bdbcb552c1` | conformes |
| 240 | 35 | 7 282 301 | `e103a2f03f0a3e98693eecec42f334237ffe188aff5fbb697cde9107b7ad3508` | conformes |

Les identités manifeste/BEE2 91 correspondent aux pins historiques rapportés ; l'archive 240 correspond au manifeste et au BEE2 du nouveau lot. Le contrôle de lecture ci-dessus vérifie les octets archivés, sans prétendre refaire l'oracle numérique du corpus complet.

**Limite de revue** : aucune suite complète ni génération/vérification numérique million de mots relancée, aucun accès R2, serveur ou déploiement ; les trois cas EPERM restent explicitement non exécutés dans les preuves disponibles. HEAD et index préservés ; seul ce rapport est écrit.

Le gate producteur de la phase A est approuvé. Cette approbation ne clôt ni Task 7 globale ni les travaux éditoriaux/runtime de la phase B.
