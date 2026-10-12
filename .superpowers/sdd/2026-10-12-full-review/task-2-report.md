# Task 2 — Jeu, découverte et reprise

Statut : implémentation terminée sur `codex/full-review-implementation`, base `42d383a`. Aucun push, déploiement, activation V2 ou activation de `EXTRA_MODES_ENABLED`. Le contrôleur conserve la recette navigateur et la qualification finale.

## Matrice de réalisation

| ID | Réalisation et raccordement effectif | Preuve / portée |
| --- | --- | --- |
| D03 | `Game` conserve Envoyer et affiche Analyse… pendant le POST. Tutoriel : mêmes verbes. Saisie modifiable et contrôles d’action désactivés. | TypeScript et build ; gardes de réponse existantes conservées, tests `game-feedback` et `game-core-review`. Plateaux serveur/variantes relèvent des lots suivants. |
| D04 | Texte permanent Indice après 5 essais, compteur x/5, puis nombre restant sur 3, indépendant du bouton désactivé. Contraste sur le plateau ivoire renforcé. | Lecture du JSX raccordé ; déverrouillage dérivé directement des essais acceptés et règles serveur inchangées. |
| D05 | Dernier essai nommé, meilleure piste conservée, explication de température et de rang / 30 000. Scores formatés via `formatScoreFr`, sans nouveau calcul. | Réponses V1 réelles ; tests du moteur et oracle de compatibilité. |
| D06 | « Le sens compte, pas les lettres » immédiatement près de la saisie ; entrée facultative dans le tutoriel. | Rendu du Game, retour à la partie sans remplacement de la saisie, conservation du retour de focus. |
| D07 | Marque DERNIER dans l’historique, tri actif explicitement nommé, explication des trois épingles, boutons d’ajout/retrait nommant le mot. | Épingles V1 conservées ; modification pendant POST toujours interdite. |
| D08 | Badge/date visibles dans la ligne du plateau, formulaire archive et retour au quotidien conservés, règle de série explicite. | `archive.test.ts` ; même identité `daily-YYYY-MM-DD`, limites serveur inchangées. |
| D09 | Libre décrit les 120 cibles, la conservation des parties commencées dans Explorer et la stabilité des anciens liens. Remplacement volontaire via Découvrir un autre mot. | Anciennes parties et pins accessibles au hub ; nouveau paramètre `libre` conserve le mode libre au rechargement. |
| D10 | `AppNavigation` raccordé à Jouer / Explorer / Profil ; état `surface` dans l’URL, boutons Retour navigateur, jeu maintenu pendant changement de surface. | Accès public direct `/?surface=explore` et `/?surface=profile`. Contexte archive/défi/libre et parcours conservé ; liens avancés restent gated. |
| D14 | Cinq cartes collection avec titre, état, compteur, reprise d’une énigme réellement commencée et détails de choix. Recoupements expliqués. | `CollectionPicker` raccordé à la surface Voyage/Collections sous le flag existant ; pas de nouvelle récompense. Tests collections existants et contexte explicite. |
| D15 | Bandeau Voyage et prochaine étape fondée sur `resumeExpedition` préservés. Contexte local mémorise le nom et l’étape réellement obtenus ; collections possèdent aussi une suite directe. | Tests expéditions existants, aucune étape déduite d’une seed inconnue. Validation des preuves côté serveur inchangée. |
| D26 | Labels, texte de statut, focus visible, nom des épingles, calendrier clavier, contraste du texte sur fond ivoire, cible de retour au plateau. | Contrôles logiques et revue source ; recette clavier/mobile réelle laissée au contrôleur. |
| D29 | Titre dupliqué supprimé, marges du header réduites, information groupée autour de l’entrée, typographie adaptative. Artwork et renderer identiques. | Test flamme existant ; surcharge mobile de l’ancienne règle de focus maintient 260 px au lieu d’un saut vers 160 px. Dimensions normales 322×310 / 270×260 inchangées ; aucun effet supplémentaire. |
| A01 | `PlayTutorial` est monté dans un Dialog depuis le champ et Explorer. Trois étapes, deux propositions réelles comparées, sortie/reprise immédiate. GET dédié retourne un exemple V1 différent de la cible quotidienne courante ; POST V1 exact. | Test réel GET/POST avec segment immuable. Aucun appel de sauvegarde de jeu/profil/récompense dans le tutoriel. Gardes d’identité, de démontage et de révision de saisie. |
| A02 | `ResumeHub` lit les parties V1 valides, affiche essais, épingles, mode, date réelle ou inconnue, collection/étape quand explicitement enregistrées. Reprendre la partie affichée conserve aussi la saisie en cours. | Tests dates Paris, archives vs quotidien, corruption, zéros initiaux, route collection/expédition. Le lien vers `/espace` reste réservé au flag avancé et distingue le stockage en ligne. |
| A03 | Bilan ouvrable dans la victoire : propositions personnelles, indices réellement présents, premier passage à 18/35/55°, meilleures pistes hors réponse. Action contextualisée : étape/collection, partie inachevée ou découverte. | `gameSummary` testé ; partage existant ne transporte ni `g.word` ni meilleure piste ni réponse. |
| A04 | Calendrier mensuel + date native, états locaux Terminé/Commencé/Non joué, filtres dont À reprendre, flèches ±1/±7 jours, Home/End, mois précédent/suivant. | Dates serveur toujours contrôlées. Test SSR additionnel : vide, chaîne invalide, mois impossible, date impossible, avant lancement et futur affichent un mois sûr. |
| A05 | Découverte serveur par 120 identités de cible opaques ; résolution des références historiques, déduplication réelle des cibles, préférence de nouveauté jusqu’à épuisement, explication puis rejeu explicite. | Test intégral des 120 cibles distinctes, épuisement puis rejeu ; deux seeds/date visant la même cible dédupliquées ; seeds fixes et zéros initiaux inchangés. |
| A09 | Une recommandation principale explique le fait personnel utilisé : partie réellement commencée, sinon autre cible après victoire ou invitation neutre à commencer. Action après victoire choisit d’abord le parcours/collection puis une partie inachevée. | `resumeSuggestion` et hub raccordés ; aucun niveau de difficulté, affinité, audience ou popularité inventé. |
| A12 | Refus lexical 422 distinct du réseau ; saisie conservée. Fiche JSON téléchargée uniquement sur demande, contenant le mot refusé affiché au joueur. Aucun envoi externe ni suggestion inventée. | Signalement borné à une proposition (50 caractères) ; journal diagnostique ne reçoit que le type d’action, jamais le mot. |

