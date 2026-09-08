# Architecture

## Séparation

- `components/game.tsx` : interface et orchestration des parties locales.
- `components/ad-placement.tsx` : réservation publicitaire statique, séparée du jeu.
- `lib/game-feedback.ts` : événements visuels transitoires, identifiés et jamais persistés.
- `lib/advertising.ts` : décision publicitaire pure, actuellement non configurée et toujours ignorée.
- `lib/legacy-storage.ts` : lecture, validation et écriture compatibles avec les clés `braise.v1.*`.
- `lib/profile-storage.ts` : profil personnel V2, migration V1 non destructive, secours brut et journal d’événements append-only.
- `lib/game-contracts.ts` : références publiques versionnées, résultat sémantique et contrats des extensions.
- `lib/game-types.ts` : contrat partagé et calcul de série.
- `lib/calendar.ts` : date et prochain minuit à Paris, sans données sémantiques.
- `lib/legacy-puzzles.ts` et `data/legacy-v1.json` : sélection historique immuable, uniquement côté serveur.
- `data/semantic-v1-index.json` : dictionnaire, contenu éditorial et manifeste des segments, sans matrice de scores.
- `lib/semantic-storage.ts` : lecture asynchrone, validation et cache LRU borné des segments, uniquement côté serveur.
- `lib/semantic.ts` : normalisation et évaluation sur les segments, uniquement côté serveur.
- `app/api/game/route.ts` : découverte du puzzle, validation et évaluation.
- `data/semantic-fr.json` : artefact de calcul reproductible, licence conservée.

GET `/api/game?mode=daily` renvoie une identité publique sans réponse. Les modes `free` et `challenge` exigent une seed numérique. POST évalue un mot ou donne une piste. Une identité quotidienne expirée donne un statut 409. Le client renouvelle le quotidien à minuit à Paris.

Une proposition inconnue donne 422, jamais un score de hasard. Les doubles propositions normalisées ne sont pas ajoutées aux essais. Les indices doivent être distincts des mots déjà proposés et du mot cible. Toute victoire est comptée une seule fois par identité locale de puzzle.

Le GET ajoute `ref` aux champs V1 existants : version de contrat, corpus, règles, contexte, variante et calendrier. Le POST accepte `puzzleRef`, contrôle sa concordance et la renvoie avec le score ou l'indice. Une référence fournie mais incompatible donne 409 avant évaluation. Un POST sans référence reste explicitement V1 pour les onglets ouverts avant cette évolution. L'ordre d'essai est attribué localement ; la réponse sémantique ne prétend pas disposer d'un compteur serveur vérifié.

Les 120 identités de cibles V1, leur ordre, l'époque et les coefficients du calendrier sont figés dans le manifeste. La sélection est résolue par mot vers les données, jamais par la longueur d'un catalogue extensible. Les seeds gardent leurs caractères exacts, y compris les zéros initiaux. Libre et défi conservent leur identité commune `free-${seed}`. Leur contexte de requête reste distinct.

Le préfixe `braise.v1.*` désigne toujours le format, le corpus et les règles historiques. Le lecteur partagé conserve les validations V1, les essais et leurs scores sans recalcul, ainsi que les épingles, indices, dates et profils. Il ne crée aucun événement ni récompense à la restauration.

Le profil V2 est un état personnel local, jamais une preuve compétitive. Avant de migrer un profil V1 valide ou partiellement valide, `lib/profile-storage.ts` copie sa chaîne exacte sous une clé immuable `braise.v2.backup.braise.v1.profile.*`, relit cette copie, puis seulement écrit la base V2 sous une clé liée à la même empreinte. La source `braise.v1.profile` reste intacte. Deux initialisations portant sur des sources différentes écrivent des candidats distincts au lieu de s’écraser. Une version future, une base corrompue ou deux sources V1 différentes sont conservées sans réinitialisation ni fusion additive.

La base V2 contient une fois le solde historique et les victoires V1 dédupliquées. Les nouvelles propositions et victoires d’une réponse acceptée sont écrites ensemble dans un lot immuable `braise.v2.profile.batch.*` ; les préférences et reprises utilisent des événements `braise.v2.profile.event.*`. Leur identité métier est stable et les relectures sont idempotentes. Des écritures concurrentes n’effectuent pas de read-modify-write sur un même compteur : les onglets ajoutent des faits distincts, puis reconstruisent la même vue par union. Une victoire conserve l’identité V1 commune de `free-${seed}` pour ne pas doubler libre et défi. Les valeurs historiques inconnues, notamment la date réelle de réalisation, ne sont pas inventées. Les nouveaux essais capturent leur date d’acceptation ; une victoire réconciliée conserve son `solvedAt`.

Une partie modifiée après la migration porte `profileV2StartIndex`. Cet index de tableau, indépendant des anciens numéros d’essai, exclut les essais déjà compris dans le solde V1 et permet de rejouer sans doublon les opérations V2 connues. La synchronisation de la progression écoute les changements de stockage, les effacements et les écritures V1 tardives, puis relit au retour de visibilité. Les activités temporairement gardées en mémoire sont conservées entre les commandes et retentées. Cette synchronisation ne déclenche jamais d’effet visuel, de son, de toast ou de focus. Les contrats de contenu, progression et publicité préparent les extensions ; leurs types ne signifient pas que ces fonctions sont déjà implémentées.

