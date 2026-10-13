# Lot 1 — fondations, navigation et livraison reproductible

Statut : implémentation du socle terminée, contrôles ciblés et construction réussis. Les raccordements au plateau/pages avancées et la recette navigateur restent aux lots suivants. Aucun push, publication, activation des modes avancés ni modification des données V1 canoniques. Base du lot : `7b0148b`, branche `codex/full-review-implementation`.

## Réalisations par ID

| ID | Résultat concret | Preuves / suite |
| --- | --- | --- |
| D01 | Matrice source canonique/public32/implémentation, redirections intentionnelles, bindings actuels, domaine réel | `docs/FULL-REVIEW-FOUNDATIONS.md` ; comparaison source publique donnée par le contrôleur |
| D02 | Dev/start/build/typecheck/lint/db/check portables Node ; Linux garde l’installateur officiel ; Windows installation verrouillée et bornée ; build V1 vérifie sans réécriture | `package.json`, `scripts/run-site.mjs`, `scripts/build-verified.mjs`, `scripts/build-semantic-shards.mjs --verify` ; construction finale exit0 ; qualification complète serveur dans les lots suivants |
| D10 | Shell partagé Jouer / Explorer / Profil, liens directs et état actif accessible, nom de mode et retour interne validé, callback pour conserver la saisie | `components/app-navigation.tsx`, `app/shared-shell.css` ; intégré au démonstrateur, à monter dans Game et les autres pages par leurs propriétaires |
| D24 | Variante compacte conservant la flamme, métadonnées dérivées du domaine réel, aperçu avec repli ; CSP et messagerie limités aux deux origines BRAIZ contrôlées, source de fenêtre vérifiée | `app/embed/page.tsx`, composants embed, `lib/embed-contract.ts`, `lib/distribution.ts`, `worker/index.ts` ; allow/deny/source tests verts ; recette cross-origin réelle en lot8 |
| D25 | `skip` retourne `null`, sans empreinte publicitaire ; script réel de vérification du domaine conservé, confidentialité documentée précisément | `components/ad-placement.tsx`, `app/layout.tsx`, test `advertising` |
| D26 | Navigation nommée, état actif écrit/indiqué par `aria-current`, retour explicite, focus visible, cibles44px, aucune altération des animations de flamme | CSS commun + test SSR ; zoom/lecteur d’écran/contraste complet et états avancés à qualifier en lot8 |
| D27 | Journal de support versionné local et borné, schéma fermé sans mots/solutions/scores/pseudonyme/ID, export et effacement volontaires, schémas incompatibles préservés | `lib/product-events.ts`, `components/product-diagnostics.tsx` ; limites et définitions écrites ; raccordement des actions réelles dans Game par lot2 |
| D28 | Nombre/score français, virgule, dates Paris et inconnues explicites, verbes communs approuvés | `lib/format-fr.ts`, tests ; adoption dans les consommateurs des lots suivants |

## Périmètre adjacent approuvé

1. `components/embed-demo.tsx`, `components/embed-bridge.tsx`, `lib/embed-contract.ts`, `app/shared-shell.css` et `README.md` pour raccorder l’aperçu, le shell, les contrats et documenter les limites. `app/globals.css` n’ajoute que des tokens partagés et l’import CSS.
2. Ruling contrôleur : deux index SQLite jetables de corpus donnaient un fsync/commit par mot. Transactions bornées à4096 insertions dans le constructeur et le vérificateur indépendant ; `synchronous=FULL` conservé, rollback du reliquat, reprise reconstruite depuis segments/checkpoints vérifiés. Verrou de génération inchangé. Suppression du journal du seul index jetable sous le guard exclusif lors de reconstruction, jamais du verrou de génération.
3. Ruling D02/V1 : le build historique régénérait des gzips Windows avec octet OS10, différent des objets Linux figés OS3. Les122 fichiers V1 produits par mon premier build ont été restaurés exactement depuis HEAD, avec accord du contrôleur qui a confirmé l’absence d’autre propriétaire. Mode `--verify` non mutatif : index SHA256 figé, copies publiques exactes, source, objets compressés et payloads exhaustivement recalculés. La construction de production l’utilise désormais. Le mode de génération explicite reste disponible.
4. Ruling D02/V2 : helper `scripts/canonical-gzip.mjs`, réutilisé avant SHA/install par les constructeurs corpus/index/target V2 et la génération V1 explicite. Header OS3 ; données numériques, deflate, configs et pins inchangés. Golden test sur un vrai objet V1 + trois vérificateurs V2 indépendants. Le staging non canonique commencé par le contrôleur, son verrou et ses sorties sont restés intacts ; le contrôleur a lui-même arrêté son processus et reprend dans un nouveau staging.
5. Ruling D24 : le contrôleur a vérifié par déploiement le second host du même Site, `https://braise-mots.yellow-drake-7186.chatgpt.site`. Allowlist exacte avec `https://braiz.io`, pas de localhost ou wildcard ajouté. `worker/index.ts` possède l’application de CSP sur `/embed` et `/embed/` seulement. XFO supprimé seulement sur cette réponse, au profit de CSP exact, pour autoriser le second host. L’iframe de démonstration charge toujours `https://braiz.io/embed`.