## Fichiers et interfaces pour les lots suivants

- `components/game.tsx` : orchestration et points d’entrée. Section `surface === "profile"` et fenêtre `stats` disponibles pour extraction du lot 3. Préférences/profil existants conservés. Le montage de `ProductDiagnostics` appartient au lot 3.
- `components/game-parts/play-hub.tsx` : `ResumeHub({plays,currentId,onResume,onDiscover})` et `WinSummary({game})`. Le lot 4 pourra ajouter une zone de reprises authentifiées explicitement distincte des cartes locales.
- `components/game-parts/play-tutorial.tsx`, `archive-calendar.tsx`, `game-parts.css` : composants focalisés, CSS importée par Game. Le calendrier normalise la date sélectionnée avant de calculer le mois. Les liens avancés n’ont pas été activés.
- `components/collection-picker.tsx` : callback additif `onSelect(seed, collectionId?)` ; état commencé lu depuis les vraies sauvegardes locales.
- `lib/play-hub.ts` : `readLocalPlays(storage, now?)`, `rememberPlayContext(storage,id,context)`, `readContexts`, `resumeSuggestion`, `gameSummary`. `LocalPlay` contient le mode, locator exact, sauvegarde, URL locale et date connue éventuelle. Pour A06, le lot 4 doit continuer à valider et fusionner les sauvegardes, jamais transformer ces faits locaux en preuve compétitive.
- `braiz.play-context.v1` : `{version:1,items:{[puzzleId]:{mode,collection?,expedition?,expeditionStep?}}}`. Identifiants éditoriaux contrôlés, aucune solution ni saisie libre dans ce fichier de contexte. Une forme corrompue/future est conservée et interdit sa réécriture. Sans contexte historique connu, une ancienne seed reste Partie libre ; aucun voyage n’est deviné.
- `lib/free-discovery.ts` : `braiz.encountered.v1`, version 1, au plus 120 SHA-256 opaques ; lectures limitées à 10 000 caractères, corruption préservée. C’est un historique personnel de découverte, pas un identifiant de joueur ni une preuve antitriche.
- `lib/free-discovery.server.ts` est **strictement serveur** : manifeste historique uniquement. Exclusions ≤120, références historiques ≤3000, schémas fermés pour ces champs, rejet des références invalides/futures. Rejeu choisit une nouvelle seed qui résout réellement la cible sélectionnée sans écraser une partie existante. Les mappings V1 sont uniquement consultés.
- API additive : GET habituel ajoute `targetIdentity`, GET `?tutorial=1` fournit un exemple réel sans état persistant, POST `{action:"discover",excluded,encountered,replay}` renvoie `{exhausted,remaining,encountered,puzzle}`. Aucun mot/score/solution dans la découverte. Corps ≤64 000 caractères, limitation de trafic existante conservée. API de guess/hint et références inchangées.
- `scripts/test-core-review.mjs` : commande reproductible des huit suites ciblées ; sorties temporaires sous `work/core-review-tests`.

