# Braise

Jeu web français de proximité sémantique : mot quotidien, archives, mode libre, défis par lien, objectifs hebdomadaires, styles à débloquer et partage sans spoiler.

## Développement

- Stack : React, TypeScript, Vinext, Cloudflare Workers, composants Radix/Shadcn fournis.
- Installation : `npm run install:ci`.
- Vérification du moteur et de l'API : `npm test`.
- Vérification TypeScript : `npm run typecheck`.
- Construction : `npm run build`.

Le déploiement Sites utilise l'identité existante de `.openai/hosting.json`. Le dépôt source lié à cette identité doit recevoir le commit exact avant de sauvegarder et déployer une version. Ne pas recréer le Site pour une mise à jour.

## Moteur

30 000 entrées françaises filtrées, 120 cibles courantes. Scores réels issus de fastText Wikipedia français, 300 dimensions, pré-calculés par similarité cosinus et quantifiés à 1/10 000. Le serveur expose une proposition à la fois ; le gros corpus n'est pas envoyé au chargement du jeu.

La matrice V1 est compilée en 120 segments binaires immuables par `npm run semantic:shards`. Scores, rangs et ordre sont pré-calculés, puis chaque objet est contrôlé par empreinte avant usage. Le cache serveur est borné en octets et en lectures simultanées. Le Worker ne contient plus la matrice encodée. Les assets restent le transport provisoire tant que le binding R2 réel n'est pas configuré et qualifié.

Le rang porte sur le dictionnaire de Braise. Certaines formes rares ou fléchies peuvent manquer. Les mots absents sont refusés explicitement, sans score inventé. Les cibles se répètent après 120 quotidiens ; le mode libre peut rencontrer des répétitions.

`data/semantic-fr.json` contient les données dérivées, sous CC BY-SA 3.0, avec attribution et transformations. Voir `docs/DATA-LICENSE.md`. Une copie est proposée à `/semantic-data.json` pour la transparence de réutilisation. Elle dévoile la collection de cibles : ne pas utiliser cette V1 pour une compétition dotée ou un classement anti-triche.

Reconstruction : installer Python et NumPy, puis lancer `python scripts/build-semantic-data.py`. Le script télécharge seulement les 50 000 premières lignes du modèle et conserve son cache brut dans `work/semantic`, ignoré par Git. Le fichier reproductible final est écrit dans `data`.

Le pipeline local B1b prépare le futur corpus complet sans modifier V1. `npm run semantic:v2:build -- --source <fichier.vec> --output work/semantic-v2` lit le fichier jusqu'à EOF, normalise les vecteurs avec une méthode stable, déduplique exactement sur disque et produit des segments BRV2 immuables. Les lignes, segments et buffers sont bornés. Une interruption conserve uniquement les segments validés et peut reprendre avec la même empreinte de source et la même configuration. Un verrou abandonné demande l'identifiant exact inscrit dans `.build.lock` et l'option `--recover-lock-owner` ; un processus encore actif ne peut pas être remplacé.

`npm run semantic:v2:verify -- --source <fichier.vec> --output work/semantic-v2` relit indépendamment toute la source et tous les segments, contrôle chaque association mot/vecteur, les exclusions, les empreintes et l'inventaire sémantique. Le pointeur `active.json` n'est créé qu'après cette vérification. Le corpus français complet a depuis été ingéré et vérifié localement. La génération et la revue des cibles, puis la qualification R2/Worker, restent nécessaires avant activation produit.

`npm run semantic:v2:restore` orchestre une reprise reproductible dans les chemins ignorés sous `work/`. Par défaut, il exige la source locale `work/source/wiki.fr.vec`. L'option explicite `--download` reprend uniquement l'URL fastText figée, sans accepter d'URL fournie par l'appelant. Avant toute adoption, la commande contrôle le fichier par descripteur, sa taille de 3 027 096 151 octets et son SHA-256, puis reconstruit et vérifie séparément BRV2, BPI2 et le catalogue éditorial contre les empreintes B1E. Elle ne publie et n'active jamais V2.

