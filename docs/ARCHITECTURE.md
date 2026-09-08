# Architecture

## Séparation

- `components/game.tsx` : interface et orchestration des parties locales.
- `components/ad-placement.tsx` : réservation publicitaire statique, séparée du jeu.
- `components/weekly-ritual.tsx` : affichage des trois objectifs et choix des styles accessibles.
- `components/profile-transfer.tsx` : export du profil et parcours d’import prévisualisé puis confirmé.
- `lib/game-feedback.ts` : événements visuels transitoires, identifiés et jamais persistés.
- `lib/advertising.ts` : décision publicitaire pure, actuellement non configurée et toujours ignorée.
- `lib/legacy-storage.ts` : lecture, validation et écriture compatibles avec les clés `braise.v1.*`.
- `lib/profile-storage.ts` : profil personnel V2, migration V1 non destructive, secours brut et journal d’événements append-only.
- `lib/weekly-ritual.ts` : édition hebdomadaire immuable, calendrier du lundi, projection des faits et récompenses cosmétiques.
- `lib/game-contracts.ts` : références publiques versionnées, résultat sémantique et contrats des extensions.
- `lib/game-types.ts` : contrat partagé et calcul de série.
- `lib/calendar.ts` : date et prochain minuit à Paris, sans données sémantiques.
- `lib/legacy-puzzles.ts` et `data/legacy-v1.json` : sélection historique immuable, uniquement côté serveur.
- `data/semantic-v1-index.json` : dictionnaire, contenu éditorial et manifeste des segments, sans matrice de scores.
- `lib/semantic-storage.ts` : lecture asynchrone, validation et cache LRU borné des segments, uniquement côté serveur.
- `lib/semantic.ts` : normalisation et évaluation sur les segments, uniquement côté serveur.
- `app/api/game/route.ts` : découverte du puzzle, validation et évaluation.
- `data/semantic-fr.json` : artefact de calcul reproductible, licence conservée.

GET `/api/game?mode=daily` renvoie une identité publique sans réponse. Les modes `free` et `challenge` exigent une seed numérique. GET `/api/game?mode=archive&date=YYYY-MM-DD` ouvre une date civile strictement passée depuis le 7 septembre 2026. La même date est requise au POST et la référence versionnée y est obligatoire. La date, sa borne de lancement et la borne supérieure calculée selon Paris sont contrôlées avant toute lecture sémantique. POST évalue un mot ou donne une piste. Une identité quotidienne expirée donne un statut 409 et ne devient jamais implicitement une archive. Le client renouvelle uniquement le quotidien à minuit à Paris.

Une proposition inconnue donne 422, jamais un score de hasard. Les doubles propositions normalisées ne sont pas ajoutées aux essais. Les indices doivent être distincts des mots déjà proposés et du mot cible. Toute victoire est comptée une seule fois par identité locale de puzzle.

Le GET ajoute `ref` aux champs V1 existants : version de contrat, corpus, règles, contexte, variante et calendrier. Le POST accepte `puzzleRef`, contrôle sa concordance et la renvoie avec le score ou l'indice. Une référence fournie mais incompatible donne 409 avant évaluation. Un POST sans référence reste explicitement V1 pour les onglets ouverts avant cette évolution. L'ordre d'essai est attribué localement ; la réponse sémantique ne prétend pas disposer d'un compteur serveur vérifié.

Les 120 identités de cibles V1, leur ordre, l'époque et les coefficients du calendrier sont figés dans le manifeste. La sélection est résolue par mot vers les données, jamais par la longueur d'un catalogue extensible. Les seeds gardent leurs caractères exacts, y compris les zéros initiaux. Libre et défi conservent leur identité commune `free-${seed}`. Leur contexte de requête reste distinct.

Une archive réutilise exactement l’identité `daily-YYYY-MM-DD`, la seed de date, le numéro d’édition et la cible V1 du quotidien correspondant, mais sa référence porte le contexte explicite `archive`. La clé de partie est donc commune et reprend essais, indices et épingles existants. Les dates civiles sont décalées comme dates UTC stables, jamais en soustrayant 24 heures à un instant, afin de respecter les journées parisiennes de 23 et 25 heures.

Le préfixe `braise.v1.*` désigne toujours le format, le corpus et les règles historiques. Le lecteur partagé conserve les validations V1, les essais et leurs scores sans recalcul, ainsi que les épingles, indices, dates et profils. Il ne crée aucun événement ni récompense à la restauration.

Le profil V2 est un état personnel local, jamais une preuve compétitive. Avant de migrer un profil V1 valide ou partiellement valide, `lib/profile-storage.ts` copie sa chaîne exacte sous une clé immuable `braise.v2.backup.braise.v1.profile.*`, relit cette copie, puis seulement écrit la base V2 sous une clé liée à la même empreinte. La source `braise.v1.profile` reste intacte. Deux initialisations portant sur des sources différentes écrivent des candidats distincts au lieu de s’écraser. Une version future, une base corrompue ou deux sources V1 différentes sont conservées sans réinitialisation ni fusion additive.