## Vérifications exécutées

1. `node scripts/test-core-review.mjs` : **50 tests, 50 réussis, 0 échec**, dernière exécution 4,27 s ; journal `work/task2-targeted-tests.log`. Inclut comparaison avec oracle V1, archives, collections, expéditions, flamme, gardes de feedback, nouvelle découverte et cas limite calendrier.
2. `npm run typecheck` : **code 0**, journal `work/task2-typecheck.log` ; dernier résultat confirmé sur la source finale, garde calendaire compris.
3. `npm run build` : **code 0** sur la source finale, correctif calendaire compris ; journal `work/task2-build.log`. Vérification V1 : `mode=verified-frozen`, 120 cibles, SHA source `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`, 20 039 248 octets compressés ; aucun asset régénéré.
4. `npm test` : première exécution **175/187**, dont 11 échecs Windows préexistants et un échec d’encodage du nouveau contexte. Encodage corrigé, toutes les nouvelles sources vérifiées UTF-8. Deuxième exécution **176/187, 11 échecs**, 186,51 s ; journal `work/task2-full-tests-final.log`. Le garde calendaire ajouté ensuite et son nouveau test sont couverts par les 50 ciblés ci-dessus, TypeScript et construction, sans troisième exécution des pipelines lourds inchangés.
5. `git diff --check` : aucune erreur. `git diff --exit-code -- data public lib/legacy-puzzles.ts lib/semantic.ts lib/semantic-storage.ts lib/release.ts components/flame-scene.tsx` : **code 0**, tous inchangés.

Les 11 échecs de la suite complète restent ceux suivis au lot 7 : quatre tests de preuves éditoriales/batch, trois tests d’éviction de cible, quatre tests de restauration/transfert (chemins/symlinks Windows). Aucun correctif de pipeline tenté. La suite n’est donc pas déclarée entièrement verte.

## Revue des invariants et limites

- Le contrôleur a autorisé la construction après arrêt de son Worker 5178. Aucun serveur supplémentaire, lock de corpus, donnée de staging ni restauration canonique manipulés par ce lot.
- `EXTRA_MODES_ENABLED=false` reste inchangé. Les cartes collections/voyages sont prêtes mais volontairement sous la frontière de publication existante, à qualifier aux lots finaux.
- Gardes de requête courante, identité `puzzleRef`, révision de saisie, timers et focus différé conservés. L’erreur lexicale d’une ancienne saisie ne marque pas une nouvelle saisie éditée entre-temps. Reprise/import ne produisent aucune célébration, aucun son ni diagnostic d’activité.
- Le diagnostic local enregistre des actions acceptées : propositions, première proposition, indice, victoire, refus lexical, panne réseau, reprise volontaire, prochaine activité, aide, ouverture du bilan, copie réussie, sortie explicite et téléchargement du retour lexical. Aucune restauration, mot, score, solution ou référence de puzzle dans ce journal. `gameLeft` ne signifie pas abandon ; activité native partagée non confirmée ne produit pas `shareCopied`.
- La découverte garantit l’absence de répétition **selon l’historique disponible sur cet appareil**. Effacement du navigateur ou historique ancien absent ne peut être reconstitué. Les anciennes références sauvegardées sont résolues côté serveur même si le corps de sauvegarde est illisible ; un inventaire invalide ou dépassant les limites bloque la préférence de nouveauté avec une explication, sans inventer son contenu.
- Les sauvegardes de jeu illisibles ne sont plus écrasées lors d’une nouvelle proposition : partie possible en mémoire, avertissement conservé. Le contexte de parcours reste une métadonnée locale, pas une preuve de réussite.
- Le retour lexical est un téléchargement volontaire, pas une transmission à une équipe ou une correction automatique du dictionnaire. Aucune suggestion orthographique n’est fabriquée.
- Aucun test utilisateur de compréhension, mesure d’audience ni gain de performance n’est revendiqué. La recette visuelle/mobile/clavier réelle et l’activation des modes restent au contrôleur ; les tests SSR ne remplacent pas cette recette.

