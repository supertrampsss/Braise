### Spec Compliance

- ✅ Conforme au périmètre Task8B sur BASE `2b19b8102aeb1fe7e096414fe56568d3ebcdd6f5` → HEAD `98b9426b8fa98693254822520230177bc938ed26`, avec trois observations mineures ci-dessous. Q1–Q8 et les observations QA8A ont des modifications correspondantes : son observable (`tests/game-integration.test.ts:46`, `:86`, `:109`, `:242`), singuliers (`components/expedition-picker.tsx:24`, `components/intruder-game.tsx:79`, `components/two-braises-game.tsx:78`), contexte solo (`components/game.tsx:625`, `:644`), suggestion réelle (`:653`), intégration (`components/embed-demo.tsx:13`), fichier nommé (`components/profile-transfer.tsx:97`).
- ✅ Matrice : contrôle indépendant de 44 IDs uniques, 44 validations strictement égales au backlog, toutes références existantes. Aucun PASS44 inventé ; limites natives, gates publication/416 et pin futur explicités (`docs/review/implementation-status.json:833`, `:1175`, `:1196` ; `tests/release-status.test.ts:6`).
- ✅ Archivage : paquet complet présent et inventorié ; tous nouveaux changements fonctionnels/config/tests et matrice lus dans le supplément. Les copies historiques sont vérifiées par identité/provenance sur les 84 entrées plutôt que requalifiées comme nouveau code. Contrôle indépendant : 84/84 SHA256 + tailles exacts ; 83 originaux actuels identiques et capture du ledger préfixe octet pour octet de son état désormais augmenté. Cutoff explicite (`docs/review/qualification-2026-10-13/manifest.json:4`) ; contrôle blobs HEAD fourni :84/84 (`work/task8b-archive-committed-bytecheck.json:2`). La seule règle locale est `* -text`, sans suppression diff/merge (`docs/review/qualification-2026-10-13/.gitattributes:2`).
- ⚠️ La recette finale navigateur, publication, 416 véritables cas hébergés et absence/activation de variable dans l’environnement distant restent au contrôleur ; cette revue locale ne les certifie pas (`docs/review/implementation-status.json:1175`). Même limite pour lecteur d’écran, clavier/zoom mobiles, calendrier externe et partage natif (`:1196`).

### Strengths

- Focus Deux braises déclenché dans le submit admis, titre terminal accessible, garde propriétaire/paire/alive et annulation ; aucune focalisation de restauration (`components/two-braises-game.tsx:25`, `:37`, `:48`, `:61`, `:78`). Tests comportementaux couvrent succès, éloignement, démontage et reload (`tests/release-polish.test.ts:23`, `:41`), avec conservation des éditions de saisie pendant POST dans le test existant.
- Sentinelle sonore observable et vrai contrôle positif avec son actif ; le compteur reste extérieur au try/catch de l’audio (`tests/game-integration.test.ts:46`, `:104`, `:242`). Le test revendique une tentative AudioContext, sans simuler une preuve d’écoute.
- Nettoyage mécanique des scripts limité aux métadonnées sans scores et au paramètre inutilisé (`scripts/build-semantic-shards.mjs:85`, `scripts/verify-semantic-target-v2.mjs:142`). Exemptions img motivées et strictement locales aux deux images natives inchangées (`components/flame-scene.tsx:53`, `:55`). Exclusions TypeScript limitées aux quatre répertoires générés/ignorés (`tsconfig.json:33` ; `.gitignore:38`), sans exclure app/components/lib/scripts/tests/types.
- Qualification honnête : unique full run 387 =383 pass/1 fail/3 skip (`docs/review/qualification-2026-10-13/evidence/task8b-full-tests.log:2467`) ; échec réel ancienne attente false (`:478`) corrigé explicitement avec assertions d’origine conservées (`tests/foundations.test.ts:61`), puis 6/6 ciblés (`docs/review/qualification-2026-10-13/evidence/task8b-foundations-final.log:41`). Composition 384 cas uniques/3 non exécutés, aucun exit0 général fabriqué (`docs/review/implementation-status.json:1246`).
- Reçus lus :87/87 ciblés ; type/lint/build exits0, lint vide ; build verified-frozen120 puis Build complete. Contrôle indépendant des 160 hashes du baseline :aucun changement. Reçu R2 contrôlé par contenu/hash/provenance :811 objets/2 985 466 694octets, stockage séparé du gate hébergé (`docs/review/qualification-2026-10-13/evidence/task8b-focused.log:558`, `evidence/task8b-build-final.log:1`, `evidence/task8b-frozen-identity.json:3`, `docs/review/implementation-status.json:1178`).
- Nuage/high : contradiction historique documentée, aucun champ éditorial/pin réécrit (`docs/review/qualification-2026-10-13/editorial-conservative-ambiguity-note.md:3`, `:5`, `:7`).

### Issues

#### Critical (Must Fix)

- Aucun.

#### Important (Should Fix)

- Aucun.

#### Minor (Nice to Have)

- M1 — `components/game.tsx:644` : le nouveau badge Voyage affiche toujours completed+1. Après validation d’un chapitre complet, le serveur renvoie completed=length/reward ; revenir par Jouer ou Accueil, qui appelle navigate directement, conserve cet état et peut afficher « étape4/3 ». Afficher « Chapitre terminé » lorsque journey.reward, ou borner le compteur. Risque ciblé contrôlé par `lib/expedition-server.ts:23`, `components/game.tsx:319`, `:79`, `:597` ; enterGame possède déjà une autre voie de réinitialisation (`:374`). Défaut de libellé, sans modification de scores/progression.
- M2 — `docs/review/implementation-status.json:320` et `docs/review/implementation-status.md:143` : « Le plateau solo porte encore un libellé social trompeur » reste au présent juste avant la correction8B. Identifier explicitement ce constat comme historique8A rendrait le résultat final plus clair ; même amélioration pour la notice A09 (`implementation-status.json:1053`).
- M3 — `docs/review/qualification-2026-10-13/evidence/task8b-full-tests.log:601` : sortie de tests encore bruyante avec dépréciation react-test-renderer et notices expérimentales SQLite/MockTimers (`:194`, `:280`). Elles sont conservées et documentées honnêtement ; une migration ultérieure du harness pourra réduire ce bruit. Aucun besoin de modifier les preuves historiques ni de relancer cette qualification.

### Assessment

**Task quality:** Approved.

**Reasoning:** Changements limités, tests significatifs, archive désormais fidèle aux octets et matrice traçable ; aucun défaut bloquant identifié. Cette approbation de source n’est ni une recette hébergée ni une certification native.

**Contrôles de revue :** aucune suite/build/production numérique relancée, aucun serveur/cloud/push/déploiement ; seules lectures, contrôles d’identité/références et écriture de ce rapport ignoré. Risques ciblés hors diff : réalité de la suggestion (`lib/play-hub.ts:54` et `components/game.tsx:365`), remise à zéro du contexte solo (`:234`), dernier état du chapitre (M1), contrat privé prepareVerification/callsite (`scripts/verify-semantic-target-v2.mjs:224`), exclusions générées (.gitignore) ; aucun crawl général.