Le lot B1c ajoute la génération locale d'une cible arbitraire : `npm run semantic:v2:target:build -- --corpus work/semantic-v2 --output work/semantic-targets-v2 --target-id <id>`. Il calcule le cosinus réel sur les vecteurs float32, quantifie selon un contrat figé, puis écrit des pages bornées de scores int16, rangs uint32 et ordre stable uint32. `npm run semantic:v2:target:verify` recalcule exhaustivement la cible avant son activation locale. Un quota global, fixé à huit cibles par défaut, empêche le staging de devenir une matrice quadratique durable. Les interruptions réservent leur place et peuvent reprendre sans adopter une queue non checkpointée.

Le lot B1d ajoute l'index de présence exact `BPI2`. `npm run semantic:v2:index:build -- --corpus work/semantic-v2 --output work/semantic-targets-v2` reprend chaque identité BRV2, la range dans deux niveaux de préfixes SHA-256 et n'active l'index local qu'après vérification exhaustive de la bijection mot-identifiant. `npm run semantic:v2:index:verify` contrôle tous les objets ; la lecture ponctuelle ne charge qu'une racine bornée, une page de préfixe et une feuille bornée. La canonisation reste celle de BRV2 et ne réutilise jamais les alias approximatifs V1.

`npm run semantic:v2:target:evict -- --corpus work/semantic-v2 --output work/semantic-targets-v2 --target-id <id>` vérifie une cible complète avant son retrait. Génération, vérification et éviction partagent un verrou lecteur/mutateur. Le renommage atomique et le journal reprenable empêchent une suppression interrompue de libérer ou de recréer silencieusement un emplacement.

Ces commandes restent des outils de staging. La source fastText française complète a été ingérée et vérifiée localement : 1 013 881 entrées admises sur 1 152 449 lignes, 248 segments, index exact complet. Huit colonnes réelles respectant le quota ont été préparées et contrôlées. Les empreintes et mesures sont figées dans `docs/program/B1E-MEASUREMENTS.json`. Le transfert durable et la qualification R2/Worker restent nécessaires avant activation produit.

Le chantier B2 conserve 400 cibles courantes relues lexicalement par des agents dans un catalogue de travail inactif. Revue lexicale, qualité des voisinages, indices, colonne numérique et approbation sont des statuts distincts. `npm run semantic:v2:evidence:capture -- --corpus <corpus> --targets <staging> --evidence <preuves> --target-id <id>` archive une preuve immuable de 64 voisins seulement après vérification exhaustive de la colonne. `npm run semantic:v2:evidence:expand -- --corpus <corpus> --evidence <preuves> --target-id <id> --parent-sha256 <empreinte>` étend une ancienne preuve de 12 voisins depuis le corpus, y compris après éviction de sa colonne, sans modifier le dossier historique. `npm run semantic:v2:evidence:verify -- --corpus <corpus> --evidence <preuves> --target-id <id> --expected-sha256 <empreinte>` recalcule le voisinage et l'histogramme directement depuis le corpus. L'index conserve toutes les révisions et la résolution d'une décision utilise toujours son empreinte exacte. Le dossier des preuves doit rester hors du staging des cibles. Les commandes de catalogue exigent `--evidence <preuves>` et distinguent une colonne présente d'une preuve archivée. Un calendrier V2 ne peut être produit qu'avec 365 approbations liées à l'empreinte exacte de leur preuve et reste inactif jusqu'à la bascule explicite.

## État et publicité

Les parties, les pistes, le son et les victoires sont locaux au navigateur. Le profil V2 reprend la progression V1 après une copie de secours vérifiée et ses événements convergent entre les onglets du même navigateur. Un export JSON lisible permet de copier manuellement le profil, ses récompenses et ses préférences vers un autre appareil ; l’import prévisualise la fusion, exige une confirmation et ne déplace pas les parties en cours ni les épingles. Les archives ouvrent les mots passés depuis le lancement, avec la même partie sauvegardée que le quotidien correspondant. Une réussite tardive reste une archive et ne réécrit pas la série historique. Trois objectifs repartent chaque lundi à l’heure de Paris et débloquent des styles permanents, sans visionnage publicitaire ni avantage de jeu. Aucun compte ni synchronisation automatique multi-appareil. Cet historique reste personnel et non compétitif. Les défis partagent une seed et se comparent par leurs résultats, sans classement en direct.

