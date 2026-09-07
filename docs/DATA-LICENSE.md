# Attribution et licence des données

Données d'origine : fastText Wikipedia French, skip-gram, 300 dimensions.

Auteurs : Piotr Bojanowski, Edouard Grave, Armand Joulin, Tomas Mikolov, fastText / Facebook.

Publication : Enriching Word Vectors with Subword Information (2017).

Page officielle : https://fasttext.cc/docs/en/pretrained-vectors.html

Vecteurs : https://dl.fbaipublicfiles.com/fasttext/vectors-wiki/wiki.fr.vec

Licence de l'origine et des données dérivées de Braise : Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0).

Résumé : https://creativecommons.org/licenses/by-sa/3.0/

Texte légal : https://creativecommons.org/licenses/by-sa/3.0/legalcode

Modifications : lecture des 50 000 premières entrées ; filtrage par alphabet français ; normalisation Unicode NFC et minuscules ; dédoublonnage ; conservation des 30 000 premières entrées filtrées ; normalisation unitaire ; sélection éditoriale de 120 cibles, ordonnées par SHA-256 ; calcul cosinus ; arrondi et encodage entier signé 16 bits little-endian, facteur 10 000.

Le jeu affiche la température comme cosinus × 100, arrondi à une décimale. Seule la réponse exacte reçoit 100 degrés. Le rang est calculé dans le vocabulaire de Braise ; des égalités sont possibles après quantification.

La licence et l'attribution sont également intégrées à l'artefact `data/semantic-fr.json` et présentées dans le jeu. Conserver ces mentions et appliquer les conditions de partage à l'identique pour redistribuer les données dérivées. Les auteurs du modèle ne sont pas associés au projet Braise.
