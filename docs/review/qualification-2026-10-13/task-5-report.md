# Lot 5 — Studio, projection et laboratoire

HEAD livré et vérifié : `aac0bdd61d439a181e99e6b23d7323871b6bc20f`.
Base : `70145326a4016eb4f7ea82814f35547f3522dde1`.
Commit : `feat: complete studio projection and finite laboratory sessions`.

## Réalisations

| Critère | Résultat | Fichiers principaux |
|---|---|---|
| D19 / A11 | Titre personnel de 1–80 caractères, description 0–320, texte simple sans balises/caractères de contrôle ; trois préréglages visuels Braise/Papier/Nuit. Aperçu participant avec la même carte que l’édition réelle, progression et bouton d’aperçu explicitement désactivé. Liste ordonnée conservée. | `components/studio.tsx`, `components/studio-preview.tsx`, `lib/studio-metadata.ts` |
| D19 / A11 | Bouton « Publier cette version », métadonnées et étapes copiées dans l’édition immuable. Modification du brouillon sans modification de l’édition. Duplication des seuls brouillons du propriétaire, nouvelle révision 0 sans éditions ; quota/CSRF/origine/session conservés, verrou immédiat et identifiant de duplication conservé en cas de réponse perdue. | `lib/studio-store.ts`, `app/api/studio/route.ts` |
| D19 / A11 | Audience explicite : toute personne munie du lien et d’une identité invitée ; aucune liste publique des créations. Retrait expliqué : lien indisponible et parties commencées bloquées, autres éditions inchangées. Choix des cibles exclusivement au catalogue, 1–12 étapes distinctes ; aucun upload ni CSS ou cible libre. | Studio, catalogue, store |
| D20 | API dédiée `/api/projection`, authentification et propriété existantes ; liste blanche contenant seulement révision, victoire, températures et horodatage réel. Aucun mot, graine, solution, identité ou essai adverse dans la réponse. Retrait de l’édition bloque également cette API. | `app/api/projection/route.ts`, `lib/projection.ts` |
| D20 | Actualisation manuelle, dernière actualisation réussie, état frais/ancien (>45 s), panne distincte effaçant les scores affichés et conservant l’horodatage précédent. Polling facultatif toutes les 15 s, arrêt de minuterie et annulation réseau en fenêtre masquée, refus des réponses annulées. | `components/streamer.tsx` |
| D21 | Parcours choix → explication → prochaine énigme non jouée ; bilan fini des vingt premières réponses, nombre exact de bonnes réponses/à revoir et toutes les explications. Reprise du bilan sans réenregistrer de choix ni effet/focus. Refus serveur d’une série incomplète, répétée ou hors édition. Sortie vers Deux braises. | `components/intruder-game.tsx`, `lib/intruder-server.ts`, `/api/intruder/summary` |
| D22 | Deux panneaux Cible A/B identifiables sans couleur, meilleure température/rang effectivement reçus, états trouvés acquis indépendamment, fin seulement lorsque les deux cibles sont résolues. Historique compact avec en-têtes et labels A/B. Aucun score combiné. | `components/two-braises-game.tsx`, CSS ciblé |
| D03/D10/D26 | Navigation commune Jouer/Explorer/Profil/retour dans les quatre écrans ; Envoyer/Envoi…, formats français ; messages d’erreur, focus de résultat et conservation de la saisie modifiée pendant requête. | Composants concernés |

## Migration

Migration append-only générée par `node scripts/run-site.mjs db:generate` : `drizzle/0006_sour_quicksilver.sql`, snapshot Drizzle 0006 et entrée ajoutée au journal. Ajout `description` (défaut vide) et `visual` (défaut `ember`) aux brouillons et éditions. Les anciennes créations gardent leur titre/étapes. Migrations 0000–0005 inchangées. À appliquer sur le D1 cible avant publication du worker ; aucune migration distante exécutée ici.

## Preuves finales

