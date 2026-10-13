# Task8B — correctif revue, qualification source

BASE `98b9426b8fa98693254822520230177bc938ed26` ; capture séparée 2026-10-13T11:20:56.988678+00:00.

M1 : le badge récompensé affichait effectivement « Parcours personnel · étape 4/3 » après Jouer. Le test RED échoue sur ce libellé exact. Correction unique de présentation dans Game : journey.reward affiche « Chapitre terminé ». Le test réel de handlers vérifie Jouer puis Explorer/Accueil, référence POST exacte, température100/rang1, dernière sauvegarde/profil inchangés, URL de chapitre conservée, aucun nouveau chargement/succès/audio et restauration froide silencieuse. Les handlers/epochs/progression ne changent pas.

M2 : D10 et A09 nomment explicitement le constat HISTORIQUE8A puis l’état corrigé8B dans la matrice JSON/Markdown. Une assertion couvre ces deux formulations. M3 : notices vendor conservées honnêtement ; aucun muting global ni migration de dépendances.

Nettoyage : `git rm --cached -- .superpowers/sdd/2026-10-12-full-review/task-2-report.md .superpowers/sdd/2026-10-12-full-review/task-8a-report.md`. Ces deux fichiers sont les seuls rapports auparavant suivis. Leurs copies archivées/origines/84manifest SHA+tailles ont été vérifiées avant retrait. Les fichiers physiques restent présents, ignorés par `.superpowers/sdd/.gitignore:1:*`. Aucun autre fichier retiré ; les originaux archivés ne changent pas.

| Commande réelle | Résultat | Journal dans ce dossier |
| --- | --- | --- |
| `node work/test-task8b-fix.mjs --red` avant correction | 1test/0pass/1fail attendu,exit1, badge4/3 exact | task8b-fix-red.log |
| `node work/test-task8b-fix.mjs` | 44/44,0fail/0skip,exit0,1815.1777ms | task8b-fix-focused.log |
| `node scripts/run-site.mjs typecheck` | exit0,log vide,4.075s | task8b-fix-typecheck.log |
| `node scripts/run-site.mjs lint` | exit0,0erreur/0warning,log vide,14.318s | task8b-fix-lint.log |
| `node scripts/build-verified.mjs` | exit0,Build complete,20.002s | task8b-fix-build.log |
| SHA baseline160 après build | 160/160 inchangés | task8b-fix-frozen-identity.json |

Le harness est conservé `test-task8b-fix.mjs`, provenance dans le nouveau manifeste. Les44 cas sont un lot ciblé séparé, aucun décompte doublé au387historique. Aucun second fullsuite387, oracle432, producteur365, transfert ou trainingregen. Build verified-frozen :120 cibles V1,sourceSHA7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16. Notices Vinextclassification et PLUGIN_TIMINGS présentes, sans confusion avec lint source.

Archive84 originale et cutoff intacts. Nouveau manifeste14 entrées pour preuves fraîches/revue8B/rapport8B/rulings ; règle héritée * -text, pas -diff/-merge. Captures originales byteexact, sans secret/blob/scratchdump.

Auto-revue : une expression du badge seule dans Game ; aucun serveur/data/V2/device-sync/pin/calendrier/runtime/score ni flamme modifié. Deux assertions documentaires plus reproduction positive/négative ciblée. Après le nouveau build, seules assertions de tests et métadonnées/documentation/preuves changent ; toutes les entrées de production restent identiques. Source revue finale et recette hébergée/publication/416pin sont les gates du contrôleur. Lecteur d’écran, mobile clavier/zoom, calendrier natif et partage natif non exécutés restent déclarés. Le commit final est indiqué dans le rapport de travail et les annexes du contrôleur, sans SHA autoreférent dans cette capture.

Contrôles finaux : `node work/test-release-status.mjs` après refresh cutoff/métadonnées,3/3,exit0,257.9105ms (`work/task8b-fix-matrix-final.log`). Vérification des objets de l’index :84/84 anciennes +14/14 nouvelles captures exactSHA+taille. `git diff --cached --check -- . :(exclude)docs/review/qualification-2026-10-13` exit0 ; captures CRLF historiques vérifiées par octets, pas réécrites pour le whitespace. Auto-revue du diff achevée, sans changement de source de production après build.
