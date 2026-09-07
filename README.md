# Braise

Jeu web français de proximité sémantique : mot quotidien, mode libre, défis par lien, carnet de pistes, progression personnelle et partage sans spoiler.

## Développement

- Stack : React, TypeScript, Vinext, Cloudflare Workers, composants Radix/Shadcn fournis.
- Installation : `npm run install:ci`.
- Vérification du moteur et de l'API : `npm test`.
- Vérification TypeScript : `npm run typecheck`.
- Construction : `npm run build`.

Le déploiement Sites utilise l'identité existante de `.openai/hosting.json`. Le dépôt source lié à cette identité doit recevoir le commit exact avant de sauvegarder et déployer une version. Ne pas recréer le Site pour une mise à jour.

## Moteur

30 000 entrées françaises filtrées, 120 cibles courantes. Scores réels issus de fastText Wikipedia français, 300 dimensions, pré-calculés par similarité cosinus et quantifiés à 1/10 000. Le serveur expose une proposition à la fois ; le gros corpus n'est pas envoyé au chargement du jeu.

Le rang porte sur le dictionnaire de Braise. Certaines formes rares ou fléchies peuvent manquer. Les mots absents sont refusés explicitement, sans score inventé. Les cibles se répètent après 120 quotidiens ; le mode libre peut rencontrer des répétitions.

`data/semantic-fr.json` contient les données dérivées, sous CC BY-SA 3.0, avec attribution et transformations. Voir `docs/DATA-LICENSE.md`. Une copie est proposée à `/semantic-data.json` pour la transparence de réutilisation. Elle dévoile la collection de cibles : ne pas utiliser cette V1 pour une compétition dotée ou un classement anti-triche.

Reconstruction : installer Python et NumPy, puis lancer `python scripts/build-semantic-data.py`. Le script télécharge seulement les 50 000 premières lignes du modèle et conserve son cache brut dans `work/semantic`, ignoré par Git. Le fichier reproductible final est écrit dans `data`.

## État et publicité

Les parties, les pistes, le son et les victoires sont locaux au navigateur. Aucun compte ni synchronisation multi-appareil. Les défis partagent une seed et se comparent par leurs résultats, sans classement en direct.

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