Le coût sémantique ne dépend pas d'un fournisseur d'IA payant : les scores sont déjà calculés. Le format BRZ1 contient, par cible, scores, rangs de compétition et ordre stable. Chaque segment compressé et décompressé est contrôlé par taille, en-tête et SHA-256 avant admission. Le cache LRU conserve au plus 4 Mio de tableaux décodés, quatre lectures actives et huit chargements uniques au total. Les requêtes simultanées du même objet partagent une promesse.

Tant que `.openai/hosting.json` conserve `r2: null`, le lecteur emploie explicitement les mêmes segments immuables comme assets du Site. Si un binding R2 est configuré, il devient la source exclusive : binding absent, objet manquant, lecture échouée ou corruption produisent une indisponibilité 503, jamais un score de remplacement ni un repli silencieux vers les assets. La configuration et la qualification d'un R2 réel restent nécessaires pour terminer B1.

L'export public V1 est servi comme flux d'asset par `/semantic-data.json`, sans parser la matrice dans le Worker. Il reste identique à l'empreinte V1 pour respecter la transparence et la licence existantes. Les futures versions compétitives ne reprendront pas automatiquement cette exposition.

Une limitation par IP et fenêtre d'une minute protège contre les rafales simples ; elle est locale à l'isolate et ne remplace pas un dispositif global pour un gros lancement.

## UX

La requête de chargement la plus récente est la seule autorisée à remplacer la partie. Une réponse devenue obsolète ne modifie pas une autre partie. Les modifications d'épingles et de son sont désactivées pendant un POST pour éviter de perdre un changement. Une révision de saisie est capturée au départ : toute édition, même si elle revient au même texte, est préservée à la réponse.

Les effets `guessAccepted`, `bestImproved` et `puzzleWon` naissent uniquement après une réponse valide de la partie courante. Leur identifiant lie partie, numéro d'essai et type. Ils sont consommés par leur propre minuterie, annulés au changement de partie et absents des sauvegardes. Une victoire restaurée conserve son résultat, sans confettis, son, toast ni focus forcé. Les lignes restaurées ne rejouent pas leur animation d'entrée.

Le champ reste modifiable pendant l'analyse. Les rappels de focus sont annulés avec la partie et n'agissent pas lorsqu'une fenêtre est ouverte ou que la personne a déplacé son focus. Le plateau fournit une cible permanente au lien d'évitement. Les succès non victorieux ont une annonce textuelle ; la victoire soumise donne le focus à son titre.

Le son est désactivé par défaut. `prefers-reduced-motion` réduit les animations. Aucune dépendance externe de police, vidéo ou image n'est nécessaire au premier écran.

La fenêtre de progression indique le format local et la présence effective de la copie de secours. Les erreurs de stockage, données illisibles, formats futurs et conflits V1 restent visibles sans bloquer le jeu. Une migration réussie ne produit ni récompense ni célébration. Les onglets actualisent silencieusement les compteurs et le son, sans toucher à la saisie ou à la fenêtre ouverte.

## Publicité

`AdDecision` reste le seul contrat partagé. En l'absence de fournisseur, politique de consentement et fréquence réels, `decideAd` renvoie toujours `skip/not-configured`, avec disponibilité et fréquence fausses et consentement inconnu. Le composant réservé exécute cette décision mais ne charge aucun script, cadre, pixel, lien ni contrôle. Il n'accède pas aux mots, scores, parties ou sauvegardes. L'activation commerciale et sa mesure restent un lot séparé.

## Limites de cette version

Le profil local reste modifiable par l'utilisateur et sa progression n’est partagée qu’entre les onglets du même navigateur. La suppression des données du navigateur efface aussi le journal V2 et sa copie de secours. Les parties elles-mêmes restent dans leurs clés V1 et ne sont pas encore une autorité transactionnelle multi-onglets. Ne pas en faire un classement officiel. Le dictionnaire Wikipédia comprend parfois des noms propres ou emprunts. La matrice de 120 cibles est un corpus initial à élargir pour une exploitation pérenne.

La marque, le domaine commercial, l'audience publique, la régie et le consentement publicitaire n'ont pas été provisionnés. Les contrats d'API actuels n'ont pas besoin de D1, R2 ou d'identité utilisateur.

## Référence reproductible B0

`tests/fixtures/v1-reference.json` provient exclusivement du code et des données du commit de référence V1, pas du nouveau lecteur. `node scripts/capture-v1-fixtures.mjs` le reconstruit depuis Git, avec vérification SHA-256 du corpus. Les sauvegardes de `v1-saves.json` sont explicitement synthétiques ; leurs scores sont calculés par ce même moteur de référence. Ne pas remplacer l'oracle par des valeurs issues du code à tester.

`node scripts/measure-v1.mjs` compare deux processus Node séparés après préparation de l'oracle. Le rapport historique B0 reste dans `docs/program/B0-MEASUREMENTS.json` ; les mesures du lecteur segmenté sont écrites dans `docs/program/B1A-MEASUREMENTS.json`. Elles ne qualifient pas la mémoire de Cloudflare Workers.
