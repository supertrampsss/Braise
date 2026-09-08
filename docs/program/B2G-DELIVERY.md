# B2g, rotation éditoriale multithématique

## Résultat

Le lot B2g ajoute huit preuves réelles calculées sur les 1 013 881 entrées du corpus complet. Chaque colonne a été vérifiée exhaustivement, capturée dans une preuve immuable à 64 voisins, puis évincée du cache actif. Sept cibles sont approuvées après deux relectures indépendantes. `nature` est rejetée car son voisinage mélange trop de variantes, concaténations et notions abstraites pour fournir trois indices familiers et variés.

Le catalogue de travail reste inactif. Il contient maintenant 39 cibles approuvées parmi 400 identités relues.

## Cibles retenues

| Cible | Catégorie | Indices retenus |
| --- | --- | --- |
| ville | lieux | capitale, quartier, habitants |
| château | lieux | donjon, douves, seigneurie |
| voiture | objets | véhicule, portière, chauffeur |
| bateau | objets | voilier, accoster, naufrage |
| père | personnes | fils, mari, adoptif |
| professeur | personnes | enseignant, université, étudiant |
| drapeau | objets | emblème, tricolore, hissé |

Les indices figurent littéralement dans les preuves exactes. Aucun score, rang, mot ou verdict n'a été simulé.

## Garanties livrées

- Les 40 décisions et les 33 dossiers antérieurs restent inchangés.
- Huit nouvelles preuves BEE2 v2 conservent chacune 64 voisins réels.
- Les huit empreintes de preuve lient chaque décision au corpus vérifié.
- Les huit colonnes ont été évincées après capture. Le staging contient zéro colonne et zéro tombstone.
- Les huit journaux d'éviction sont terminés en phase `purged` et correspondent aux manifestes de preuve.
- Le catalogue reconstruit conserve 400 identités relues, 41 dossiers de preuve, 39 approbations et 2 rejets.
- V1, la publication privée et le corpus produit actif ne changent pas.

## Vérifications

- 147 tests du projet réussis, 0 échec.
- TypeScript validé.
- Construction de production Sites validée.
- Catalogue réel vérifié exhaustivement sur 41 cibles et 1 013 881 entrées.
- Deux relectures ASTRA à effort faible ont produit les décisions éditoriales indépendantes.
- Relecture ASTRA maximale en lecture seule : 48 preuves et révisions, historique, indices, évictions et frontière V1 vérifiés, sans bloqueur.
- Aucun test navigateur demandé ou déclaré.

## État de publication

Ce lot ne modifie pas le Site. Le catalogue V2 reste inactif tant que 365 cibles au minimum, le calendrier, R2 et le Worker ne sont pas qualifiés.

## Prochaine action

Poursuivre les rotations bornées. Il reste 326 approbations pour former un calendrier de 365 jours et 361 pour atteindre l'objectif principal de 400 cibles. Ensuite, produire le calendrier immuable et qualifier R2 et le Worker avant activation privée de V2.
