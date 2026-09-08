# B2d, voisinages profonds et historique éditorial

## Résultat

Le lot B2d étend les sept preuves rejetées de 12 à 64 voisins réels sans modifier leurs dossiers historiques. Les sept cibles ont été relues indépendamment puis approuvées avec exactement trois indices naturels et distincts. Le catalogue de travail reste inactif : il contient désormais 17 cibles approuvées sur les 400 requises.

## Garanties livrées

- `BEE2` v1 à 12 voisins reste lisible et immuable.
- `BEE2` v2 conserve 64 voisins, l'empreinte de sa preuve mère et le préfixe historique exact.
- Une preuve archivée peut être étendue depuis le corpus après éviction de sa colonne, sans recréer le staging.
- L'index multirévision est sérialisé depuis le chemin canonique du dossier, y compris à travers des alias symboliques.
- Les décisions forment une chaîne sans branche, boucle, retour arrière, date décroissante ni preuve réutilisée.
- Le catalogue transporte l'historique complet. Supprimer la filiation ou le rejet antérieur invalide le document.
- Chaque score, rang, ordre et voisin est recalculé depuis les 1 013 881 entrées BRV2 par un vérificateur indépendant.

## Réexamen éditorial

| Cible | Indices retenus |
| --- | --- |
| vallée | plaine, rivière, versant |
| hiver | automne, gelées, luge |
| montagne | enneigée, pentes, sommet |
| étoile | exoplanète, constellation, nébuleuse |
| faune | flore, biodiversité, mammifères |
| printemps | automne, dégel, floraison |
| planète | orbitant, extraterrestre, galaxie |

Deux avis indépendants ont été sollicités. La divergence sur `planète` a reçu un arbitrage séparé fondé sur la preuve exacte à 64 voisins. Le bruit lexical a été écarté ; aucune approbation n'a été déduite automatiquement d'un score.

## Vérifications

- 147 tests de projet, 0 échec.
- TypeScript et ESLint ciblé validés.
- Construction de production Sites validée.
- Catalogue réel reconstruit avec 400 identités relues, 17 preuves courantes et 17 approbations.
- Vérification exhaustive du catalogue réel sur le corpus complet.
- Aucun test navigateur demandé ou déclaré.

## État de publication

Ce lot ne change pas la publication. V1 reste le moteur actif. Le catalogue V2 demeure inactif tant que 365 cibles au minimum, le calendrier, R2 et le Worker ne sont pas qualifiés.

## Prochaine action

Continuer la rotation bornée des candidats, archiver chaque preuve à 64 voisins et obtenir 348 approbations supplémentaires pour le calendrier de 365 jours, puis qualifier le stockage R2 et le lecteur Worker avant activation privée de V2.
