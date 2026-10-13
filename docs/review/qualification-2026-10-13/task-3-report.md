# Task 3 — progression, statistiques et rappel personnel

Statut : implémentation terminée, base `a713d49b7070bee32232fd2ff5b20794565f94a1`, branche `codex/full-review-implementation`. Aucun push, serveur propre, déploiement, activation V2 ni activation des modes avancés. Publication et revue indépendante restent au contrôleur. Documentation commitée : `docs/FULL-REVIEW-PERSONAL-PROGRESS.md`.

## Matrice ID / fichiers / preuves

| ID | Réalisation concrète | Fichiers et preuves |
| --- | --- | --- |
| D11 | Profil directement accessible par l’URL et navigation existantes, résumé court puis objectifs ; détails/réussites, styles, préférences et données séparés. Ancienne fenêtre stats et chemin intermédiaire supprimés. XP calculé avec la formule existante, sans crédit nouveau. | `components/profile-panel.tsx`, `.css`, raccordement `components/game.tsx`; test SSR, contrôles TypeScript/build |
| D12 | Les trois objectifs existants sont visibles dans le profil public même avec release flag false. Progrès x/y, dates/fin Paris et nom de la récompense ; détail des styles permanents et sélection explicite. | `components/weekly-ritual.tsx`, profile-panel ; tests weekly-ritual et profile-storage inchangés, tous exécutés |
| D13 | Tableau « Ce qui sera transféré » avant export/import ; profil seulement, préférence son distincte des animations/rappel, parties en cours/épingles/serveur explicitement exclus. Aperçu, confirmation, annulation/révision/conflits conservés. Aperçu non prêt peut être fermé. Une ancienne lecture échouée de fichier n’écrase plus le message d’une sélection plus récente. | `components/profile-transfer.tsx`; suite profile-storage (migration, crédit stable, fusion, import incompatible/revision/refus avant mutation), test SSR table |
| A13 | Réussites par mode, médianes essais/indices et indices totaux **sur réussites renseignées**, dénominateur séparé ; quotidiens et archives distincts ; évolution sur les seuls completedAt valides/passés à Paris ; historique complet consultable par pages50. Les anciens faits restent dans les totaux, signalés incomplets, sans datation artificielle. | `lib/personal-statistics.ts`, profile-panel ; tests empty/invalid/median/dedup/archive-streak/date-Paris/future/denominators |
| A10 | Rappel facultatif proposé après trois jours acceptés observés localement ; choix horaire/fuseau/date/horizon ; ICS borné avec DST réel, arrêt immédiat dans BRAIZ, même UID pour le fichier d’arrêt et guidance explicite pour suppression externe. État de version future/corrompu conservé. | `lib/calendar-reminder.ts`, `components/calendar-reminder.tsx`; huit tests couvrant branches dates/DST/encodage/arrêt/engagement/stockage |
| D26 Profil | Boutons nommés, états écrits, détails natifs, tableaux avec caption/th/scope, régions défilables au clavier, outline visible, cibles44px. Aucun changement du système de pause/flamme. | `components/profile-panel.css`, SSR ; recette navigateur initiale par contrôleur |
| D27 raccordement | Diagnostic local du lot1 monté dans la section données ; seulement les actions volontaires d’export et d’import successful observées. Les faits importés ne deviennent jamais événements de jeu. | `ProductDiagnostics` consommé tel quel ; `recordProductEvent(...profileExported/profileImported,"profile")` |

## Rulings appliqués et contrats consommés

Le contrôleur a approuvé le seuil de rappel : **trois jours distincts à Paris avec événements locaux `firstGuessAccepted` ou `guessAccepted`**. Ni ouverture de jeu, ni restauration, import, ancien total ou changement de préférence n’y contribue. `readProductEvents` retourne un schéma fermé et peut refuser un journal illisible/futur ; dans ce cas aucune éligibilité n’est affirmée. Le journal étant borné et non exhaustif, ce choix peut produire un faux négatif, jamais un fait de sessions inventé. Ce n’est ni une audience ni une preuve de demande des joueurs.

