# Task7B2 — production, rapport en cours

Base f7b5a57c5efb6ff340db6348293c8f08fe118a55, Task8A Approved. Reprise explicite comme seul rédacteur de production après les trois lots en lecture. Task7 non terminée : 400 décisions validées, calendrier365, transport réel/R2/Worker et interfaces futures restent à qualifier.

## Contraintes actuelles

Le job27300 du contrôleur reste propriétaire du staging ../t, des archives work/a7, des preuves work/e7 et de leurs gardes. Les neuf dépendances listées dans work/qualification/remaining-pipeline-identity.json demeurent gelées jusqu'à libération explicite. Pas de production numérique concurrente ni édition de ces neuf fichiers. Préparation indépendante des décisions et nouveaux fichiers transport/tests possible ; publication du catalogue après libération.

Preview QA du contrôleur session80945/root43124 sur dist8A : arrêt confirmé requis avant tout build/dist. Aucun serveur propre, push, déploiement, clé sur fichier/argv/log ni agent.

## Base éditoriale réelle

Historique :72 faits de décision sur65 cibles, dont62 approuvées et3 actuellement rejetées (1718,703,327), avec anciennes chaînes exactes. Les faits intermédiaires rejetés des chaînes finalement approuvées ne doivent pas être comptés comme refus supplémentaires.

Recommandations contrôleur :48 dossiers/45 favorables/3 insuffisants ;8 notes initiales demandent normalisation exacte de leur attribution/heure,40 JSON déjà complets. Recommandations de cet agent :181 dossiers/169 favorables/12 insuffisants, rapport task-7b2-editorial-readonly-report.md et trois snapshots immuables. Ces nombres ne sont pas de nouvelles approbations canoniques. Toutes les preuves et dates de revue doivent rester inchangées lors de l'intégration.

Le protocole courant reste12/64 voisins, aucune extension256. Dossiers64 insuffisants : rejet motivé et véritables remplaçants à produire/revoir jusqu'à400, sans trio forcé. Sens spécialisés et catégories à corriger explicitement dans la sélection selon les avis.

## Proposition transport soumise, pas encore implémentée

Conserver SemanticV2Reader et son contrôle SHA complet/headers/gzip/rangs. Nouvel adaptateur de plages R2 fermé sur un index de positions pinné, racine≤256KiB et shards≤256KiB par préfixe présence/cible. Réutiliser les11 chunks SHA du TAR présence89,526,784o déjà sauvegardé ; aucun nouvel upload corpus/source. Reconstruction de chaque fichier logique depuis au plus2 plages de chunks≤8MiB, contrôles offset/longueur/taille puis SHA complet avant remise au reader. Aucun parsing TAR Worker, chemin libre ou endpoint public. Tous les pins et budgets à tester réellement ; root garde les transferts/configuration/probes.

Mesure read-only archive91 :37 fichiers physiques (35 inventoriés+2 métadonnées),7,316,584o ; estimation TAR7,347,200o ; page maximale243,841o. Chaque paquet cible doit être mesuré individuellement avant de déclarer≤8MiB. Cette mesure de taille ne qualifie pas encore le transport.

## Checkpoint transport + sonde prêt pour revue (13 octobre)

Architecture et endpoint approuvés explicitement par le contrôleur. Implémentation : adaptateur SHA fermé, constructeur TAR/index de positions horsWorker, wrapper réseau borné/annulable, authentification temporaire partagée et route POST privée10cas pinnés. Détails et preuves durables dans docs/program/qualification-2026-10-12/task7b2-range-checkpoint.md, task7b2-range-pack-inspection.json et task7b2-range-real-local-results.json.

