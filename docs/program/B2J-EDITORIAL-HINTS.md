# B2J · indices éditorialisés V1

Cette tranche ajoute une politique lexicale conservatrice au moment où BRAIZ
choisit un indice. Elle s’applique aux 120 cibles du moteur V1 actuellement
publié.

La politique retire uniquement les mots-outils, l’artefact `test`, les entrées
qui ne sont pas des mots français simples et les variantes morphologiques
évidentes de la cible. Les mots longs ou composés restent disponibles en
repli, afin de ne pas diminuer artificiellement la couverture. Le choix reste
ordonné par la colonne sémantique existante.

La température, le rang, la cible, le dictionnaire et les données de partie ne
sont pas modifiés. La fonction éditoriale ne reçoit que le mot candidat et
retourne ce même candidat ou aucun candidat.

Le catalogue `data/editorial-v2-catalogue.json` et ses preuves concernent le
corpus V2 complet. Ils restent inactifs tant que le corpus, l’hébergement des
colonnes et le calendrier n’ont pas été qualifiés. Cette séparation est
intentionnelle : elle permet d’améliorer l’expérience V1 sans présenter des
voisins V2 comme des données réellement actives.

Vérification de livraison : `npm run typecheck`, `node scripts/test-game.mjs`
(169 tests passés), puis construction Sites.