## Correctifs après revue indépendante — tour 1 (12 octobre 2026)

La revue de `a88feae` relevait I1–I4 et M1. Ce tour corrige les cinq points ainsi que le retour explicite au champ signalé par la recette du contrôleur. Aucun sous-agent, serveur, push, publication ou accès au staging/locks V2 ; construction autorisée après arrêt du Worker 5198 par le contrôleur.

### Réponses et preuves comportementales

- **I1 — conservation des formats futurs.** `lib/game-write-admission.ts` sépare l’admission d’écriture du lecteur V1 permissif, laissé intact. Les déclarations explicites `version`, `schemaVersion` ou `formatVersion` autres que 1 refusent la mutation. Le contrôle est refait au moment d’écrire, y compris si un autre onglet remplace le document après son chargement. `saveGame` conserve la partie en mémoire et avertit, mais n’altère pas les octets incompatibles. Les tests conservent un JSON volontairement indenté avec espaces initiaux/finaux après proposition acceptée et épingle, pour chacun des trois marqueurs futurs, et vérifient la lecture/écriture V1 non versionnée.
- **Risque indirect nommé : projection profil/récompenses.** Inspection de `recordLocalGameProgress` : cette fonction appelle `persistGameActivities` puis `checkpointWeeklyRewards`, donc elle peut écrire les activités/récompenses du profil ; elle ne réécrit pas elle-même le marqueur `profileV2StartIndex` du jeu. Le marqueur est composé par Game avant `saveGame`. Les deux appels de projection (relecture et réponse acceptée) utilisent désormais `recordAdmittedGameProgress` avec la même admission ciblée. Le test d’un document futur contenant déjà le marqueur vérifie qu’aucune clé de profil/événement/récompense supplémentaire n’apparaît. Ni `legacy-storage.ts` ni `profile-storage.ts` ne sont réécrits.
- **I2 — erreurs tardives du tutoriel.** `lib/tutorial-field.ts` centralise la révision de saisie ; erreurs 422, doublons et réseau passent par la même garde que l’effacement après succès. Toute édition retire l’erreur. Le diagnostic conserve le fait réel de la requête sans attribuer son message au nouveau texte. Trois tests asynchrones avec réponse différée contrôlent la nouvelle saisie intacte ; un autre couvre édition puis retour au texte initial (révision toujours nouvelle) et réponse acceptée ancienne.
- **I3 — descripteur complet de réessai.** `lastLoad` garde mode, locator exact, sauvegarde de session, expédition, collection et destination. Le bouton rejoue ce descripteur via `retryPuzzleLoad` ; son clic explicite sur le plateau fixe seulement la destination à Jouer. Test comportemental GET 503 → réessai → collection identique pour le bandeau, URL, contexte local et prochaine seed éditoriale. Deux autres tests préservent l’expédition et la sauvegarde, puis contrôlent le retour explicite au plateau depuis une ancienne destination de chargement en arrière-plan, sans muter le descripteur original.
- **I4 — Voyage, URL et navigation asynchrone.** `lib/game-navigation.ts` distingue la surface Voyage (`surface=voyage`) d’Explorer ; `admittedPuzzleUrl` applique ensemble le puzzle et sa destination, après admission. Une étape ouverte volontairement enlève l’ancienne surface Explorer. Une reprise par lien profond transmet sa surface explicite (Profil, Explorer, Voyage) au chargement. La génération de requête et l’époque de navigation rejettent les anciens GET Voyage avant toute mutation de jeu ou d’URL. Popstate reprend aussi une étape dont le puzzle ne correspond pas encore à la seed du statut. Tests comportementaux étape → Profil → Retour/Avancer → rechargement, trois destinations explicites avec GET différé, et changement de navigation pendant le GET (zéro commit tardif).
- **M1 — filtre du calendrier.** Les résultats filtrés deviennent une liste verticale nommée avec dates complètes et sans colonnes Lun–Dim. Le calendrier non filtré garde ses positions hebdomadaires. Le rendu SSR du même composant `ArchiveDateLayout` utilisé par l’interface vérifie une archive du jeudi 1er octobre 2026, sans en-tête trompeur dans la liste, et les en-têtes présents hors filtre.
- **Retour explicite du tutoriel.** L’intention est consommée par `onCloseAutoFocus`, après fermeture Radix, au lieu d’un focus anticipé écrasé par la restauration du déclencheur. Elle vise le champ actif (ou le plateau si le champ est indisponible), uniquement si génération, navigation et propriété du focus sont encore courantes. L’effet de changement de vue ne concurrence plus ce retour explicite. Escape garde la restauration du déclencheur ; chargement/import n’arment aucune intention. Le test couvre les cinq causes de refus et l’absence d’intention. La validation DOM réelle reste à refaire par le contrôleur après cette construction ; le test de garde ne la remplace pas.