Racine49f548a439d8034ceeee1d553c00ddaf42c52f0802afae201963e131bb587f70 ; pinsetd24043ff12595c6ee40ec011c23a20937697d0eccb2249e8776d0a0714fedceb. Paquet réel91 =7 338 496o ; les35objets canoniques sont strictement identiques à l'archive numérique indépendante antérieure. Tous les260shards (max56 172o),65 829objets/2plages croisées contrôlés. 262nouveaux blobs/21 689 152o préparés, aucun transfert. Présence11blocs/89 526 784o existants rehashés, pas à uploader à nouveau. Local10/10cas, aucune preuve Worker hébergée encore.

Commandes finales : bundle esbuild des4tests nouveaux/transport vers work/tests-range ; node --test --test-concurrency=1 [semantic-range-pack-v2,semantic-v2-range-r2,semantic-runtime-qualification,semantic-transfer].test.mjs →33/33,0skip,0fail (~1358ms). npm run typecheck→0 ; npm run lint→0 erreurs/4 avertissements préexistants ; npm run build→0 après arrêt explicite du preview canonique (root travaille dans sa copie8A). Logs work/task7b2-transport-{tests,typecheck,lint,build,real}.log. Deux annotations des nouveaux tests ont été corrigées après typecheck initial ; seul résultat final0 retenu. Auto-revue a ajouté le test d'annulation du corps dont cancel reste bloqué, avec correction pour ne pas prolonger la deadline ; suite/build finaux repassés. Aucun globalsuite lourd répété.

9SHA gelés vérifiés identiques, archives/e7/staging/calculs du contrôleur intacts. Aucun UI/engineV1/migration/activation/configsecret modifié. La sonde partage le mécanisme SHA constant du transfert et ajoute ses bornes d'entrée ; réponses fermées et aucun chemin libre. Revue indépendante demandée avant transfert coûteux/config/probe, qui restent au contrôleur.

Relecture éditoriale réelle additionnelle : tous les512voisins des8early dossiers relus le13/10 à08:11:53.707UTC ; nouvelle attribution /root/corpus_qualification,7favorables/rejet199 dans work/qualification/editorial-agent-review/early8-recommendations.json, sans modifier les notes du contrôleur. Ces8dossiers recouvrent8de ses48, ne sont pas8candidats supplémentaires. Le catalogue historique reste inchangé62/3 ; ces recommandations ne sont pas des décisions persistantes.

Task7B2/Task7 ne sont PAS terminées : revue/qualification R2 réelle, reste éditorial et remplaçants jusqu'à400, calendrier365 puis ruling des interfaces futures restent requis. Le job numérique du contrôleur reste gelé/repris en session94814 après EPERM de checkpoint ; aucun contournement ni suppression de guard effectué par cet agent.

Commit checkpoint transport : 01ed71d2b2237b6c7544d72626cbf1493a4ff6ee (15 fichiers détenus, checkout propre après commit). Le build final a terminé code0 ; aucune occurrence du pinset de sonde dans dist/client. git diff --cached --check propre après normalisation des fins de fichiers docs/tests. Source applicative du build identique à ce commit (seules fins de fichier docs/tests ajustées après build).

Lancement après revue, exclusivement par root : transférer les blobs de work/qualification/range-pack-upload-inventory.json avec son mécanisme authentifié existant ; conserver les11chunks présence déjà sauvegardés ; configurer temporairement le token/expiry et BRAIZ_RUNTIME_QUALIFICATION_PIN=d24043ff12595c6ee40ec011c23a20937697d0eccb2249e8776d0a0714fedceb ; tester les10 POST {caseId} fermés et comparer resultSha256 au fichier durable task7b2-range-real-local-results.json ; vérifier aussi404 sans capability puis révoquer. Aucune de ces opérations cloud n'a été effectuée par cet agent. Pour le passage ultérieur aux400cibles, reconstruire les paquets réels et mesurer chacun, puis requalifier les pins adaptés ; le présent jeu ne prétend qualifier que la cible91 et l'index présence complet.
# Task7B2 — checkpoint catalogue, 365 jours et runtime borné

