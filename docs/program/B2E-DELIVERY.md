# B2e, rotation éditoriale multithématique

## Résultat

Le lot B2e ajoute huit cibles réelles calculées sur les 1 013 881 entrées du corpus complet. Chaque colonne a été vérifiée exhaustivement, capturée dans une preuve immuable à 64 voisins puis évincée du cache actif. Les huit cibles sont approuvées après deux relectures indépendantes ; la divergence sur `médecin` a reçu un arbitrage séparé.

Le catalogue de travail reste inactif. Il contient maintenant 25 cibles approuvées sur les 400 requises, réparties dans huit nouvelles catégories pour réduire la concentration thématique des premiers lots.

## Cibles retenues

| Cible | Catégorie | Indices retenus |
| --- | --- | --- |
| pain | alimentation | farine, levain, pétrin |
| acier | matières | alliage, tôles, blindage |
| piano | culture | violon, sonate, quintette |
| médecin | personnes | chirurgien, pharmacien, psychiatre |
| tennis | sport | tournoi, raquette, gazon |
| gare | lieux | trains, voyageurs, quais |
| ordinateur | objets | processeur, logiciel, imprimante |
| liberté | concepts | démocratie, émancipation, oppression |

Les indices proviennent tous des preuves exactes. Aucun score, rang, mot ou verdict n'a été simulé. Pour `médecin`, l'arbitrage considère `pharmacien` comme une profession de santé voisine et non comme une spécialité médicale.

## Garanties livrées

- Les 24 fichiers de preuve antérieurs et leurs décisions restent inchangés.
- Huit nouvelles preuves `BEE2` v2 conservent chacune 64 voisins réels.
- Les empreintes des preuves lient exactement chaque décision au corpus vérifié.
- Les huit colonnes ont été évincées après capture ; le staging est vide et aucun journal d'éviction n'est incomplet.
- Le catalogue reconstruit contient 400 identités relues, 25 preuves courantes et 25 approbations.
- Le vérificateur indépendant a recalculé scores, rangs et ordre sur le corpus complet.

## Vérifications

- 147 tests de projet réussis, 0 échec, après exécution isolée.
- TypeScript validé.
- Construction de production Sites validée.
- Catalogue réel vérifié exhaustivement sur 25 cibles et 1 013 881 entrées.
- Le lint global a été exécuté et retrouve des dettes existantes hors du lot ; aucun fichier applicatif n'a été modifié dans B2e.
- Aucun test navigateur demandé ou déclaré.

Une première exécution concurrente des tests et de la construction a momentanément observé un fragment V1 régénéré. La relance séquentielle, après stabilisation des fragments, passe intégralement ; le problème ne traduit pas une modification des données V1.

## État de publication

Ce lot ne change pas la publication. V1 reste le moteur actif. Le catalogue V2 demeure inactif tant que 365 cibles au minimum, le calendrier, R2 et le Worker ne sont pas qualifiés.

## Prochaine action

Poursuivre la rotation bornée de candidats multithématiques. Il reste 340 approbations pour former un calendrier de 365 jours et 375 pour atteindre l'objectif principal de 400 cibles, puis qualifier le stockage R2 et le lecteur Worker avant activation privée de V2.
