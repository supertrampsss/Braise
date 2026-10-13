# Revue Task 8A — spécification et qualité

## Conformité

**✅ Conforme au périmètre 8A.** Base `7b089800d29dfec9ff217a7edfdea204dcdc91a6`, tête `f7b5a57c5efb6ff340db6348293c8f08fe118a55`. Aucun défaut bloquant observé dans ce changement. **0 Critical / 0 Important / 2 Minor.**

- Candidate avancée autorisée par le brief : `lib/release.ts:1` active les entrées sur la branche non publiée ; `docs/review/implementation-status.json:7` distingue cette activation du gate final. Les preuves authentifiées/D1 Task4–5 restent des preuves antérieures réutilisées, conformément au cadrage du contrôleur. Rien dans le diff ne publie la candidate.
- Les corrections du Game couvrent les abonnements, les références après commit et les annulations de montage (`components/game.tsx:154`, `:390`, `:424`), le vocabulaire Proposer et l’état terminal de l’indice (`:655`, `:664`), la copie indépendante et son repli manuel (`:566`, `:716`) et la confidentialité entraînement/profil/sync (`:715`).
- Sélections Archives/Voyage : adaptation conditionnelle lors d’un changement de destination, sans écraser les choix manuels à chaque rendu (`components/game-parts/archive-calendar.tsx:14`, `components/expedition-picker.tsx:8`). Les Collections et le retour Studio retirent bien leurs abonnements et annulent leur microtâche abandonnée (`components/collection-picker.tsx:8`, `components/server-game-links.tsx:5`).
- Le changement `let` → `const` ne change pas la mutation du curseur Date (`lib/game-types.ts:18`). Aucun changement aux données V1, au producteur gelé, aux migrations ou à l’art de la flamme dans le diff. Les exclusions ESLint ajoutées concernent les artefacts/sorties déclarés (`eslint.config.mjs:17`), sans désactivation d’une règle source.
- **⚠️ Hors preuve de ce diff :** recette navigateur/clavier/focus réelle, écran mobile, presse-papiers natif, admission D1 complète et comportement hébergé. Les preuves antérieures et leurs dates ne sont pas requalifiées ici. Task7B2, la matrice 44, la suite finale et la publication restent explicitement ouvertes (`docs/review/implementation-status.md:9`).

## Points solides

- Les conteneurs des epochs sont capturés pour le nettoyage, leurs valeurs sont lues/incrémentées au moment du démontage ; la microtâche d’initialisation du montage abandonné est annulable (`components/game.tsx:424`). Le test monte le vrai Game en StrictMode et vérifie une seule restauration ainsi que le rejet d’un GET tardif après navigation Profil (`tests/game-integration.test.ts:52`).
- La garde GET compare les valeurs vivantes des deux epochs avant le commit (`components/game.tsx:251`). Le POST conserve la garde de requête, la référence d’énigme et la révision de saisie (`:517`, `:527`, `:532`). Les gardes de sync restent branchées sur les références courantes du board et invalident les réponses après admission (`:206`). Pas de remplacement de ces gardes par un snapshot de montage.
- La projection hebdomadaire conserve l’instant réel du snapshot et le renouvelle avec les faits ou le jour, sans reconstruire tout l’historique à chaque seconde (`components/game.tsx:116`, `:179`). Le test à 18 h puis +400 ms vérifie un objectif réellement incrémenté, au-delà du test textuel des dépendances (`tests/game-integration.test.ts:191`).
- Le partage n’inclut que compteurs, couleurs et URL ; la copie refusée n’émet pas de diagnostic de réussite, la copie confirmée en émet un (`components/game.tsx:566`, `:570`; `tests/game-integration.test.ts:75`). Les primitives Radix remplacées dans ce test ne sont pas présentées comme une certification navigateur.

## Problèmes

### Critical

Aucun.

### Important

Aucun.

### Minor

