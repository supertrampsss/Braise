# Task 7B1 — checkpoint producteur groupé

Statut : implémentation et qualification terminées, revue indépendante du contrôleur requise avant la longue exécution. **Task 7 globale reste incomplète.** BASE 5fe07e573a6ff6d9794e2b901133bdd5dbea130d ; commit final indiqué après création ci-dessous.

## Résultat concret

Deux lots utiles de huit cibles ont été produits, archivés et officiellement évincés. Les seize manifestes correspondent EXACTEMENT aux manifestes des preuves historiques sélectionnées par leur approvalReview.evidenceSha256 ; leurs pages valeurs/ordre brutes et comprimées sont donc identiques. Chaque candidat a réellement subi trois frontières exhaustives : vérification runtime avant activation, nouvelle vérification runtime sous le verrou d'éviction, oracle BEE indépendant. Aucun reçu sérialisé n'est accepté comme attestation.

Lot initial : 1619,1344,2069,1767,1502,1987,898,1488. 1 174,651 s pour huit, CPU 1 134,547 s, RSS 161992 Kio. Préparation groupée 57,062 s, puis finalisation SQLite et trois oracles scalaires par cible. Journal work/qualification/task7b1-real8.log ; preuve work/qualification/task7b1-group8.json. Le champ scope a été corrigé de « two » à TROIS frontières selon le code effectivement exécuté, sans recalcul ni modification des événements mesurés.

Lot final : 1572,493,372,848,69,198,239,502. **164,119 s pour huit**, soit 20,515 s/cible ; CPU 168,125 s ; RSS maximal 218096 Kio. Préparation 33,155 s ; finalisation de chaque cible 1,167–1,495 s, dont tri comparatif 0,424–0,661 s ; oracle avant activation 40,454 s, oracle runtime/pré-éviction 44,736 s, BEE 31,324 s ; archivage 1,614 s et éviction 0,593 s pour huit. Journal work/qualification/task7b1-final-real8.log ; rapport work/qualification/task7b1-final-group8.json.

Le second rapport contient les SHA exacts des cinq scripts exécutés. Ils ont été recontrôlés identiques après la mesure et le build. Les deux rapports sont également versionnés sous docs/program/qualification-2026-10-12/. Chaque référence lie le SHA du BEE historique, le manifeste attendu et l'inventaire d'archive produit. Les anciens BEE/index/décisions ne sont pas modifiés, aucun supersedes inventé. Les preuves récentes de work/e7 restent auxiliaires lorsqu'une preuve historique approuvée suffit.

Les cohortes sont différentes et les mesures datent respectivement des 12 et 13 octobre sur un hôte partagé : le rapport de temps observé n'est pas un benchmark contrôlé universel. La pause d'hôte de ~13h42 a contaminé uniquement la durée de la suite intermédiaire44401, jamais un benchmark numérique. Cette durée n'est pas utilisée comme mesure de performance.

## Code et invariants

- Préparation groupée ≤8 : une lecture/décompression BRV2 commune, produits scalaires float64 dans l'ordre initial des dimensions, mêmes arrondis et valeurs float32. Checkpoints/fsync/hash des parties conservés. Aucun pointeur actif lors de la préparation.
- Finalisation producteur : tri comparatif par score descendant puis id ascendant, tableaux int16/uint32 bornés à 6 Mio de données au seuil 1048576 entrées ; SQLite au-delà et forçable par orderingStorage pour les tests. Les temps de pages valeurs, de tri et de pages ordre sont séparés dans le rapport. Gzip canonique et manifeste inchangés.
- Oracle runtime : calcul indépendant, aucun appel au cosine du producteur ; groupe ≤8 et tableaux bornés à 10 Mio de données/cible (80 Mio/groupe), fallback SQLite conservé/forçable via verificationStorage. Le chemin SQLite utilise toujours le cosine scalaire original et le tri SQL. Le chemin mémoire reconstruit l'ordre par comptage stable, distinct du tri comparatif producteur.
- Activation : toutes les pages provisoires sont finalisées sous le verrou exclusif, toutes les cibles sont vérifiées avant la première activation. Helpers de finalisation et attestations privés au processus ; pas d'option publique « already verified ».
- Capture/éviction : nouvelle vérification runtime groupée sous un même verrou, puis oracle BEE groupé distinct. Publication des index BEE et archives après contrôle. Toutes les archives sont contrôlées avant la première suppression ; rehash de tous les objets puis nouvelle lecture individuelle juste avant chaque renommage. Les résultats originaux restent privés et les callbacks reçoivent une copie.
- Le pointeur/manifeste du corpus est relu avant activation et avant éviction. Quota8, plafond64, refus des liens/junctions, verrous vivants et reprise officielle des journaux demeurent. Les arguments sont copiés avant await afin de maintenir les bornes malgré une mutation de l'appelant.
- Les reprises à partir d'archives refont les vérifications runtime et BEE ; un checkpoint ou un inventaire cohérent frauduleux ne remplace jamais le calcul. Aucune prise forcée de verrou, aucune mutation du vieux b2/91 partiel.