### Fichiers et interfaces du correctif

`components/game.tsx`, `components/game-parts/play-tutorial.tsx`, `components/game-parts/archive-calendar.tsx`, `components/game-parts/game-parts.css` ; nouveaux helpers `lib/game-write-admission.ts`, `lib/game-navigation.ts`, `lib/tutorial-field.ts` ; suite comportementale `tests/game-review-fixes.test.ts` ajoutée à `scripts/test-core-review.mjs` (neuf suites ciblées). `PuzzleLoad` et `GameSurface` sont les descripteurs de navigation réutilisables par les lots suivants ; le lecteur historique reste la référence pour lire V1, le nouveau module sert uniquement aux mutations et à leur projection indirecte.

### Commandes finales et résultats exacts

Exécutées séquentiellement sur les sources finales, avec arrêt immédiat au premier code non nul :

```powershell
node scripts/test-core-review.mjs *> work/task2-fix-targeted-tests.log
npm run typecheck *> work/task2-fix-typecheck.log
npm run build *> work/task2-fix-build.log
```

- Tests : **64 tests, 64 pass, 0 fail, 0 skipped**, durée `4210.4154 ms`, code **0**. Quatorze nouveaux cas de régression (dont les trois erreurs différées) s’ajoutent aux 50 précédents. Les nouveaux cas testent transitions, stockage, promesses différées et rendu ; aucune assertion de recherche dans les sources.
- TypeScript : **code 0**, aucune erreur.
- Construction : **code 0**, `Build complete`. Vérification figée : `mode=verified-frozen`, `targetCount=120`, SHA source `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`, `compressedTargetBytes=20039248`. Aucune régénération d’assets.
- `git diff --check` : code **0** (seuls avertissements de conversion LF/CRLF par Git, aucune erreur de contenu).
- Aucun nouveau passage de `npm test` : les **11 échecs Windows préexistants**, documentés ci-dessus et suivis au lot 7, restent explicitement non résolus dans ce tour.

Auto-revue : points I1–I4/M1 relus contre la revue ; lecteur historique, moteur, calendrier canonique, seeds, flamme et frontière `EXTRA_MODES_ENABLED=false` conservés. Les tests isolent les mécanismes effectivement utilisés par Game ; ils ne prétendent pas reproduire le cycle DOM complet de React/Radix, les boutons du navigateur ou le clavier mobile. Nouvelle revue indépendante et recette navigateur ciblée attendues avant approbation du lot 2.

## Correctifs après re-revue — tour 2 (12 octobre 2026)

Base `14c9898`. Rapport traité : `task-2-fix-review.md`, uniquement **F1 et F2**. Les corrections I1/I2/I3/M1 et la fermeture du tutoriel restent inchangées ; le contrôleur a confirmé le focus sur `INPUT#guess` après animation complète de la fermeture. Aucun nouveau traitement V2, sous-agent, serveur, push ou déploiement. Construction autorisée après arrêt du Worker 5198 par le contrôleur.

### F1 — admission identique pour tous les chargements

