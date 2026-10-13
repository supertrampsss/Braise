# Task 6 — revue ciblée spécification et qualité

## Spec Compliance

- ✅ **Spec compliant** pour le périmètre Task 6, BASE `417d5f8e3c77a39ddf83fb9e9709763ce0083e32` → HEAD `7d7fa4d4c4efa15c954268d04a450a7e95061115`, avec les rulings du contrôleur.
- Les trois parcours et neuf indices sont éditoriaux et explicités, sans métrique de difficulté inventée : `scripts/build-training-pack.mjs:29`, `docs/training-offline.md:13`, `components/training.tsx:102`.
- Le pack fini est distinct des parties quotidiennes : 208 graphies, 3 IDs training, 624 scores, rangs sur 30 000 mots ; état uniquement sous sa clé liée au hash, aucun import/API/récompense quotidienne : `lib/training.ts:1`, `lib/training.ts:9`, `scripts/build-training-pack.mjs:53`, `components/training.tsx:59`.
- Consentement explicite précédé du périmètre et de la taille exacte, cache incomplet jamais publié, anciennes versions préservées, suppression volontaire limitée aux caches training, exclusion API/auth : `components/training.tsx:105`, `public/sw.js:78`, `public/sw.js:88`, `public/sw.js:130`.
- Données futures/corrompues conservées ; mot inconnu sans score/essai avec saisie conservée ; garde de mutation synchrone ; aucun déplacement du focus à la restauration : `lib/training.ts:41`, `lib/training.ts:59`, `components/training.tsx:43`, `components/training.tsx:60`, `components/training.tsx:83`.
- Le shell autonome et la route Next utilisent le même composant : `scripts/training-shell.tsx:2`, `app/entrainement/page.tsx:1`. Le plateau précède le téléchargement et le sélecteur reste compact : `components/training.tsx:81`, `components/training.tsx:89`, `components/training.tsx:105`, `tests/training-components.test.ts:84`.
- ✅ La preuve navigateur finale reçue puis lue est liée à HEAD `7d7fa4d…`, manifeste `c8ac667a…`, taille 255 268 : `work/qa-training-final-controller.json:3`. Elle couvre consentement explicite, Network.offline avec serveur propriétaire arrêté, HTML/JS/CSS/pack réellement servis depuis ServiceWorker/cache-storage, rechargement et nouvel onglet froid après fermeture, saisie inconnue conservée sans score/essai, indice puis victoire clavier offline et reprise silencieuse avec focus BODY. Le viewport CSS 390×844 est sans débordement ; champ initial à 649,48px et focus uniquement après sélection explicite. L'ancienne installation conservée lors de mise à jour reste prouvée par `work/qa-training-update-controller.json:7`.
- ⚠️ **Qualification Task 8** : cette preuve réelle qualifie les artefacts autonomes finaux ; la fullsuite, l'entrée Next/Worker et l'intégration hébergée demeurent à qualifier, conformément au scope explicite de `work/qa-training-final-controller.json:2`. Aucun mock Cache n'est présenté comme preuve navigateur.

## Strengths

- Comparaison numérique indépendante réelle : le producteur lit les segments figés tandis que le vérificateur récupère et exécute le `lib/semantic.ts` original du commit `85b05a71…` sur le corpus brut ; chaque entrée est comparée intégralement, y compris rank/found/température : `scripts/build-training-pack.mjs:20`, `scripts/build-training-pack.mjs:47`, `scripts/build-training-pack.mjs:50`. Le test n’accepte pas un simple compteur autodéclaré sans exécution : `tests/training.test.ts:17` ; résultat exécuté visible à `work/task-6-tests.log:420`.
- Tests comportementaux du composant réel, garde contre doubles callbacks et anciennes closures, restauration silencieuse, formats français, corruption/concurrence, protocole cache et isolation : `tests/training-components.test.ts:35`, `tests/training-components.test.ts:84`, `tests/training-components.test.ts:104`, `tests/training-offline.test.ts:73`, `tests/training.test.ts:52`.
- Installation complète vérifiée avant le marqueur, vérification des octets à chaque lecture, absence d’activation forcée : `public/sw.js:29`, `public/sw.js:42`, `public/sw.js:88`, `public/sw.js:105`, `public/sw.js:121`.