- `node scripts/test-studio-variants.mjs` : **exit 0, 88 tests / 88 pass / 0 fail / 0 skip**, log `work/task5-tests.log`. Suites : studio-variants, studio-variants-components, server-store, intruder, two-braises, social-sync, game, compatibility, profile-storage, foundations.
- Les tests React exercent les vrais composants et handlers : édition/aperçu/validation/envoi unique/duplication Studio ; vingt choix puis bilan calculé et restauration ; scores A/B différents, cible A acquise puis victoire B, saisie conservée ; polling explicite, minuterie stoppée et réponse annulée ignorée. Deux régressions de courses sont couvertes : choix Intrus ancien pendant navigation et envoi Deux braises d’une ancienne paire dans le même tour d’événements.
- `node scripts/qualify-studio-local.mjs` : **exit 0, PASS réel D1 local**, log `work/task5-d1.log`. Miniflare isolé `work/d5-*`, migrations0000–0006, routes Studio/projection réelles, authentification/CSRF/origine, autre propriétaire404/409, duplication propre, publication et édition de toutes les métadonnées sans altérer le publié, conflit de révision409, progression sans futurs mots/graines, projection numérique sans mot, accès autre identité404, retrait bloquant projection/entrée, session révoquée403. Données et score fixtures explicitement locaux ; runtime disposé.
- `node scripts/run-site.mjs typecheck` : **exit 0**, log `work/task5-typecheck.log`.
- Lint ESLint ciblé sur tous les fichiers TS/TSX/MJS touchés : **exit 0**, log `work/task5-lint.log`. Liste : composants Studio/preview/streamer/intruder/two-braises, modules studio-store/catalogue/metadata/projection/intruder-server, trois routes API, db/schema, trois fichiers tests touchés et trois scripts ajoutés. Les dérogations locales documentées concernent uniquement la restauration navigateur après hydratation, sans effet de jeu. Aucun lint global déclaré vert : baseline Game connue 9 erreurs/5 avertissements, Game inchangé.
- `node scripts/build-verified.mjs` final, après tous les ajustements produit : **exit 0 collecté, “Build complete”**, log `work/task5-build.log`. Vérification V1 frozen : SHA256 source `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`, 120 cibles, aucune réécriture d’asset canonique. Avertissements de classification statique Vinext conservés dans le log.
- `git diff --check` et `git diff --cached --check` : **exit 0**. Arbre propre après commit ; rapport dans le dossier local de suivi ignoré.

## Auto-revue et limites

La relecture du diff a ajouté une liste blanche serveur pour la projection (l’ancienne interface recevait puis masquait les mots), les gardes immédiates de navigation, l’envoi des seuls champs éditables pour éviter d’inclure la liste croissante des éditions dans la requête bornée et le rejeu de duplication avec le même identifiant. Les tableaux/panneaux utilisent uniquement les évaluations réellement retournées, jamais de température fabriquée.

Conformément au cadrage contrôleur, aucune suite V2 lourde inchangée ni suite exhaustive relancée : nouvelle baseline générale fournie au départ 264 tests, 261 pass, 0 fail, 3 skips EPERM Windows explicites ; les anciens 11 échecs Windows sont corrigés dans le lot7A. Ce lot n’affirme pas une qualification complète de toute l’application. La dépréciation de react-test-renderer est visible dans les logs ; ses tests ne remplacent pas la recette navigateur.

Restent au lot8 : recette visuelle responsive/clavier, parcours Studio publié/retrait/participant avec plusieurs identités, projection en navigateur réel et coupure réseau, application de migration distante, activation éventuelle des fonctionnalités et déploiement. Aucun preview server, push, déploiement, drapeau de release ou corpus V2 activé ; aucun fichier pipeline, donnée/preuve du contrôleur, moteur ou asset V1 modifié. Le bilan Intrus est personnel, dérivé des réponses locales, sans valeur compétitive ; aucune modération humaine ou audience mesurée n’est prétendue.

## Correction ciblée après revue — I1 et M1

**HEAD final livré et vérifié : `417d5f8e3c77a39ddf83fb9e9709763ce0083e32`**, base de correction `aac0bdd61d439a181e99e6b23d7323871b6bc20f`. Commit : `fix: recover studio duplication by durable source receipt`.