## Interfaces pour les lots suivants

- `AppNavigation({active?: "play"|"explore"|"profile", modeName?, backHref?, onNavigate?})`. Les liens canoniques sont `/`, `/?surface=explore`, `/?surface=profile`. Le callback n’intercepte que les clics ordinaires ; les clics modifiés restent natifs. Aucun changement de Game dans ce lot. Le retour refuse origine externe, `//`, antislash, espace/caractère de contrôle.
- `formatScoreFr(number|null|undefined)` reçoit le score visible -100..100, sans conversion ; ajoutez le degré dans l’UI. `formatNumberFr` pour rangs/nombres, en gardant explicitement le dénominateur ; `formatDateFr(value, includeTime?)` en Europe/Paris, sans inventer une date. `ACTION_LABELS` expose Proposer/Reprendre/Réessayer/Revenir au jeu/Publier cette version/Étape suivante/Actualiser.
- `recordProductEvent(storage, type, context, now?)` uniquement après une action réelle acceptée. Types et contextes sont énumérés dans `PRODUCT_EVENT_TYPES` / `PRODUCT_EVENT_CONTEXTS`. Les seules colonnes persistées sont `type`, `context`, `occurredAt`. `firstGuessAccepted` exige une partie auparavant vide, `gameLeft` une sortie volontaire (ne prouve pas l’abandon), `shareCopied` une copie réussie, `refusedWordReported` un signalement explicite sans son mot. Jamais d’événements depuis restauration, relecture ou faits importés. Import/export peuvent observer l’action volontaire elle-même.
- `ProductDiagnostics` : monter dans le profil/support. Téléchargement JSON explicite, effacement volontaire ; pas d’envoi réseau ni de compte/ID. Cap100, lecture32Kio, écritures refusées si schéma futur/corrompu/sensible. Journal local non exhaustif en multi-onglets ; ce n’est pas un compteur d’audience ni un journal de progression.
- `EMBED_ALLOWED_ORIGINS`, `validEmbedOrigin`, `validEmbedMessage`, `validEmbedEvent(event, expectedWindow, "hello"|"resize")`, `distributionHeaders`. Schéma exact, version historique compatible, hauteur240..10000 entière. Aucun texte de jeu ne traverse les messages. La passerelle répond à l’origine contrôlée exacte du parent validé.
- `DISTRIBUTION` utilise `PUBLIC_ORIGIN`. `EXTRA_MODES_ENABLED` reste false ; les layouts de diffusion ne sont pas ouverts.
- `npm run test:foundations` est le runner réutilisable du lot : compilation et exécution de foundations/advertising/embed/corpus/shards/canonical-gzip/two-braises. Le test général existant reste inchangé.

## Vérification et commandes exactes

Répertoire de toutes les commandes : source `work/braiz-source`. Les logs sont des intermédiaires ignorés sous `work/`, sans secrets.

| Commande | Résultat | Trace |
| --- | --- | --- |
| `node scripts/test-foundations.mjs` | 37 tests verts, exit0 | `work/task1-focused-verified.log` |
| `node scripts/run-site.mjs typecheck` | exit0 après les dernières modifications | `work/task1-typecheck-final.log` |
| `node scripts/build-verified.mjs` | exit0, phase `verified-frozen`,120 objets V1 ; build Vinext complet | `work/task1-build-final.log` |
| `node node_modules/eslint/bin/eslint.js components/app-navigation.tsx components/product-diagnostics.tsx components/embed-demo.tsx components/embed-bridge.tsx lib/format-fr.ts lib/product-events.ts lib/distribution.ts lib/embed-contract.ts scripts/run-site.mjs scripts/build-verified.mjs scripts/canonical-gzip.mjs` | exit0 | `work/task1-lint-final.log` |
| `git diff --check` | exit0 | Contrôle final |
| `git diff --name-only -- data/semantic-v1-index.json public/semantic/fr-fasttext-30000-v1` | sortie vide, exit0 | Aucune mutation de V1 |
| `node scripts/test-game.mjs` | exit1,159/172 verts,13 échecs | `work/task1-full-tests.log` ; détails ci-dessous |

