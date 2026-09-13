# Flamme progressive et cohérence des écrans

## Demande

Élargir la flamme, augmenter son intensité à mesure que le joueur se rapproche du mot, retirer les flèches décoratives et appliquer les références de la liste partagée par Antoine.

## Changements

- La meilleure température réelle de la partie pilote toujours la scène. La largeur, la hauteur, les replis, le cœur lumineux, le reflet et la présence des braises évoluent progressivement. Un essai moins bon ne refroidit pas le meilleur résultat.
- Le temps du shader intègre une vitesse liée à la chaleur, sans changer brutalement la phase lorsque la température varie. Le bruit est allongé verticalement pour obtenir des rubans de flamme plutôt que des volumes nuageux.
- Budget conservé : 44 échantillons, 14 braises maximum, résolution bornée et animation demandée à 30 images/s maximum. Ces plafonds ne sont pas des mesures de fluidité sur téléphone. Pause, mouvement réduit, invisibilité et repli image conservés ; le repli change aussi de largeur et luminosité avec la température.
- Flèches décoratives retirées des composants produit. Les envois de mots affichent « Tester », les retours nomment leur destination. Les panneaux repliables utilisent + et − ; aucun contrôle ne devient vide.
- Pages secondaires, laboratoire, espace, cercles, studio, intégration et fenêtres de dialogue alignés sur les surfaces encre, commandes ivoire, tailles fluides et espacements du Foyer. Les maquettes restent la référence de navigation.
- Formulaire des duels corrigé : champ et bouton sur la même ligne, champ réductible et bouton à libellé stable. Liens et codes en lecture seule à 16 px. Focus visible, cibles tactiles et styles de survol cohérents.

## Références consultées

Le post https://x.com/levithefirst/status/2092975925306507619 n’était pas lisible directement ; sa liste de quinze ressources a été retrouvée par recherche dans une reprise du post. Aucun paquet ni skill externe installé.

- https://www.ui-skills.com/ : lisibilité, dimensions stables, zones interactives et feedback mesuré.
- https://interfaces.rauno.me/ : champs lisibles sur iOS, saisie clavier, réduction du mouvement, padding interactif et survol réservé aux pointeurs adaptés.
- https://utopia.fyi/ : typographie et espacements fluides.

Ces références guident des choix concrets ; elles ne changent ni les autorisations ni les règles de données du projet.

## Vérifications et limites

TypeScript et build de production réussis. Shader de production compilé et rendu via EGL/llvmpipe : états 0, 50 et 100 à temps identique, plus format compact. États froid, chaud et compact inspectés visuellement. Ces états sont des entrées illustratives d’une étude isolée, jamais des réponses de partie inventées.

Relecture indépendante Astra High : câblage de la meilleure température, cascade CSS, formulaire des duels, survol et indicateurs d’ouverture contrôlés. Corrections intégrées.

Aucun nouveau test navigateur ou Safari iPhone. Les limites WebGL du navigateur disponible restent celles de VOLUME-DELIVERY.md. Les contrôles logiciels ne certifient pas la fluidité sur appareil réel. Moteur, corpus, API, sessions et sauvegardes inchangés. Ancienne automatisation toujours suspendue.