Le site inclut un emplacement publicitaire réservé. Aucune régie, aucune annonce réelle, aucun consentement publicitaire simulé et aucun outil d'analyse tiers ne sont activés. Un lancement commercial nécessite les valeurs du compte éditeur approuvé, le dispositif de consentement et les informations d'éditeur réelles.

La version initiale est publiée en accès privé. Les liens de défis deviendront librement accessibles après ouverture de l'audience du Site ou déploiement public approprié.

## Documentation

- `docs/PRODUCT.md` : brainstorming, boucle, monétisation, scénarios et priorités.
- `docs/ARCHITECTURE.md` : contrats de données et invariants.
- `docs/DATA-LICENSE.md` : source et licence des données.

## Vérification

Tests automatisés du calendrier Paris (y compris changements d'heure), rotation des 120 cibles, victoire, score sémantique, indices, validation API et séries. Construction de production et vérification TypeScript. Aucun test visuel dans un navigateur n'a été effectué lors de la création.

## Programme des dix évolutions

- `docs/program/BRAISE-PLAN.md` : plan intégré, douze missions, dépendances et critères de livraison.
- `docs/program/GOAL.md` : contrat de reprise autonome et conditions d’arrêt.
- `docs/program/EXECUTION.json` : état vérifiable du programme.
- `docs/program/BASELINE.json` : référence du corpus et des identités V1 à préserver.
- `docs/program/B0-DELIVERY.md` : compatibilité V1 implémentée, preuves et limites de validation.
- `docs/program/B1A-DELIVERY.md` : segmentation du moteur implémentée, qualification R2 encore requise.
- `docs/program/B1B-CORPUS-DIRECTIVE.md` : exigence de dictionnaire complet et critères d'acceptation du futur corpus.
- `docs/program/B1C-DELIVERY.md` : générateur paginé d'une cible BRV2, classement exact et staging global borné.
- `docs/program/B1D-DELIVERY.md` : index lexical exact BPI2 et éviction coordonnée du cache de cibles.
- `docs/program/B2B-DELIVERY.md` : preuves éditoriales durables, cycle d'éviction réel et réutilisation du quota.
- `docs/program/B2C-DELIVERY.md` : premier lot de huit rotations réelles, revues et rendement éditorial mesuré.
- `docs/program/B2D-DELIVERY.md` : preuves étendues à 64 voisins, historique infalsifiable et réexamen des sept rejets.
- `docs/program/B3-DELIVERY.md` : design vivant, événements accessibles et socle publicitaire inactif.
- `docs/program/B4A-DELIVERY.md` : profil local V2, migration sauvegardée et convergence entre onglets.
- `docs/program/B4B-DELIVERY.md` : archives jouables, calendrier Paris contrôlé et progression non rétroactive.
- `docs/program/B4C-DELIVERY.md` : objectifs hebdomadaires réels et styles permanents dédupliqués.
- `docs/program/B4D-DELIVERY.md` : export lisible, aperçu d’import et fusion locale contrôlée.

Le calendrier et les seeds V1 sont désormais isolés du futur catalogue. Les références de partie versionnées sont exposées et contrôlées par l'API, avec maintien des requêtes V1 sans référence. Les lecteurs de sauvegarde utilisés par l'interface sont couverts par des fixtures synthétiques aux scores réels.

Pour reconstruire l'oracle historique, lancer `node scripts/capture-v1-fixtures.mjs`, puis `npm test`. Il repart du commit V1 conservé dans Git. Pour la comparaison mémoire locale, lancer ensuite `node scripts/measure-v1.mjs`. Elle écrit `docs/program/B1A-MEASUREMENTS.json`. Les mesures Node ne valent pas validation de la limite mémoire du Worker.