État : prêt pour revue indépendante. La publication, le transfert complet R2 et les 406 exécutions hébergées restent à réaliser par le contrôleur. Aucun drapeau ni clé native n’a été activé par cet agent. Task7 globale n’est pas terminée.

## Résultat réel

- 432 candidats distincts : 406 approuvés par agents, 26 rejetés avec motifs. Les 400 initiaux donnent 375 approbations/25 rejets ; les 32 remplaçants donnent 31 approbations/1 rejet (papillon4861, troisième indice insuffisant). Pas de trio forcé ni d’extension fictive à256 voisins.
- 367 nouvelles décisions intégrées à partir des recommandations authentiques. Chaque dossier nouveau a64 voisins réellement lus et trois indices littéraux distincts, scores strictement croissants/rangs décroissants pour les approbations. Les modifications de sens/catégorie sont explicites, notamment chambre parlementaire, chaîneTV, pièce théâtrale, échelle graduée, dimension mathématique, branche familiale et racine lexicale.
- Les72 faits historiques,65 identités de preuve et72 fichiers de preuve antérieurs sont conservés exactement ; revues/corrections historiques également inchangées. Les nouvelles captures d’anciens approuvés restent auxiliaires dans work/e7. Aucun supersedes inventé.
- Catalogue construit par build-editorial-catalogue-v2, puis432/432 dossiers vérifiés par l’oracle indépendant officiel en groupes bornés≤8. Session24475 : exit0 réellement collecté. Ce passage n’est pas remplacé par une attestation sérialisée.
- 429 archives runtime réelles conservées (397 antérieures +32 remplaçants). Staging ../t : uniquement .evictions et le fichier normal de gardeSQLite, aucune colonne active. Les neuf dépendances numériques restent aux SHA qualifiés ; aucune modification de cosinus, quantification, rang, ordre, quota ou verrou.

## Identités

| Objet | SHA256 |
|---|---|
| Workbench vérifié, JSON stable | 63451e5e2b0014bea7762ee76706dcded2640798d021d8ea0b391c79226ba73b |
| Catalogue ready, même contenu et seul statut promu | 1d103c45482f026bc1eaf9d319502b46fd80033ceff271b192263d35f7bee6b8 |
| Calendrier inactif365, JSON stable | f77f79844f86a2459c86d85fcac9c02e0af439d3589d8bc8e3c233f1f0eff4e1 |
| Racine fullrange,113761 octets | e08f4bcca2586ab52f7964f87012fd4685c46d2fe8cdebc04e5b350c91382161 |
| Pinset des416 sondes opaques | 931a2db284eea74431998e1578f92c68fc441cc57aee7f1692f1c4eb202603af |
| Autorité produit complète, JSON.stringify | ecff16ede959fdd9dac5587b61bada2d534438e2916cdcf457fa847a4c84543d |
| Inventaire des811 nouveaux blobs, octets fichier | 2c875e1fa97b1590a2eb5e98dd6d93b0efc4ad1a3b42af573c3cb91d23ce002f |

Le calendrier est créé/validé avec les fonctions officielles :365 dates uniques et consécutives Europe/Paris, du2027-01-05 au2028-01-04,365 cibles approuvées distinctes. Le workbench reste l’entrée reproductible du vérificateur ; data/editorial-v2-ready.json est sa promotion validée. Les JSON SHA stables et SHA des octets ne sont pas interchangeables.

## Runtime et preuve locale

Le fullpack contient406 paquets individuels, maximum7511040 octets (<8MiB), total2989366784 octets de paquets. Racine/shards restent≤256KiB, chaque fichier reconstruit par≤2 plages contiguës, mêmes validations de métadonnées, longueurs et SHA complet. Aucun TAR parsé dans le Worker.