Ruling calendriers approuvé, précisé au correctif I2 : série limitée par `DTSTART` + `RDATE` UTC issus du fuseau IANA réel, **30 jours par défaut, 1–90 jours explicites**. Chaque date locale fournit les décalages voisins de DST (y compris fractions d’heure), puis vérifie les instants candidats par formatage inverse ; premier instant exact en cas de doublon, refus d’une heure inexistante. Aucun RRULE en UTC fixe ni TZID sans définition. CRLF, échappement TEXT, pliage à 75 octets UTF8 sans découper un caractère. `UID` stable, `SEQUENCE:0` actif, `SEQUENCE:1` arrêt, `STATUS:CANCELLED`, pas d’alarme dans l’arrêt. **Objet autonome RFC5545 sans propriété METHOD**, ORGANIZER, ATTENDEE, invitation ou envoi réseau. Le choix initial `METHOD:PUBLISH` était incompatible avec l’absence d’organisateur imposée par le besoin ; il a été supprimé au correctif I2, après vérification de RFC5546 §3.2.1 et RFC5545 §3.7.2. Références primaires consultées, liens dans la documentation.

Le lecteur du reçu vérifie structure fermée/version/borne et recalcule les dates, conserve les états inconnus ou horaires altérés et refuse leur écrasement. Le garde refuse un autre UID encore préparé. Les événements de stockage mettent à jour l’interface inter-onglets silencieusement. Retélécharger un rappel actif revalide son identité et absence d’arrêt ; un arrêt connu ne produit pas un ancien fichier actif. Le stockage local n’est pas une transaction entre processus ; cette limite est documentée.

L’arrêt local est immédiat dans l’interface. Un échec d’écriture indique explicitement qu’il vaut seulement pour la session et que les données enregistrées restent intactes. Le fichier est présenté comme **préparé, ajout externe non vérifié**. La guidance de suppression manuelle reste visible près des actions et dans l’ICS. L’import/export calendrier, son annulation effectivement honorée et les alertes OS ne sont pas déclarés qualifiés.

Interfaces réutilisées :

- Lot1 : `formatDateFr`, `formatNumberFr`, `ProductDiagnostics`, `readProductEvents`, `recordProductEvent`; navigation AppNavigation déjà montée par lot2.
- Lot2 : Game conserve intégralement ses garde de générations/époques/navigation, admission write/progression, réponse courante, focus tutoriel et reprise/réessai. Seuls imports/ancienne section Profil/stats sont remplacés. Props `ProfilePanel` transportent snapshot/ritual/now/busy/flamePaused et callbacks déjà existants `saveSound`, `toggleAnimations`, `selectCosmetic`, `setProfileSnapshot`, `navigate("game")`.
- Profil existant : `createLocalProfileExport`, `inspectLocalProfileImport`, `importLocalProfile` inchangés. `profile-storage`, `legacy-storage`, `game-types`, `weekly-ritual` librairie et leurs schémas/migrations n’ont aucun diff.
- Nouvelles APIs pures : `median`, `personalStatistics`, `createCalendarReminder`, `calendarReminderFile`, `escapeCalendarText`, `foldCalendarLine`, `dateInReminderZone`, `reminderEligible`, `readCalendarReminder`, `writeCalendarReminder`; types `ReminderOptions`, `CalendarReminder`, clé `braiz.calendar-reminder.v1` séparée du profil. L’export/import profil exclut ce reçu.
- Lot4 doit ajouter sa propre action/format de synchronisation complète ; aucune fusion des formats n’est anticipée ici.

## Vérification exacte

Répertoire : clone isolé `work/braiz-source`. Journaux ignorés dans `work/`.

| Commande | Résultat final | Trace |
| --- | --- | --- |
| `node scripts/test-personal-review.mjs` | **118 tests /118 pass,0 fail,0 skipped**,6715.8594ms, code0 | `work/task3-focused-final.log` |
| `npm run typecheck` | code0, aucune erreur | `work/task3-typecheck-final.log` |
| `npm run build` | code0, `Build complete`, objets V1 `verified-frozen`,120 cibles | `work/task3-build-final.log` |
| `node --input-type=module -e 'import {runTool} from "./scripts/run-site.mjs"; process.exitCode=await runTool("eslint",["components/profile-panel.tsx","components/calendar-reminder.tsx","components/profile-transfer.tsx","components/weekly-ritual.tsx","lib/personal-statistics.ts","lib/calendar-reminder.ts","scripts/test-personal-review.mjs"],{timeoutMs:60000});'` | code0, aucun diagnostic | `work/task3-lint-final.log` |
| `git diff --check` | code0, seuls avertissements LF/CRLF Git | contrôle final |
| `git diff --name-only -- data public lib/game-types.ts lib/game-contracts.ts lib/game-feedback.ts lib/game-navigation.ts lib/game-write-admission.ts lib/legacy-storage.ts lib/profile-storage.ts lib/weekly-ritual.ts lib/release.ts components/flame-scene.tsx` | sortie vide, code0 | invariants inchangés |