1. **La sentinelle sonore du nouveau harnais ne peut pas faire échouer une lecture audio.** `tests/game-integration.test.ts:45` fait lever `assert.fail()` dans le constructeur AudioContext, mais `components/game.tsx:52` / `:65` englobe précisément ce constructeur dans un `try/catch` qui absorbe toute exception. Une régression sonore pourrait donc passer ce contrôle ; le test de restauration ne rend pas non plus explicitement la préférence sonore active. Remplacer cette sentinelle par un compteur observable, activer le son dans la fixture et vérifier le compteur après restauration/import. Les assertions existantes de diagnostics demeurent utiles ; ce point n’est pas la preuve d’une régression de production.

2. **Les sorties de qualification restent bruitées, de façon déclarée et non bloquante ici.** `components/flame-scene.tsx:53` et `:54` produisent les deux avertissements d’image native ; `scripts/build-semantic-shards.mjs:85` et `scripts/verify-semantic-target-v2.mjs:142` les deux variables inutilisées. `work/task8a-tests-final.log:266` rapporte aussi la dépréciation react-test-renderer et `:762` le statut expérimental SQLite ; le build signale la classification statique incomplète de Vinext. Aucun de ces messages ne justifie de modifier l’art original ou les producteurs gelés pendant le job. Garder leur suivi explicite et traiter les avertissements de tooling dans un périmètre autorisé ultérieur, sans les masquer globalement.

## Vérification et limites de lecture

- Diff lu en une revue séquentielle. Le premier affichage intégral était tronqué : seules les portions manquantes ont ensuite été récupérées, dont les lignes ajoutées du duel et des entrées avancées. Aucun nouveau diff Git ni parcours du dépôt.
- Contextes coupés complétés : corps de `loadPuzzle` et `submit` dans Game, afin de juger les gardes GET/POST et les effets après réception. Contrôle focalisé des références de navigation/sync, pour vérifier que le nettoyage conserve des epochs vivants.
- Risque nommé « déplacement de modalRef en layout effect et fermeture Radix » : contrôle unique de `node_modules/@radix-ui/react-focus-scope/dist/index.mjs:92`. Le callback de fermeture est différé par un timer après le commit, ce qui permet au layout effect parent d’actualiser la référence avant le contrôle de focus. La vraie interaction Radix reste à la recette du contrôleur.
- Risque nommé « périmètre annoncé de la copie distante » : lecture ciblée de `lib/device-sync.ts:9` et `:37`, confirmant profil exporté, mots/scores/indices/épingles/contextes des parties en cours ; le chemin supposé `lib/profile-transfer.ts` n’existe pas et n’a pas été utilisé comme preuve. L’export interne complet inchangé n’a pas été réaudité.
- Risque nommé « confidentialité du cache entraînement » : vérification ciblée de `public/sw.js:1`, `:94` et `:143`, confirmant le téléchargement explicite et l’absence d’interception API. Risque nommé « sentinelle sonore » : complément du début de `playTone`, donnant le Minor 1.
- Journaux existants consultés : **141/141**, zéro échec/annulation/skip ; TypeScript exit 0 ; lint exit 0, zéro erreur et quatre warnings ; lint Game vide ; build vérifié exit 0 et « Build complete ». Le début du build confirme 120 cibles et SHA V1 `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`.
- `work/task8a-training-identity.json` confirme JS/CSS byte-identical ; `work/task8a-frozen-dependencies.json` contient neuf identités inchangées. Ces preuves ont été lues, pas recalculées. Aucun test, build, job numérique, serveur, sous-agent, push ou publication exécuté pendant la revue.

## Appréciation

**Task quality: Approved.** Les changements 8A préservent les gardes essentielles et apportent des tests comportementaux utiles. Les deux remarques mineures ne bloquent pas la recette UI suivante ; cette approbation n’est ni la revue whole-branch ni le gate public Task8B.