Le nouveau compilateur scripts/build-runtime-qualification-v2.mjs charge les preuves avec le loader officiel, lie chaque approuvé à son manifeste archivé exact, et tire wordId/score entier/rang d’un indice BEE existant. Il ne calcule aucune valeur attendue avec le reader produit. Un cas opaque par chacun des406 approuvés, plus les10 cas initiaux (présence, accent, rare, absent, exact, voisin, plage croisée, mauvais pin, corruption). La provenance détaillée reste côté serveur/audit ; les requêtes ne contiennent que caseId opaque.

Exécution locale finale :416/416 via le vrai adaptateur borné et les vrais fichiers fullpack. Maximum observé7 lectures/534163 octets. Ce sont des compteurs réels de requêtes, pas une mesure de RSS. Ancien pin8277… et première preuve locale sont conservés en scratch ; le pin final931a… a été réexécuté entièrement après opacification des identifiants.

API produit réelle importée en local, horloges explicites de fixture : GET puis guess/hint pour début/milieu/fin du calendrier, six résultats numériques exacts comparés aux BEE ; historique3000 mots conservé ;409sansrefV2,503gate absent et après calendrier. Aucun serveur de prévisualisation ajouté et aucune exécution hébergée prétendue.

## Intégration future autorisée

- Quotidien et archives seulement, Jan5'27–Jan4'28. Les120 premiers jours V1, tous seeds libres (dont zéros initiaux), allocations privées/Studio/cercles/collections restent V1. Ni moteur numérique V1 ni actifs publics immuables ni pack d’entraînement régénérés.
- Identité daily-v2-YYYY-MM-DD ; ref exacte corpus/classic-v2/calendrier obligatoire. Aucun accès public à une date future. Après fin, autorité absente ou storage invalide :503JSON sans repliV1.
- GET vérifie réellement un manifeste/page pinnés avant de promettre l’édition. POST réutilise le même reader/cache/budget16lectures/8MiB/30s. Indices : les trois mots éditorialisés avec ensemble des mots déjà utilisés, aucun lookup des3000 essais ni score fourni par le corps accepté sur confiance.
- Tutoriel reste un exempleV1, comparé au mot canonique de la cible du jour, jamais à un indice numérique d’un autre corpus. Le petit historique de découverteV1 ne reçoit que les identités réellement communes au catalogueV1.
- Sauvegarde V2 : enveloppe schemaVersion2 +ref +game stricte sous l’ancienne famille de clés, avec identité daily-v2 distincte ; les octets V1 ne sont pas convertis. Documents inconnus/corrompus conservés, écriture/reflet profil refusés. Rangs≤1013881 uniquement avec identitéV2 exacte ; V1 reste≤30000 dans les transferts.
- Export profil mixte version2 avec semanticScope explicite ; enveloppe sync mixte version2 à identités exactes. ExportV1 conservé pour faitsV1 seuls. Import/fusion idempotents, pas de rejeu ni rétrocrédit ; dates futures et faits antérieurs à la publication V2 refusés.

## Deux capacités distinctes, détenues par le contrôleur

1. Sonde temporaire : BRAIZ_TRANSFER_TOKEN +BRAIZ_TRANSFER_EXPIRES et BRAIZ_RUNTIME_QUALIFICATION_PIN=931a… ; POST /api/semantic-runtime-qualification, seulement un caseId précompilé. Réponses sans mots/solutions, compteurs et digests uniquement.
2. Activation future du produit : BRAIZ_DAILY_V2_QUALIFICATION_PIN=ecff… (pin non secret de calendrier+catalogue+corpus+range). Il doit rester absent tant que les406 cas hébergés réels ne sont pas tous passés. Le contrôleur pourra ensuite configurer ce pin et redéployer la même version sauvegardée, puis révoquer les capacités temporaires. Aujourd’hui reste V1 dans tous les cas.

## Transfert restant

work/qualification/range-full-transfer-inventory.json :811 nouveaux blobs,2985466694 octets.261 blobs du checkpoint et11 chunks de présence déjà stockés sont réutilisés ; aucune recopie du corpus brut3GB. Les1072 blobs locaux ont tous été relus avec SHA/longueur exacts. Paquets/racine dans work/qualification/range-pack-full. Revue requise avant transfert, puis GET+SHA réels de chaque nouvel objet, publication source exacte et416 cas hébergés (dont406 cibles).

