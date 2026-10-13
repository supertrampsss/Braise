# Task 5 — re-revue ciblée, correction 1

- **I1 — récupération de duplication après réponse perdue et modification de la source : ADDRESSED.** `lib/studio-store.ts:22` retrouve la destination par ID, propriétaire et provenance persistante, sous session active ; ce reçu est retourné avant lecture du contenu courant ou contrôle du quota. `lib/studio-store.ts:26` écrit atomiquement la copie et sa provenance avec `INSERT … SELECT`, révision source et quota de 50 ; `save` ne modifie pas cette provenance. Une mauvaise source, un autre propriétaire, un ID ordinaire ou une session révoquée ne permettent pas de récupérer la destination. La régression `tests/studio-variants-components.test.ts:111` traverse le vrai composant, la vraie API et le vrai store : écriture réussie puis réponse perdue, source enregistrée avec un autre titre, reprise du même ID, récupération d’Original et exactement deux brouillons ; la duplication volontaire suivante utilise un nouvel ID et crée le troisième brouillon. `tests/studio-variants.test.ts:43` couvre aussi le rejeu ordinaire, le refus de réutilisation, le quota saturé et la révocation. `scripts/qualify-studio-local.ts:28` et `:36` vérifient la récupération via la vraie API sur D1 local, y compris au quota de 50.
- **M1 — « Réessayer » après panne du bilan chargeait une énigme : ADDRESSED.** L’opération de reprise est une union typée dans `components/intruder-game.tsx:20`, renseignée par le chargement de question (`:24`) et de bilan (`:37`). Le bouton `:80` rappelle le bilan lorsque celui-ci a échoué, avec les gardes synchrones existantes conservées. `tests/studio-variants-components.test.ts:132` restaure vingt réponses, provoque la panne du bilan, actionne le vrai bouton et exige deux requêtes successives à `/api/intruder/summary` puis l’affichage du bilan.

## Nouvelle casse introduite par le diff

**Critical : aucune. Important : aucune. Minor : aucune identifiée.**

Contrôle migration : `drizzle/0007_numerous_bishop.sql:1` ajoute uniquement une colonne texte nullable, cohérente avec `db/schema.ts:23`. Le snapshot 0007 référence exactement l’ID du snapshot 0006. Comparaison structurée des snapshots effectuée en lecture seule : après neutralisation des IDs de snapshot et retrait de la nouvelle colonne, égalité exacte. Le paquet ajoute 0007 et son entrée de journal sans modifier les migrations antérieures. La provenance des anciens brouillons reste NULL ; aucune origine historique n’est inventée. La migration doit être appliquée avant le nouveau worker, comme documenté dans le rapport producteur.

## Preuves contrôlées

- Paquet `review-aac0bdd..417d5f8.diff` : base `aac0bdd61d439a181e99e6b23d7323871b6bc20f`, HEAD déclaré `417d5f8e3c77a39ddf83fb9e9709763ce0083e32`, un commit. Lecture du paquet puis lectures ciblées des sections tronquées et des fonctions concernées ; aucune nouvelle dérivation du diff avec Git.
- `work/task5-fix1-tests.log` : **91 tests, 91 pass, 0 fail, 0 skip** ; les trois nouvelles régressions apparaissent explicitement aux tests 83, 84 et 89. Runner et assertions inspectés : vrais composants, vraies routes et vrai store ; dix suites ciblées incluant les invariants affectés.
- `work/task5-fix1-red-corrected.log` : **13 tests, 10 pass, 3 fail**. Les échecs correspondent précisément à I1 (Updated au lieu d’Original dans le composant ; résultat absent dans le store) et M1 (requête question au lieu du bilan). Le runner rouge inspecté rebundle les deux implémentations de la base revue avec les nouvelles régressions ; il ne modifie pas le checkout. Les essais préliminaires incomplets ne constituent pas la preuve retenue.
- `work/task5-fix1-d1.log` : **PASS Miniflare, migrations 0000–0007**. Assertions SQL/API de récupération, provenance, quota, propriétaire, CSRF/origine et session inspectées dans le script ; fixtures locales explicitement annoncées.
- `work/task5-fix1-typecheck.log` et `work/task5-fix1-lint.log` sont vides, cohérents avec les commandes silencieuses et leurs **exit 0 attestés dans le rapport producteur** ; ces seuls fichiers ne permettent pas de reconstruire les codes de sortie. Aucune erreur visible.
- `work/task5-fix1-build.log` contient **Build complete** et la vérification V1 frozen, SHA-256 `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`, 120 cibles ; avertissements de classification statique Vinext présents et documentés. Exit 0 attesté par le producteur.
- Aucun doute comportemental restant ne justifiait une exécution supplémentaire. Aucune suite relancée, aucun pipeline/corpus, preview, push ou déploiement ; checkout, index et HEAD laissés intacts. Seul ce rapport est écrit dans le dossier SDD ignoré. Aucune interaction avec le job numérique indépendant du contrôleur.

## Observations hors périmètre

Aucune nouvelle observation. La recette navigateur et la qualification globale restent au lot 8, conformément au cadrage ; cette re-revue ne les certifie pas.

## Verdict

**Approved — I1 et M1 adressés ; aucune nouvelle casse Critical/Important ; aucun constat ouvert dans cette correction.**
