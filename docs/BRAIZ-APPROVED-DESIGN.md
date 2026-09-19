# BRAIZ : brief d’intégration approuvé

## 1. Décision et périmètre

La référence est l’image choisie par Antoine dans cette conversation, fichier `69a72f22-5a9c-46a6-a475-8f44d1c6dd07.png`. Elle présente une flamme orange et dorée, fluide, sans craquelures, sans roche et sans anneaux. Ce choix annule les variantes intermédiaires. Il ne rouvre pas la conception de la page.

Le projet à modifier est `supertrampsss/Braise`, sur le site existant. Ne pas créer de nouveau site, de nouveau dépôt, de nouvelle identité d’hébergement ou de nouvelle mécanique de jeu. Le site 500 signatures et sa direction V2 restent hors de ce lot : aucune nouvelle maquette ou modification implicite de ce projet.

La validation porte sur le rendu choisi, l’architecture sombre en haut et ivoire en bas, et les retraits de texte explicitement demandés. Les phrases restées sur l’image ne prévalent pas sur les instructions suivantes.

## 2. Textes et interface

Conserver la marque `BRAIZ.`, le contexte de partie, le titre `Devinez le mot secret du jour.`, la saisie, son bouton d’envoi, la meilleure piste, l’historique, ses scores/rangs et les commandes utiles. Adapter le titre des archives et des modes existants sans présenter une archive comme le quotidien courant.

Supprimer de la surface de jeu :
- `Votre prochaine idée` ;
- `Le sens, pas les lettres.` et ses variantes ;
- `Un mot après l’autre, la braise s’éveille.` ;
- les slogans équivalents, les paragraphes d’accueil et les explications répétées ;
- les contrôles réservés aux maquettes, les curseurs de chaleur, les valeurs d’illustration et les mentions d’archive de démonstration.

Ne pas supprimer les libellés accessibles, les vrais messages d’erreur, les avertissements de sauvegarde, les règles consultables, l’attribution des données ou les informations de confidentialité. Les explications utiles sont accessibles volontairement via l’aide. La page n’est pas une affiche illustrée : les textes et commandes restent du HTML accessible.

## 3. Flamme approuvée

Utiliser le dessin choisi comme ressource visuelle, pas une nouvelle génération ressemblante. Recadrer uniquement l’illustration, sans embarquer le logo, les mots, les températures ni les éléments du screenshot dans la ressource. Documenter le recadrage et la préparation du fond pour l’intégration. Conserver les courbes orange, les sillons lumineux dorés et les zones rouges internes.

Interdictions : texture craquelée, morceau de charbon, lave rocheuse, mascotte, visage, cristal facetté, socle, temple, décor fantasy, orbite et changement de palette. Le budget visuel doit servir la flamme, pas la décoration de l’écran.

### Mouvement

La silhouette demeure reconnaissable. Une ondulation faible et continue déforme les flux internes ; la base reste stable. La pointe varie légèrement, sans rotation de tout l’objet, rebond ou zoom permanent. Les étincelles restent rares. Une oscillation de luminosité seule ne suffit pas à constituer l’animation demandée.

L’animation dépend de l’état existant et n’évalue aucun mot. La progression est une traduction visuelle de la meilleure température acceptée de la partie, et non une probabilité de victoire. Une réponse moins proche ne fait pas redescendre la flamme. Une erreur, un doublon, un indice refusé ou une réponse API obsolète ne la fait pas progresser.

La lumière se révèle du bas vers le haut, avec une frontière souple, pas un remplissage rectangulaire net. Le maximum n’est réservé qu’à une victoire reconnue par le moteur. Les températures négatives ou non finies n’entraînent ni débordement ni invalidité CSS.

Une partie restaurée présente directement son état acquis. Ne pas rejouer la montée depuis zéro, la célébration, le son, un crédit de progression ou un déplacement de focus. Une nouvelle partie repart avec son propre état, identifié par la référence du puzzle. Les effets transitoires ne sont jamais écrits en stockage.

## 4. Mise en page

### Mobile

En-tête compact avec marque, aide et commandes secondaires. La zone sombre contient titre, flamme, statut et meilleure piste. La surface ivoire contient immédiatement le champ et le bouton d’envoi, puis les contrôles utiles et l’historique. Pas de cartes marketing ni de colonnes analytiques.

Les essais restent des mots complets avec température et rang : ne pas transformer le jeu sémantique en Wordle ou inventer des cases lettre par lettre. Reprendre les scores du serveur sans les multiplier par dix. Une valeur de 23,6° reste 23,6°, pas 236°.

