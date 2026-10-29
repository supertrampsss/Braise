# Qualité éditoriale des mots

Le moteur Word2Vec, ses rangs et les parties déjà datées restent immuables. La polysémie est autorisée : les associations culinaires et fiscales d’assiette sont celles du modèle.

## Revue reproductible

Exécuter `node scripts/review-word2vec-catalogue.mjs`. Le dossier privé `work/editorial-review/catalogue.json` contient les 64 premiers voisins de chaque cible avec leurs rangs exacts, l’identité du corpus et les empreintes des colonnes. Aucun mot ni score n’est réécrit ; aucune cible nouvelle n’est activée.

Le contrôle valide les empreintes et extrait les voisins des colonnes existantes. Il ne remplace pas l’oracle numérique `scripts/verify-word2vec.py`, ni une décision éditoriale humaine.

## Critères de décision

Pour chaque cible, examiner :

1. Le mot secret est un mot français identifiable et sa graphie est accessible dans le corpus.
2. Plusieurs pistes usuelles permettent d’approcher la cible. Une seule abréviation, un nom propre ou une famille de fautes ne doit pas constituer tout le voisinage exploitable.
3. Les différents sens du mot sont recensés ; un sens inattendu n’entraîne pas une correction artificielle des scores.
4. Les trois indices restent dosés par rapport au meilleur essai réel. Le voisinage affiché dans ce dossier ne devient jamais une liste de voisins imposée au moteur.
5. Les retours joueurs sont examinés avec le contexte qu’ils choisissent de transmettre. La mesure d’usage ne collecte jamais leurs mots.

La décision de chaque ligne reste « pending-human-review » tant qu’une revue n’a pas été faite. Une future exclusion ou extension nécessite une nouvelle édition, un calendrier distinct et la conservation des lecteurs historiques. Les colonnes déjà servies ne sont jamais retouchées.

## Graphies avec ligature

Après un refus, BRAIZ peut proposer une graphie en oe seulement si le moteur de cette partie la reconnaît. Le joueur choisit « Utiliser », puis envoie son mot. Ce choix ne consomme aucun essai et ne modifie pas automatiquement sa saisie.

## Fréquence opérationnelle

Revoir ce dossier avant toute nouvelle édition ou extension de la partie libre, et relire les cibles signalées par les joueurs. Aucun verdict éditorial global ni amélioration de satisfaction n’est affirmé sans ces observations.