**I1 corrigé.** La destination de duplication conserve désormais `duplicated_from`, écrit atomiquement avec sa copie par `INSERT … SELECT`. Un rejeu retrouve cette destination uniquement si propriétaire, source et session active correspondent ; il ne compare plus la copie au contenu mutable de la source. Les modifications ultérieures de la source, et même l’atteinte du quota de 50 brouillons, n’empêchent donc pas la récupération. Aucun champ reçu du client ne peut changer cette provenance ; `save` ne la réécrit pas. Une réutilisation du même ID pour une autre source, un brouillon ordinaire ou un autre propriétaire est refusée. L’insertion reste bornée par le quota et la révision source. Le composant Studio conservait déjà l’ID inconnu après une panne et le libérait après succès : ce comportement reste inchangé, désormais prouvé contre la vraie API et le vrai store ; une duplication volontaire suivante possède son propre ID.

**M1 corrigé.** Intrus conserve le type de l’opération à réessayer (question/index ou bilan). Après panne du bilan, « Réessayer » rappelle bien `/api/intruder/summary`, sans charger une énigme.

**Migration append-only 0007** : `drizzle/0007_numerous_bishop.sql`, générée avec le vrai Drizzle et snapshot/journal associés. Seul ajout : colonne nullable `braise_studio_drafts.duplicated_from`. Toutes les migrations/snapshots 0000–0006 restent intacts. Les anciens brouillons gardent une provenance NULL : aucune origine historique n’est inventée et un identifiant sans provenance ne peut être adopté comme reçu. Pour le déploiement ultérieur, appliquer 0006 puis 0007 avant le worker. Aucune migration distante effectuée.

### Preuves de cette correction

- Rouge probant : `node work/task5-fix1-red.mjs`, exit1, **13 tests / 10 pass / 3 fail**. Ce runner local rebundle les fonctions StudioStore et IntruderGame de `aac0bdd` en mémoire avec les nouveaux tests, sans réécrire le checkout. Log `work/task5-fix1-red-corrected.log` : après source modifiée le composant reste sur Updated plutôt que récupérer Original ; le store rend undefined ; Retry appelle `/api/intruder` au lieu du bilan. Les essais préliminaires utilisaient deux fixtures incomplètes (Content-Type, date ISO) ; seules les preuves corrigées sont retenues.
- Vert final : `node scripts/test-studio-variants.mjs`, **exit0, 91/91 pass, 0 fail, 0 skip**, `work/task5-fix1-tests.log`. Nouveaux tests : vrais composant→API→store avec réponse perdue après écriture, édition/enregistrement source puis récupération de l’unique copie, nouvelle duplication volontaire distincte ; store/rejeu ordinaire et après mutation, source-ID/propriétaire/ID ordinaire refusés, quota50 et révocation ; vrai bouton Retry Intrus après panne du bilan. Attente bornée des vraies opérations asynchrones dans le test composant, sans remplacer leurs résultats.
- D1 réel : `node scripts/qualify-studio-local.mjs`, **exit0 / PASS**, `work/task5-fix1-d1.log`. Migrations0000–0007 sur Miniflare local isolé ; rejeu du même ID après modification source, 409 pour mauvaise provenance, insertion refusée au quota50 mais récupération existante200, plus invariants Studio/projection/auth précédents. Fixtures locales ; runtime disposé.
- `node scripts/run-site.mjs typecheck` : **exit0**, `work/task5-fix1-typecheck.log`.
- `node node_modules/eslint/bin/eslint.js lib/studio-store.ts components/intruder-game.tsx db/schema.ts tests/studio-variants.test.ts tests/studio-variants-components.test.ts scripts/qualify-studio-local.ts` : **exit0**, `work/task5-fix1-lint.log`.
- `node scripts/build-verified.mjs` : **exit0 collecté / Build complete**, `work/task5-fix1-build.log`. Source V1 frozen inchangée SHA256 `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`, 120 cibles. Avertissements statiques Vinext habituels dans le log.
- Auto-revue du seul diff I1/M1 : propriété/provenance/état actif vérifiés tant avant rejeu qu’après insertion, INSERT atomique et quota conservés ; nouveau ID distinct seulement après succès connu ; garde de navigation Intrus conservée. `git diff --check` et contrôle staged exit0 ; arbre propre après commit.

Pas de nouvelle revue large, suite exhaustive, pipeline V2, serveur de prévisualisation, push, déploiement ou activation. Le job numérique du contrôleur et ses fichiers restent intacts. Limites de recette navigateur et de qualification globale précédentes inchangées ; lint global non revendiqué. Correction prête pour une revue indépendante limitée à I1/M1 et à ce diff.