## Vérifications effectuées

- Paquet original complet conservé, **336 429 octets** ; tous les hunks production/source/tests examinés. La première sortie étant tronquée, seuls les segments source non entièrement visibles ont été récupérés en sorties bornées. Les deux payloads générés (vendor React JS et pack numérique) ont été filtrés de la lecture de code conformément au ruling, sans omettre leur vérification d’octets.
- Reconstruction des quatre artefacts depuis leurs hunks du paquet exact HEAD puis comparaison octet à octet aux fichiers : **4/4 identiques**, **4/4 SHA/taille conformes** au manifeste. Pack : 42 695 octets / `ace47abb…` ; JS : 208 421 / `ca726e88…` ; CSS : 2 550 / `b6d4e737…` ; HTML : 603 / `bb50cc89…`. Manifeste fixe et immuable identiques, **999 octets**, SHA `c8ac667a9e336d0c28ae02d22f94b97ec0b967b99aa999997e9ce65774cb27c9` ; somme vérifiée **255 268 octets**. Pins/build/source : `public/training/manifest.json:1`, `public/sw.js:7`, `scripts/build-training-pack.mjs:64`, `scripts/build-training-pack.mjs:73`.
- Schéma/IDs/vocabulaire/indices/cibles relus dans le JSON final. Empreinte du source oracle récupéré : `e236e7505e25140cea77c21201143542e20c15c70ec885e8a4c820f8ab62c482`. Risque nommé « oracle miroir » : inspection limitée à l’oracle conservé `work/training-reference/semantic.ts:16`, `work/training-reference/semantic.ts:66` et au baseline `docs/program/BASELINE.json:2` ; code originel distinct du producteur confirmé.
- Risque nommé « lien Explorer/retour orphelin » : contrôle limité à `components/app-navigation.tsx:5`, `lib/game-navigation.ts:5` ; `surface=explore` mène bien à Explorer. Aucun crawl général.
- Logs existants inspectés, sans relancer suite, V2 ou build : **74/74 tests, 0 échec, 0 skip** (`work/task-6-tests.log:456`) ; typecheck et lint ciblé avec diagnostics vides ; build terminé avec la route entraînement (`work/task-6-build.log:70`, `work/task-6-build.log:85`). La reproducibilité complète et les 624 comparaisons sont exercées par le test exécuté à `work/task-6-tests.log:420`.
- Preuves navigateur initiale, mise à jour et finale inspectées sans les rejouer ; le fichier final vérifie les URLs CSS/JS/pack contre les empreintes exact HEAD auditées ci-dessus : `work/qa-training-final-controller.json:40`.
- Les 9 erreurs/5 avertissements de Game sont byte-for-byte identiques avant/après dans `work/task-6-game-lint-baseline.json:2` ; aucune régression Task 6 et responsabilité de qualification Task 8 inchangée. Le log de build contient les avis vinext déjà documentés. Aucun résultat fullsuite « tout vert » revendiqué.

## Issues

### Critical

Aucune.

### Important

Aucune.

### Minor

- `tests/training-components.test.ts:5` — Les nouveaux tests utilisent `react-test-renderer`, déprécié, et produisent plusieurs avertissements (`work/task-6-tests.log:352`). Les assertions sont utiles et passent, mais la sortie n’est pas pristine et cet outil devra être remplacé par un environnement DOM maintenu. Avertissement SQLite du socle existant (`work/task-6-tests.log:278`) également constaté, sans nouvelle régression imputable à Task 6.

## Assessment

**Task quality: Approved.** Le périmètre est respecté, les octets et les comparaisons indépendantes sont traçables, et les tests ainsi que la preuve navigateur réelle couvrent les risques spécifiques sur les hashes finaux. L’approbation ciblée ne remplace pas la qualification Next/Worker, fullsuite et hébergée Task 8.