Le runner ciblé inclut `personal-statistics`, `calendar-reminder`, `profile-panel`, `profile-storage`, `weekly-ritual`, **tous** les noms du runner core-review : `game-review-fixes`, `game-core-review`, `game-feedback`, `game`, `compatibility`, `archive`, `collections`, `expeditions`, `flame-presentation`. Les tests V1/cœur passent avec les nouveaux raccordements. Le runner général conserve ses suites mais externalise aussi `react-dom` : l’import SSR de Progress/Base UI nécessitait sinon un require CommonJS dynamique absent du bundle ESM. La suite complète lourde n’a pas été lancée, conformément au ruling ; les11 échecs Windows préexistants lot7 ne sont pas déclarés corrigés ni verts.

Cycles observés : tests des nouvelles interfaces écrits avant les modules (échec de compilation attendu pour trois modules absents, `work/task3-red.log`), premier passage107/108 (runnerSSR react-dom), correctif d’infrastructure108/108, ajout tests reçus multi-onglets109/109, élargissement aux suites core complètes118/118. Un premier lint direct est resté sans sortie et son seul PID a été arrêté ; l’exécution portable bornée a ensuite terminé code0. Aucun processus du contrôleur touché.

Recette initiale du contrôleur (Worker 5198, capture `04-profil.jpg`) : Profil 0 victoires / 0 série correct ; objectifs 0/15, 0/3, 0/2 ; médianes vides « Non disponible ». Le contrôleur a relevé une copie ambiguë de succès qui pouvait présenter le seuil 3 comme série courante : ajout d’une assertion SSR, échec 1 (`work/task3-copy-red.log`), remplacement par **« Atteindre une série de 3 quotidiens de suite »**, puis 118/118. Aucun changement du crédit/succès. Le contrôleur a arrêté son Worker exact et vérifié le port libre avant la dernière construction autorisée.

Source V1 figée vérifiée : `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`. Aucun asset généré/réécrit. L’avertissement Vinext sur la classification statique de certaines routes reste celui du socle, sans échec. Pas de serveur propre, sous-agent, push ou publication.

## Auto-revue et réserves

Contrats V1/oracle/lecteur/corpus/seeds/calendrier canonique, stockage de progression/migration/backup brut, crédits append-only, récompenses immuables et flamme/reduced-motion conservés. Aucun import sémantique serveur client, score synthétique, audience inventée ou activation du release flag. Reread/restore/calendar-storage ne déclenchent téléchargement, permission, effets, toast, son ou focus. Les callbacks son/style existent et ne sont invoqués que par actions explicites.

Tests pures/SSR et suites contrats ne montent pas le cycle DOM intégral de Game, ni le lecteur d’écran ou un service calendrier réel. La recette globale clavier/mobile/zoom et relectures avancées ainsi que les services externes restent au lot8. L’état local et les statistiques peuvent être incomplets, et restent non compétitifs. La proposition de rappel peut être absente après effacement/cap du journal sans déduire un manque d’engagement.

Commit source/docs : **`fbcf6d652578754a0f580d34ad30745fce5782a1`**, 14 fichiers, 506 insertions / 18 suppressions. Working tree propre après commit. Construction finale achevée avant commit, code 0, sur tous les fichiers de production de ce commit. Rapport dans le workspace SDD ignoré ; aucune publication.

## Correctifs après revue — tour 1

Base `fbcf6d652578754a0f580d34ad30745fce5782a1`. Rapport traité : `task-3-review.md`, uniquement **I1 et I2**. Aucun changement du profil exporté, moteur, crédits, lecteur V1, garde Game, style, seuil d’engagement, encodage/dates/stockage calendrier ou guidance externe. Aucun sous-agent, serveur, push ou déploiement. Le contrôleur a confirmé son preview arrêté avant construction.

