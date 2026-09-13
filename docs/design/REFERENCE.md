# BRAISE : référence de refonte

Choix explicites d’Antoine : accueil, jeu et victoire A / Le Foyer, avec une flamme remplaçant le rocher. Autres modes A ; Voyage A et navigation chapitres B ; Entre amis B ; Profil B.

Composition : une colonne mobile, fond obsidienne immersif, titre centré, flamme centrale, bouton principal bas. Aucun split desktop promotionnel. Interface native et données réelles, jamais une capture de maquette utilisée comme interface.

Les statistiques et invitations des images sont illustratives. Les titres et nombres d’épreuves restent ceux des parcours réels. Aucune Camille fictive. Profil utilise les compteurs locaux réels.

## Assets

Génération intégrée imagegen. Assets consommés : public/art/foyer.webp, flame.webp, forest.webp. Sources PNG conservées dans les sorties générées. Conversion WebP sans altération de composition.

Brief foyer : décor vertical cinématique obsidienne, corniche volcanique en bas, braises éparses, atmosphère noire ambrée, centre libre, aucun texte ni interface.
Brief flamme : flamme dorée réaliste isolée sur noir, rubans lumineux fins, cœur ivoire, pas de rocher ni icône vectorielle.
Brief forêt : forêt ancienne sombre, racines et marches moussues, brasero central, arche en ruine, haut et bas libres pour l’interface.

La flamme est une texture animée dans Three.js, pas une simulation volumétrique physique. Sans WebGL : même visuel statique. Préférence réduction de mouvement respectée.

## Contrôles

167 tests passent. TypeScript et build vérifiés. Accueil, menu, profil, Voyage et jeu inspectés dans le navigateur d’aperçu. WebGL indisponible dans ce navigateur. Clavier logiciel mobile non testé. Victoire conservée sur logique réelle, non forcée pour une capture. Aucun score ni participant créé artificiellement pour la revue.

Ancien programme automatique toujours suspendu. Cette livraison concerne la refonte autorisée.

## Correction de direction après retour « site de 14 ans »

Le Foyer conserve sa flamme, sa navigation et ses écrans choisis, mais retire le décor volcanique photographique derrière le jeu, les boutons brillants et les phrases décoratives autour du feu. Fond encre uniforme, commandes ivoire mates, saisie nette, flamme moins envahissante. Le décor forêt reste limité à Voyage. La feuille Foyer est consolidée au lieu d’empiler une nouvelle couche d’ajustements.

TypeScript et construction vérifiés pour cette correction. Aucun nouveau test navigateur ni contrôle GPU : les observations de la passe précédente ne qualifient pas cette nouvelle composition.

## Scène interactive volumétrique

Voir VOLUME-DELIVERY.md : la voie WebGL principale utilise désormais un champ de densité 3D turbulent. L’asset flame.webp devient uniquement le repli. L’étude filmée est un rendu logiciel isolé du shader, pas une capture du jeu ni une qualification Safari. Les limites d’animation des livraisons précédentes restent historiques.

## Flamme et commandes, retour suivant

Voir HEAT-DELIVERY.md. La flamme est plus large et son intensité suit nettement la meilleure température réelle. Les flèches décoratives disparaissent. Les retours et envois utilisent des mots explicites ; les pages secondaires partagent les surfaces, la typographie et les interactions sobres du Foyer.