Le prédicat configurable avec exception `!expedition` a été supprimé. `admitPuzzleLoad` reçoit maintenant `PuzzleLoadGuard` : génération de requête et époque de navigation capturées, plus lecture des compteurs courants. **Le helper impose lui-même l’égalité des deux compteurs**, sans distinction quotidien/archive/libre/collection/Voyage, destination explicite ou non. Le vrai appel de `loadPuzzle` lui passe les compteurs `requestRef` et `navigationEpoch`. Le succès et l’échec utilisent exactement cette admission avant leurs callbacks de transition.

Les anciens tests ont été raccordés à cette nouvelle interface, qui ne permet plus de fournir artificiellement un prédicat plus fort que celui de production. Deux nouvelles transitions utilisent `retryPuzzleLoad` comme le bouton, un descripteur quotidien puis collection, `destination=game`, les compteurs de génération, un GET différé, et une navigation vers Profil avant sa résolution. Résultat : admission obsolète, zéro commit de succès, surface et URL Profil inchangées. La sauvegarde et le descripteur complet restent transportés.

### F2 — panne d’étape visible et contextualisée

Un échec admis passe par le callback d’échec de `admitPuzzleLoad`. `loadPuzzle` conserve son message et applique la destination demandée ainsi que `failedPuzzleUrl` : depuis Voyage, le plateau Jouer affiche donc le composant d’erreur et son bouton Réessayer déjà présents, avec URL contenant le Voyage et la seed exacts. Aucune identité de puzzle ni date n’est inventée : la route d’échec se fonde uniquement sur le locator demandé. `lastLoad` conserve expédition, sauvegarde et destination pour le réessai. Le helper distingue désormais résultat accepté, échec admis (`false`) et réponse obsolète (`null`) ; l’erreur réelle n’est pas remplacée par le texte générique d’interruption.

La transition testée traverse réellement `resumeExpedition` (statut réussi, sauvegarde non terminée), puis le chargement d’étape renvoie 503 : message présent, surface Jouer correspondant au rendu de l’erreur, URL Voyage/seed intacte. Le réessai réutilise statut et sauvegarde, sans nouveau POST de statut, puis admet le puzzle. Deux tests supplémentaires différencient réponse 503 et rejet réseau après navigation vers Profil : aucun callback de succès/échec admis, aucune route d’erreur tardive, Profil conservé.

Les cinq nouveaux tests exercent les compteurs, promesses différées, transport des descripteurs et callbacks de transition des helpers effectivement appelés par Game ; ils ne font pas de recherches dans les sources. Ils ne montent pas le cycle DOM complet de Game : la présence visuelle dans le navigateur reste une recette distincte, sans assimiler ces tests à une mesure d’accessibilité ou de performance.

### Commandes finales, fichiers et résultat

```powershell
node scripts/test-core-review.mjs *> work/task2-fix2-targeted-tests.log
npm run typecheck *> work/task2-fix2-typecheck.log
npm run build *> work/task2-fix2-build.log
git diff --check
```

- Tests ciblés : **69 tests, 69 pass, 0 fail, 0 skipped**, `5136.5984 ms`, code **0**.
- TypeScript : **code 0**, aucune erreur.
- Construction finale : **code 0**, `Build complete`, V1 `verified-frozen` (120 cibles, SHA source inchangé `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`), aucun asset régénéré.
- Diff-check : **code 0**, seuls avertissements Git LF/CRLF. Vérification d’absence de diff pour `data`, `public`, moteur/oracle/stockage sémantique, release, flamme, lecteur V1, profil, tutoriel, calendrier et gardes d’écriture : **code 0**.
- Fichiers de production modifiés : `components/game.tsx`, `lib/game-navigation.ts`. Tests : `tests/game-review-fixes.test.ts`. Ce rapport est le quatrième fichier du commit.
- Pas de répétition de la suite lourde inchangée ; les 11 échecs Windows du lot 7 demeurent la réserve historique déjà documentée.

Auto-revue : branches HTTP et exception réseau, générations remplacées, navigation Profil, réessai après échec, contexte éditorial et destination explicite contrôlés. `EXTRA_MODES_ENABLED=false` reste inchangé. Le tour attend la re-revue indépendante ciblée F1/F2 ; aucun autre sujet précédemment acquitté n’a été rouvert.
