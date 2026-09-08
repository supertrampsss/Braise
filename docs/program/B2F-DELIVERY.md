# B2f, rotation éditoriale avec rejet conservateur

## Résultat

Le lot B2f ajoute huit preuves réelles calculées sur les 1 013 881 entrées du corpus complet. Chaque colonne a été vérifiée exhaustivement, capturée dans une preuve immuable à 64 voisins puis évincée du cache actif. Sept cibles sont approuvées après deux relectures indépendantes ; `agriculture` est rejetée car son voisinage reste dominé par des variantes et composés morphologiques répétitifs.

Le catalogue de travail reste inactif. Il contient maintenant 32 cibles approuvées sur les 400 requises. Le rejet est conservé comme décision réelle et révisable, sans fabriquer d'indices ni de validation.

## Cibles retenues

| Cible | Catégorie | Indices retenus |
| --- | --- | --- |
| médecine | corps | pharmacie, chirurgie, pédiatrie |
| nuit | quotidien | crépuscule, obscurité, sommeil |
| tramway | transport | métro, rames, lignes |
| lait | alimentation | fromage, yaourt, vache |
| pétrole | matières | barils, raffinerie, carburant |
| violon | objets | concerto, sonate, soliste |
| athlétisme | sport | championnats, décathlon, saut |

Les indices proviennent tous des preuves exactes. Aucun score, rang, mot ou verdict n'a été simulé.

## Cible rejetée

`agriculture` n'est pas approuvée. Son voisinage contient trop de variantes de la cible et de composés spécialisés en « culture » pour produire trois indices naturels, variés et suffisamment utiles au jeu.

## Garanties livrées

- Les 32 fichiers de preuve antérieurs et leurs décisions restent inchangés.
- Huit nouvelles preuves `BEE2` v2 conservent chacune 64 voisins réels.
- Les empreintes des preuves lient exactement chaque décision au corpus vérifié.
- Les huit colonnes ont été évincées après capture ; le staging est vide et les seize journaux d'éviction sont terminés puis purgés.
- Le catalogue reconstruit contient 400 identités relues, 33 dossiers de preuve et 32 approbations.
- Le vérificateur indépendant a recalculé scores, rangs et ordre sur le corpus complet.

## Vérifications

- 147 tests de projet réussis, 0 échec.
- TypeScript validé.
- Construction de production Sites validée.
- Catalogue réel vérifié exhaustivement sur 33 cibles et 1 013 881 entrées.
- Relecture ASTRA maximale : historique antérieur, preuves, décisions et staging validés sans bloqueur.
- Aucun test navigateur demandé ou déclaré.

## État de publication

Le catalogue V2 demeure inactif tant que 365 cibles au minimum, le calendrier, R2 et le Worker ne sont pas qualifiés. La publication privée peut recevoir le reste du produit sans activer ce corpus incomplet.

## Prochaine action

Poursuivre les rotations bornées de candidats multithématiques. Il reste 333 approbations pour former un calendrier de 365 jours et 368 pour atteindre l'objectif principal de 400 cibles, puis qualifier le stockage R2 et le lecteur Worker avant activation privée de V2.