CheckpointR2 antérieur :262 objets/21689152 octets réellement GET+SHA par root. Fermeture honnête : retrait natifrev9 mais ancienne capacité observée200 ; correction par token invalide/expiration passée rev10 et404 réels deux origines ; suppressionrev11 et404 réels. L’ancien secret avait été effacé, donc aucun retest final de ce secret n’est revendiqué. Preuve de stockage seulement, pas de qualification du readerWorker.

## Vérifications

- Producteur remplaçants32 : pilote officiel, session96338, exit0 ; trois frontières indépendantes maintenues, archives avant éviction.
- Catalogue432 : build puis vérification indépendante complète, exit0.
- tests ciblés :121 passés,0 échec,0 skip. Runtime/ranges, compilateur, stockageV2, sync/profil, archives, navigation/admission, catalogue/calendrier. Pas de répétition de la suite globale réservée8B.
- TypeScript : exit0. Lint : exit0,0 erreur,4 warnings préexistants. Build vérifié : exit0.
- git diff --check :0. Aucune différence dans public/, legacy-v1.json, semantic-v1-index.json ou editorial-v1-active.json. Recherche des trois pins serveur dans dist/client :aucun résultat.
- Auto-revue : garde GET storage absente corrigée pour503 avant200 ; réutilisation bornée du reader pendant POST ; opacité des caseId ; préservation exacte des chaînes ; bornes conditionnelles V1/V2 ; annulation dès abort ; enveloppes et effets idempotents.

Journaux : work/task7b2-{integration-tests,typecheck,lint,build}.log ; work/qualification/editorial-catalogue-full-verify.log. Preuves durables voisines task7b2-*.json (index SHA, filiation, calendrier, cases, résultats, inventaire).

## Reproduction contrôlée

- Construire : node scripts/build-editorial-catalogue-v2.mjs --corpus work/semantic-v2-canonical --targets ../t --evidence data/editorial-v2-evidence --selection data/editorial-v2-selection.json --output data/editorial-v2-catalogue.json
- Vérifier intégralement si les données changent : node scripts/verify-editorial-catalogue-v2.mjs --corpus work/semantic-v2-canonical --targets ../t --evidence data/editorial-v2-evidence --catalogue data/editorial-v2-catalogue.json
- Pack : node scripts/build-semantic-range-pack-v2.mjs work/qualification/range-pack-full-options.json
- Compiler sondes : node scripts/build-runtime-qualification-v2.mjs work/qualification/runtime-full-compiler-opaque-options.json (choisir un nouveau auditPath immuable pour une nouvelle production).
- Calendrier : source scratch work/qualification/create-calendar-authority.ts, compilée par build-calendar-authority.mjs avec les fonctions officielles ; sorties protégées wx. Ne pas écraser une autorité publiée.
- Tests ciblés reproductibles : node work/qualification/run-integration-tests.mjs ; les trois nouvelles suites suivies seront aussi incluses par le lanceur global standard en8B.

Commit de checkpoint : consigné dans le rapport de dispatch après création du commit. Aucun push, transfert, publication ou activation effectué ici.

## Checkpoint livré — revue indépendante requise
Commit : 2b19b8102aeb1fe7e096414fe56568d3ebcdd6f5 (base 18f96e64cc9479409bb8425d05af2af32a138648). Arbre suivi propre après commit. Tests ciblés 121/121, aucun skip ; TypeScript, lint et build vérifié exit0. Aucun job actif. Task7 demeure incomplète : transfert intégral, 416 cas hébergés dont 406 cibles, publication et activation par le contrôleur restent à réaliser après revue. Aucun transfert ni activation réalisé dans ce checkpoint.