### I1 — description fidèle des mots transportés

Le tableau indique désormais « Faits de progression et mots associés » → Oui, avec « ordre, date et référence de partie ». La ligne exclue vise précisément les sauvegardes complètes des parties en cours, scores détaillés et épingles. Le paragraphe avant transfert et le message après téléchargement précisent aussi les mots associés en clair. La documentation distingue ces faits de la reprise complète d’une partie. Aucun changement de `createLocalProfileExport`, de ses activités/preuves ni du format/version/scope.

Le nouveau test passe par `loadLocalProfile`, `recordLocalGameProgress` avec une proposition acceptée `maison` dans `free-1`, puis le vrai `createLocalProfileExport`. Il constate effectivement `activities[0].word="maison"`, `order=1`, `occurredAt="2026-10-12T10:00:00.000Z"` et référence `free-1`, sans température/rang ni sauvegardes/épingles. Il rend ensuite le composant réel `ProfileTransfer` et vérifie les lignes inclus/exclus et le détail ordre/date/référence. Il ne déduit pas la portée d’une recherche dans les sources et ne retire pas les preuves nécessaires à la progression.

### I2 — calendrier autonome sans méthode iTIP

La propriété `METHOD:PUBLISH` a été retirée des fichiers actif **et** d’arrêt, sans organiser ou destinataire fictif. Commentaire du générateur, documentation et ruling du rapport sont rectifiés : objets iCalendar autonomes RFC5545, pas de transaction de planification. La source normative RFC5546 §3.2.1 impose un ORGANIZER pour PUBLISH ; RFC5545 §3.7.2 précise qu’en l’absence de METHOD, l’objet transporte un instantané sans transaction de planification. Sources reconsultées directement sur rfc-editor.org ; aucun refus propre à Apple/Google n’est inventé.

Les assertions des fichiers actif/arrêt interdisent toute ligne METHOD/ORGANIZER/ATTENDEE. Les mêmes tests conservent leurs assertions UID commun, séquences 0/1, STATUS:CANCELLED, dates/RDATE identiques et absence d’alarme pour l’arrêt. Les tests DST/fuseau/limites/échappement/CRLF/UTF8/corruption/concurrence restent exécutés inchangés.

### Contrôles du tour

Tests de non-régression écrits avant correction : `node scripts/test-personal-review.mjs` a échoué sur **3 assertions correspondant aux deux défauts** (`work/task3-fix1-red.log`, code 1). Après correction : **119/119 pass, 0 fail, 0 skipped**, 5667.2193 ms, code 0 (`work/task3-fix1-targeted-tests.log`). Le runner inclut toutes les suites profil/weekly/transfert et core du tour initial.

Commandes finales : `npm run typecheck` (`work/task3-fix1-typecheck.log`), `npm run build` (`work/task3-fix1-build.log`), `git diff --check`, contrôle de diff vide pour `data`, `public`, Game, `profile-storage` et release. La suite lourde V2 inchangée et ses 11 échecs Windows suivis au lot 7 n’ont pas été relancés. Compatibilité/annulation d’un calendrier externe et recette intégrale d’accessibilité restent des limites documentées.

Commit du tour : **`b7d1560d255d5063e0a2ddad3a8ed7804eaae237`**, 5 fichiers, 37 insertions / 11 suppressions ; working tree propre. TypeScript : code 0, aucune erreur. Construction finale : code 0, `Build complete`, V1 `verified-frozen`, 120 cibles, SHA source inchangé `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`. Lint portable ciblé (`runTool("eslint",["components/profile-transfer.tsx","lib/calendar-reminder.ts","tests/profile-panel.test.ts","tests/calendar-reminder.test.ts"],{timeoutMs:60000})`) : code 0, log vide `work/task3-fix1-lint.log`. Diff-check : code 0, seuls avertissements LF/CRLF Git. Aucun diff des invariants listés, aucune régénération d’assets. Les changements sont limités aux descriptions d’export, retrait de METHOD, assertions associées et documentation. Re-revue indépendante I1/I2 attendue ; aucun autre élément approuvé rouvert.