Ruling contrôleur respectée : ajout de scripts/evict-semantic-target-v2.mjs au périmètre initial, puis finalisation mémoire autorisée sur le coût observé ~30 s/cible. Les six fichiers initiaux/étendus comprennent cinq scripts et tests/semantic-target-v2.test.ts ; les pièces de preuve et docs accompagnent la livraison. Aucun changement UI, V1, migrations, flag, secret, configuration distante, preview, push ou déploiement.

## Vérifications réelles

Compilation ciblée :

    node --input-type=module -e "import{build}from'esbuild';await build({entryPoints:['tests/semantic-target-v2.test.ts','tests/semantic-batch-v2.test.ts','tests/editorial-batch.test.ts','tests/editorial-pipeline.test.ts'],outdir:'work/task7b1-tests',bundle:true,platform:'node',format:'esm',packages:'external'});"
    node --test --test-concurrency=1 work/task7b1-tests/*.js

Résultat final : **43 pass / 0 fail / 0 skip**, 25,781 s, exit0, journal work/task7b1-targeted-final.log. Pas de répétition de la suite complète lourde ; celle-ci reste Task8.

Couverture ajoutée : huit cibles comparées aux manifestes et preuves SQLite scalaires ; seuils mémoire/fallback ; exaequo/extrêmes/rangs uint32 ; groupe interrompu après fsync et checkpoint ; quota, verrou vivant, configurations incompatibles ; faux scores avec parties/checkpoint/histogramme cohérents refusés sans activation d'aucune cible ; rang et ordre falsifiés avec hashes recalculés ; corruption du dernier segment malgré checkpoints complets ; corruption par callback avant suppression de toute cible ; échec de deuxième archive conservant les cibles et l'archive précédente ; vérification SQL forcée du cas Windows261caractères, temporaire UUID complet nettoyé.

    node scripts/run-site.mjs typecheck

Exit0 ; journal work/task7b1-typecheck-final.log. Une première passe a signalé des annotations JSDoc insuffisantes après extraction des fonctions, corrigées avant le benchmark final ; aucune erreur persistante.

    node scripts/build-verified.mjs

Exit0 ; journal work/task7b1-build-final.log. Vérification V1 non mutante : sourceSHA 7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16,120cibles. Build vinext terminé ; avis habituel de classification statique de certaines routes, pas une erreur. Aucun serveur lancé.

    git diff --check

Exit0. Auto-relecture : contrôle des transitions sous verrou, des données provisoires non activées, de la libération des handles et des gardes en erreur, des bornes de groupes et tableaux, des trois implémentations numériques séparées, des hashes canoniques et de la reprise. Aucun résultat de coût ou reçu n'est interprété comme approbation éditoriale.

## Interface et reprise

Interface CLI inchangée, six arguments,1–400identifiants distincts, groupage interne≤8. Les événements de coût sont explicitement groupés ; les reçus individuels immuables conservent leur schéma.

Après revue B1 Approved, prochain groupe manquant identifié :

    node scripts/qualify-semantic-batch-v2.mjs --corpus work/semantic-v2-canonical --targets ../t --evidence work/e7 --archive work/a7 --checkpoints work/p7 --target-ids 865,1467,1627,335,536,558,826,1051

État constaté : **32 archives runtime canoniques**, staging ../t vide, tous les jobs numériques terminés normalement et gardes relâchées. Les seize IDs des deux benchmarks doivent être retirés de la liste du contrôleur ; il reste365candidats numériques de cette liste. Ne pas relancer les archives déjà qualifiées uniquement pour refaire des logs : les sélectionner de nouveau déclenche volontairement une revérification indépendante de reprise. Le stop marker du contrôleur reste présent, non modifié par cette phase.

Le contrôleur garde la revue indépendante et le lancement de la longue exécution. Selon la Ruling d'ordre, Task8A UI/qualité suit B1 revu pendant les jobs immuables, puis nous reprenons Task7B2. Restent les décisions éditoriales réelles jusqu'à400approbations, calendrier365, qualification runtime/R2/Worker et éventuelle intégration future explicitement cadrée. Aucun calendrier ni aucune activation V2 n'est revendiqué par B1.

## Commit livré

4b3229d87855ea30d62b8f9f5a67bdaa3c34c5c9 — perf: qualify bounded eight-target production with independent grouped oracles. Arbre Git propre après commit. Aucun processus numérique/serveur actif ; tests et build terminés exit0. CHECKPOINT B1 DONE, Task7 globale non terminée ; prochaine étape contrôleur : revue indépendante de ce commit avant lancement des 365 candidats numériques restants.

## Correctif de revue I1 — round 1 (13 octobre 2026)

Revue fraîche : conformité confirmée ; unique point Important I1, duplication verbatim du contrôle des checkpoints incomplets. Correctif limité à scripts/build-semantic-target-v2.mjs : helper privé prepareIncompleteCheckpoint, appelé depuis les entrées scalaire et groupée. Les quatre instructions originales (initialisation, prédicat complet, vérification du préfixe durable, suppression si vide) sont déplacées sans modification. Lecture des checkpoints, messages distincts des erreurs de lecture et branche scalaire « complete » restent à leur place. Aucun changement des calculs, oracles, fsync, activation, verrouillage, quotas, reprise, archives ou suppression.

Auto-relecture : diff limité à cette extraction (10 insertions / 8 suppressions). Contrôle mécanique inverse PASS : retrait du helper et réinsertion de ses quatre instructions aux deux appels reconstruisent exactement le source HEAD 4b3229d après normalisation Git des fins de ligne. Helper non exporté ; pas de partage avec un oracle. git diff --check exit0.

Vérifications fraîches du correctif :

- Bundles des quatre suites semantic-target-v2, semantic-batch-v2, editorial-batch, editorial-pipeline dans work/task7b1-fix1-tests ; exécution Node séquentielle : **43 pass / 0 fail / 0 skip**, 21,614 s, exit0. Journal work/task7b1-fix1-tests.log. Couvre reprise checkpoint/fsync, falsifications, groupe de huit, corruption et frontières avant suppression. Les tests existants couvrent l'extraction ; pas de test artificiel reflétant le helper.
- node scripts/run-site.mjs typecheck : exit0, journal work/task7b1-fix1-typecheck.log.
- node scripts/build-verified.mjs : exit0, journal work/task7b1-fix1-build.log, « Build complete ». Vérification V1 non mutante conservée ; avis habituel vinext de classification statique, aucun serveur lancé.

Traçabilité des mesures : les benchmarks réels et les cinq SHA enregistrés dans docs/program/qualification-2026-10-12/task7b1-final-group8.json restent exclusivement liés au commit **4b3229d87855ea30d62b8f9f5a67bdaa3c34c5c9**. Le nouveau commit change le SHA du producteur par cette extraction privée ; il n'a pas exécuté un nouveau benchmark réel. Aucune preuve historique ni aucun SHA de benchmark n'a été réécrit. L'équivalence structurelle contrôlée et les 43 tests frais qualifient le correctif ; les 164119 ms restent une mesure de 4b3229d, pas du nouveau HEAD.

Commit correctif : 7b089800d29dfec9ff217a7edfdea204dcdc91a6 — refactor: share private incomplete target checkpoint validation.

CHECKPOINT B1 fix round 1 DONE, en attente de relecture limitée du contrôleur avant le lancement long. Task7 globale reste incomplète. Aucun job numérique, Task8A, serveur, publication ni activation démarré ; stop marker conservé.