Le champ conserve un corps d’au moins 16 px. L’ouverture du clavier ne provoque pas de retour en haut. La scène se contracte si nécessaire sans masquer la saisie. Les gestes tactiles, les contrôles de tri et d’épingle doivent rester utilisables à 320 px de largeur. Le bouton d’envoi n’est pas recouvert par une publicité ou une animation.

### Ordinateur

Conserver la même identité, une largeur de lecture maîtrisée et une saisie accessible immédiatement. Ne pas convertir la page en tableau de bord avec métriques décoratives. Aucune promesse de fidélité pixel à pixel ne remplace une inspection des rendus.

## 5. Contrats techniques à préserver

Lire `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md` et `GITHUB-DATA-ASSETS.md` avant l’intégration. La base examinée est le commit `e5625362ce4780511920e777707f17cb6bbb55b2`.

Conserver l’orchestration de `components/game.tsx` : requêtes, générations de navigation, contrôle `samePuzzleRef`, normalisation, gestion des réponses tardives, indices, conservation de la saisie, partage et retour de focus. Le composant de flamme reçoit un état et un événement visuel ; il ne lit jamais le corpus et n’importe aucun module serveur.

Préserver les clés `braise.v1.*`, les sauvegardes brutes, le profil V2, ses migrations et son journal. Ne pas effacer le stockage pour obtenir une capture propre. Les modes libre, quotidien, archive et défi doivent conserver leurs identités et règles. Maintenir les accès à Explorer, Progression, archives, collections, expéditions et autres pages existantes, même s’ils passent par les commandes secondaires.

Aucune modification des données sémantiques, du calendrier, des scores, de l’API, des récompenses, de l’authentification, de la publicité ou de l’hébergement dans ce lot. Les fonctions existantes ne deviennent pas opérationnelles par simple présence d’un bouton.

## 6. Animation, repli et accessibilité

Isoler le rendu dans un composant client et un moteur graphique sans dépendance au domaine. Utiliser la ressource locale approuvée. Ne pas appeler un service génératif pour chaque visite.

Arrêter la boucle hors écran et dans un onglet masqué. Respecter `prefers-reduced-motion` : état fixe fidèle, sans boucle continue ni flash. Prévoir un rendu image en cas d’absence de WebGL, de perte de contexte, d’échec de chargement ou d’économie de ressources. L’absence d’animation ne doit jamais bloquer la partie.

Borner le ratio de pixels et la cadence. Cible de conception : 30 images par seconde sur mobile, sans dépendance nouvelle volumineuse. Ce sont des budgets à mesurer, pas des performances revendiquées sans test. Nettoyer les observateurs, événements, textures, shaders et demandes d’animation au démontage.

La flamme est décorative pour les lecteurs d’écran : le statut et les scores textuels portent l’information. Maintenir le focus visible et les annonces d’erreur. Pas d’information uniquement transmise par la couleur.

## 7. Recette

Tester les états : première visite, saisie, mot accepté, nouveau meilleur score, moins bon essai, doublon, mot absent, erreur réseau, réponse tardive, indice, victoire, reprise d’une victoire, reprise d’une partie, changement de mode, changement de jour et archive. Tester les mots longs et les températures négatives.

Contrôler 320, 390, 768 et 1440 px, le clavier mobile réel, le contraste, les dialogues et leur retour de focus, le mode mouvement réduit et le repli sans WebGL. Vérifier les commandes existantes après changement de présentation.

Les tests unitaires du rendu/projection, une vérification syntaxique TSX ou un aperçu local ne constituent pas un `npm test` complet, une construction de production, une validation Safari ou un déploiement. Rapporter chaque contrôle sous son nom et conserver ses preuves.

## 8. Livraison et obstacles connus

La documentation du dépôt indique que le miroir GitHub ne contient pas tous les fichiers V1 nécessaires à une construction complète, ni tout l’historique canonique. Ne pas régénérer des données différentes pour passer artificiellement les contrôles. Obtenir les fichiers exacts par la voie autorisée ou qualifier le changement dans la source canonique existante.

Livrer sur la branche existante `design/approved-ember-braiz`, via une PR relisible. L’autorisation d’implémenter est donnée ; une nouvelle validation créative n’est pas nécessaire pour le périmètre retenu. En revanche, ne pas fusionner en prétendant avoir validé une construction non exécutée. Ne pas confondre un commit, une fusion et une publication sur `braiz.io`.

La livraison finale doit distinguer : brief écrit, code enregistré, contrôles exécutés, PR, fusion, version publiée et contrôle de l’URL publique. Tout blocage de déploiement doit être nommé explicitement. Conserver le projet d’hébergement existant.