La base V2 contient une fois le solde historique et les victoires V1 dédupliquées. Les nouvelles propositions et victoires d’une réponse acceptée sont écrites ensemble dans un lot immuable `braise.v2.profile.batch.*` ; les préférences et reprises utilisent des événements `braise.v2.profile.event.*`. Leur identité métier est stable et les relectures sont idempotentes. Des écritures concurrentes n’effectuent pas de read-modify-write sur un même compteur : les onglets ajoutent des faits distincts, puis reconstruisent la même vue par union. Une victoire conserve l’identité V1 commune de `free-${seed}` pour ne pas doubler libre et défi. Quotidien et archive partagent aussi l’identité de contenu : un acquis quotidien existant a priorité et un rejeu ne crée pas une seconde victoire. Les nouvelles victoires distinguent `date`, la date du mot, de `completedAt`, l’instant réel de réalisation. Les valeurs historiques inconnues ne sont pas inventées. Les nouveaux essais capturent leur date d’acceptation ; une victoire réconciliée conserve son `solvedAt` et, lorsqu’un ancien jeu ne porte pas encore son contexte, celui-ci est déduit uniquement de cet instant réel.

Une partie modifiée après la migration porte `profileV2StartIndex`. Cet index de tableau, indépendant des anciens numéros d’essai, exclut les essais déjà compris dans le solde V1 et permet de rejouer sans doublon les opérations V2 connues. La synchronisation de la progression écoute les changements de stockage, les effacements et les écritures V1 tardives, puis relit au retour de visibilité. Les activités temporairement gardées en mémoire sont conservées entre les commandes et retentées. Cette synchronisation ne déclenche jamais d’effet visuel, de son, de toast ou de focus. Les contrats de contenu, progression et publicité préparent les extensions ; leurs types ne signifient pas que ces fonctions sont déjà implémentées.

L’édition `weekly-ritual-v1` contient exactement trois objectifs : propositions acceptées hors indices, jours civils actifs et victoires sans indice. Une semaine est identifiée par son lundi civil à Paris et se termine le dimanche, sans calcul en blocs de 168 heures. Les compteurs utilisent `occurredAt` pour les propositions et `completedAt` sur la victoire effective dédupliquée. Le solde V1, dépourvu de date réelle, ne reçoit aucun progrès hebdomadaire inventé ; le rejeu d’une archive déjà gagnée ne compte pas comme une nouvelle victoire.

Les récompenses sont des identités déterministes `version de règles + lundi + objectif`, projetées depuis les faits canoniques. Dès qu’une identité est prouvée, un événement `weeklyRewardEarned` la matérialise sans crédit additionnel, bouton, annonce ou dépendance publicitaire. Cette preuve append-only empêche une réconciliation ultérieure de retirer un acquis. Leur union sur toutes les semaines débloque durablement trois cosmétiques, même lorsque les compteurs de la semaine courante repartent à zéro. Seule la préférence d’apparence produit un événement `cosmeticChanged`, résolu par date et identité comme le son. Une valeur inconnue ou un style non acquis reste sans effet. Les thèmes modifient l’ambiance de marque et l’emblème, jamais les températures, rangs, indices, erreurs ou victoires.

Le transfert de profil emploie une enveloppe JSON lisible `braise-personal-profile` version 1. Elle contient la base historique exacte, son éventuelle source V1 brute et l’union canonique des faits de profil, y compris ceux temporairement gardés en mémoire. Elle exclut explicitement les parties en cours et les épingles. Un profil qui contient un enregistrement ignoré, un conflit ou une version future ne produit pas d’export incomplet présenté comme sûr.

La lecture d’un fichier importé est stricte et sans écriture : schéma exact, taille UTF-8 maximale, dates non futures, références de parties V1 cohérentes et récompenses hebdomadaires prouvées par les faits du fichier. L’aperçu compare une empreinte de révision du stockage et des faits en mémoire. La confirmation revalide cette empreinte ; un changement concurrent impose un nouvel aperçu. La fusion ajoute un seul lot `braise.v2.profile.import.*` adressé par son contenu, sans supprimer ni réécrire les clés locales. Ce lot porte l’union nécessaire pour ne pas perdre un fait seulement en mémoire et devient visible d’un bloc aux autres onglets. Un autre historique V1 est refusé avant toute mutation. Réimporter le même contenu reste idempotent.

Le coût sémantique ne dépend pas d'un fournisseur d'IA payant : les scores sont déjà calculés. Le format BRZ1 contient, par cible, scores, rangs de compétition et ordre stable. Chaque segment compressé et décompressé est contrôlé par taille, en-tête et SHA-256 avant admission. Le cache LRU conserve au plus 4 Mio de tableaux décodés, quatre lectures actives et huit chargements uniques au total. Les requêtes simultanées du même objet partagent une promesse.