Les tests ciblés prouvent propagation exit23, erreur de lancement69, expiration124, durée invalide refusée ; cap et schéma du journal ; inconnues/virgule/dates civiles ; liens/état/retour sûr ; deux origines exactes et mauvaise fenêtre refusée ; absence de zone publicitaire ; EOF de50001 lignes contre oracle scalaire indépendant ; déduplication après4096 écritures et reprise donnant un manifeste/segments identiques ; corruption et locks ; vérification V1 non mutative et refus d’index/objet altéré ; compression canonique de corpus/index/cible avec contrôle indépendant ; scores Deux braises réels.

Le test EOF a pris3,19s sur la première mesure ciblée, contre une exécution initiale arrêtée par le contrôleur après plus de7min. Ce constat qualifie ce test sur cet environnement, pas le corpus complet ni la mémoire du Worker. L’avertissement expérimental SQLite est celui du runtime existant. Vinext affiche la limite existante de classification statique des routes, sans échec de build.

## Échecs de la suite générale et résolution partielle

Une seule suite générale a été lancée après le correctif de transactions. Elle a terminé en206,12s, avec13 échecs :

- Éditorial batch (test24), deux preuves durables/expansion (31,32), éviction explicite/reprise (120,123) : `Target cache root cannot contain symbolic links` sur les chemins Windows8.3 de Temp. Zones inchangées par ce lot, à diagnostiquer/corriger par lot7/8 sans affaiblir le refus des vrais liens.
- Éditorial path (33), restore source (130), partial symlink (133), partial-path swap (137) : création de symlink de fichier/dossier refusée par Windows (`EPERM`). Tester la sécurité via un mécanisme Windows autorisé, sans prétendre que les tests passent ou désactiver le contrôle produit.
- Éviction sous guard lecteur (121) : nettoyage `EBUSY` de `.cache-guard.sqlite`, après l’échec de parcours sous Windows. À traiter avec la qualification des locks/chemins.
- Restore-plan (129) : fixture POSIX `/tmp/...` attend un chemin sans lecteur, `resolve` Windows renvoie `C:\tmp\...` ; fixture portable à corriger en lot7/8.
- Deux braises (151,152) : mon premier build s’était superposé à la fin des tests et avait régénéré les assets gzip alors que les tests gardaient l’ancien index compilé. Erreur de coordination reconnue et corrigée : seuls les assets produits ont été restaurés, build devenu read-only, puis Deux braises et les invariants V1 ont été rejoués avec succès dans le runner ciblé. Ne pas lancer une régénération mutable d’assets pendant des tests ou un serveur.

Le contrôleur a accepté la prise en charge des11 autres échecs Windows dans les lots de qualification ; aucune deuxième suite complète n’a été lancée ici. Avant publication, la suite complète finale doit être verte ou ses limites précisément décidées/documentées, avec recette réelle des parcours.

## Auto-revue et limites

Contrats V1, oracle, corpus, seeds, objets canoniques, licence et flamme inchangés. Aucun import sémantique serveur dans les nouveaux composants clients. Le journal n’accepte aucune donnée libre et ne transmet rien ; les valeurs inconnues restent explicitement inconnues. Navigation et nouveaux boutons sont français. La publicité inactive est absente, mais le script réel AdSense de vérification du domaine reste une requête tierce : la documentation ne prétend pas que le Site n’effectue aucune requête externe.

Pas de preuve d’audience, de rétention, d’abandon définitif, de compréhension ou de statistiques compétitives. Le diagnostic ne devient utile qu’après raccordement de vrais événements. Le code d’intégration autorise les deux hosts contrôlés ; sa qualification navigateur cross-origin et son activation restent en lot8. L’installation complète Windows/Linux n’a pas été rejouée : les dépendances verrouillées présentes ont été utilisées ; Linux conserve le chemin officiel Sites et sera qualifié dans la livraison finale. Le nouveau staging V2/pins complets et le transfert R2 sont pilotés par le contrôleur/lot7, pas déclarés qualifiés par ces fixtures.

Livrable détaillé : `docs/FULL-REVIEW-FOUNDATIONS.md`. Commit d’implémentation : `42d383a` (`feat: add BRAIZ shared foundations and preserve portable semantic artifacts`),32 fichiers,638 insertions/49 suppressions, exit0. Ce rapport reste dans le dossier SDD ignoré conformément à son `.gitignore` ; la documentation de livraison est commitée. Aucun push/publication.
