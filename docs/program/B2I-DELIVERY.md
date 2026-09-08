# B2i, vérification exhaustive par lots bornés

## Résultat

La vérification éditoriale regroupe désormais huit cibles au maximum par lecture du corpus. Chaque proposition conserve un score réellement recalculé ; aucun résultat historique n'est adopté sans contrôle. La méthode scalaire, la capture et l'extension des preuves restent inchangées.

Sur les mêmes huit cibles et les 1 013 881 entrées réelles, la mesure locale séquentielle donne 144,949 secondes pour la méthode scalaire puis 21,594 secondes pour la méthode groupée, soit un facteur de 6,71 sur ce cas mesuré. Les deux résultats sont identiques. Ce facteur n'est pas une promesse universelle et ne mesure pas la vitesse du jeu en ligne.

## Garanties

- Au maximum huit vecteurs cibles copiés, huit histogrammes et huit listes d'associations.
- Accumulation float64 dans l'ordre des dimensions, normes, arrondi, rangs et égalités conservés.
- Contrôle de tous les segments et de toutes les chaînes historiques, y compris une preuve ancienne sélectionnée par son empreinte.
- Les arguments sont copiés avant la première attente : une mutation du tableau appelant ne peut pas agrandir le lot ou changer ses identités.
- Les paramètres internes de corpus et de dossier ne peuvent pas être remplacés par des propriétés supplémentaires des requêtes.
- Progression JSON sur stderr après chaque groupe vérifié. stdout reste réservé au succès final, après vérification des colonnes actives et des compteurs.
- Aucun nouveau fichier de score, cache persistant, changement de décision éditoriale ou activation produit.

## Vérifications

Les tests couvrent notamment les tailles 1, 8 et 9, les vecteurs signés, les égalités au seuil des 64 associations, les cibles réparties entre segments, les anciennes preuves, un ancêtre corrompu, un histogramme falsifié cohérent avec son manifeste, ainsi que l'échec du neuvième dossier sans faux événement de réussite.

La relecture ASTRA maximale a fait corriger deux risques sur les arguments de la nouvelle API ; leurs tests de régression sont présents. Aucun bloqueur restant dans le diff relu.

Contrôle du catalogue réel complet et résultats finaux des gates : voir B2I-MEASUREMENTS.json.

## Publication et suite

Le catalogue reste à 54 approbations sur 57 dossiers prouvés. Le moteur et l'interface du Site privé sont inchangés. Aucun test navigateur effectué. Les mesures mémoire Node locales ne qualifient pas la limite mémoire du Worker hébergé.

Poursuivre les rotations éditoriales avec cette vérification plus rapide. Il reste 311 approbations pour le calendrier annuel et 346 pour l'objectif de 400 cibles, puis le calendrier immuable, la qualification réelle R2/Worker et l'activation V2. Les données absentes du miroir GitHub restent décrites dans GITHUB-DATA-ASSETS.md.