Tant que `.openai/hosting.json` conserve `r2: null`, le lecteur emploie explicitement les mêmes segments immuables comme assets du Site. Si un binding R2 est configuré, il devient la source exclusive : binding absent, objet manquant, lecture échouée ou corruption produisent une indisponibilité 503, jamais un score de remplacement ni un repli silencieux vers les assets. La configuration et la qualification d'un R2 réel restent nécessaires pour terminer B1.

L'export public V1 est servi comme flux d'asset par `/semantic-data.json`, sans parser la matrice dans le Worker. Il reste identique à l'empreinte V1 pour respecter la transparence et la licence existantes. Les futures versions compétitives ne reprendront pas automatiquement cette exposition.

Une limitation par IP et fenêtre d'une minute protège contre les rafales simples ; elle est locale à l'isolate et ne remplace pas un dispositif global pour un gros lancement.

## UX

La requête de chargement la plus récente est la seule autorisée à remplacer la partie. Une réponse devenue obsolète ne modifie pas une autre partie. Les modifications d'épingles et de son sont désactivées pendant un POST pour éviter de perdre un changement. Une révision de saisie est capturée au départ : toute édition, même si elle revient au même texte, est préservée à la réponse.

Les effets `guessAccepted`, `bestImproved` et `puzzleWon` naissent uniquement après une réponse valide de la partie courante. Leur identifiant lie partie, numéro d'essai et type. Ils sont consommés par leur propre minuterie, annulés au changement de partie et absents des sauvegardes. Une victoire restaurée conserve son résultat, sans confettis, son, toast ni focus forcé. Les lignes restaurées ne rejouent pas leur animation d'entrée.

Le champ reste modifiable pendant l'analyse. Les rappels de focus sont annulés avec la partie et n'agissent pas lorsqu'une fenêtre est ouverte ou que la personne a déplacé son focus. Le plateau fournit une cible permanente au lien d'évitement. Les succès non victorieux ont une annonce textuelle ; la victoire soumise donne le focus à son titre.

Le son est désactivé par défaut. `prefers-reduced-motion` réduit les animations. Aucune dépendance externe de police, vidéo ou image n'est nécessaire au premier écran.

La fenêtre de progression indique le format local, la présence effective de la copie de secours et les styles réellement accessibles. Elle propose un téléchargement en un clic et un import en deux étapes : choix du fichier, puis confirmation après résumé. Les erreurs de stockage, données illisibles, formats futurs et conflits V1 restent visibles sans bloquer le jeu. Une migration ou un import réussi ne produit ni récompense ni célébration. Les onglets actualisent silencieusement les compteurs, le son et le style, sans toucher à la saisie ou à la fenêtre ouverte. La carte hebdomadaire garde les trois objectifs visibles sans ajouter d’étape au jeu ; les états terminés, verrouillés et équipés sont écrits en toutes lettres.

## Publicité

`AdDecision` reste le seul contrat partagé. En l'absence de fournisseur, politique de consentement et fréquence réels, `decideAd` renvoie toujours `skip/not-configured`, avec disponibilité et fréquence fausses et consentement inconnu. Le composant réservé exécute cette décision mais ne charge aucun script, cadre, pixel, lien ni contrôle. Il n'accède pas aux mots, scores, parties ou sauvegardes. L'activation commerciale et sa mesure restent un lot séparé.

## Limites de cette version

Le profil local reste modifiable par l'utilisateur et n’est synchronisé automatiquement qu’entre les onglets du même navigateur. Le fichier d’export permet une copie manuelle mais ne constitue ni une identité ni une preuve compétitive. La suppression des données du navigateur efface aussi le journal V2 et sa copie de secours. Les parties elles-mêmes restent dans leurs clés V1 et ne sont pas encore une autorité transactionnelle multi-onglets. Ne pas en faire un classement officiel. Le dictionnaire Wikipédia comprend parfois des noms propres ou emprunts. La matrice de 120 cibles est un corpus initial à élargir pour une exploitation pérenne.

La marque, le domaine commercial, l'audience publique, la régie et le consentement publicitaire n'ont pas été provisionnés. Les contrats d'API actuels n'ont pas besoin de D1, R2 ou d'identité utilisateur.

## Référence reproductible B0

`tests/fixtures/v1-reference.json` provient exclusivement du code et des données du commit de référence V1, pas du nouveau lecteur. `node scripts/capture-v1-fixtures.mjs` le reconstruit depuis Git, avec vérification SHA-256 du corpus. Les sauvegardes de `v1-saves.json` sont explicitement synthétiques ; leurs scores sont calculés par ce même moteur de référence. Ne pas remplacer l'oracle par des valeurs issues du code à tester.

`node scripts/measure-v1.mjs` compare deux processus Node séparés après préparation de l'oracle. Le rapport historique B0 reste dans `docs/program/B0-MEASUREMENTS.json` ; les mesures du lecteur segmenté sont écrites dans `docs/program/B1A-MEASUREMENTS.json`. Elles ne qualifient pas la mémoire de Cloudflare Workers.
