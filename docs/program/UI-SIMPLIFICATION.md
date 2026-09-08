# Interface centrée sur le jeu

Demande d'Antoine : simplifier Braise en s'inspirant de son projet `supertrampsss/500SIGNATURESV2`. Référence consultée : `site/index.html` et `site/src/style.css`, branche main, commit observé `c612a0e6d43b2503c7a16e4fd0d438f3729dfc69`.

## Choix appliqués

- Trois entrées permanentes : Jouer, Explorer, Progression. Elles restent toutes accessibles sur mobile.
- Une seule colonne de jeu : saisie en premier, meilleure piste compacte, carnet seulement lorsqu'il contient des épingles, puis essais.
- Suppression du grand cadran, du slogan et de la colonne de cartes concurrentes. La température reste réelle ; aucun zéro fictif n'est affiché avant une proposition.
- Collections, expéditions, laboratoire, cercles, duels, espace serveur et studio regroupés dans Explorer.
- Niveau, objectifs, styles, son et transfert du profil accessibles depuis Progression.
- Navigation en pilule et surfaces sobres, inspirées de la référence, avec l'accent de Braise conservé.

## Préservation

Les vues Jouer et Explorer sont masquées avec `hidden`, sans démonter les sélecteurs : mémoire des expéditions et partie courante restent présentes. L'ouverture d'un parcours revient au plateau avant le chargement, y compris en cas d'erreur. Les retours de focus vérifient la vue, la modale et la requête courantes. L'aide permet de revenir au jeu depuis Explorer. Le retrait de la dernière épingle du carnet rend le focus à la saisie.

Aucun changement de moteur, score, API, format de sauvegarde, corpus, règle, quota ou donnée utilisateur. Les autres routes restent accessibles et le corpus V2 reste inactif.

Le style dédié `app/focused-interface.css` est limité à `.focused-interface`, sauf l'espacement des contenus déplacés dans le dialogue. Conserver les règles explicites de visibilité du menu et de `hidden` : les anciens styles responsive restent utilisés par les autres écrans.

## Vérifications

147 tests du projet réussis, TypeScript validé. Relecture ASTRA maximale en lecture seule : quatre régressions potentielles de navigation/mobile corrigées, aucun bloqueur restant identifié. ESLint ciblé comparé à la référence : mêmes huit diagnostics préexistants, aucune nouvelle règle en échec. Construction finale contrôlée avant publication.

Aucune validation navigateur ni capture n'a été demandée ou effectuée. Les contrôles automatisés ne constituent pas une validation visuelle par des joueurs.

## Publication et suite

Publication privée v7 confirmée le 8 septembre 2026 à 18:40:03 UTC, source `4f7852afd69f05593d8e02a33f08b0e781dbcb96`, déploiement `appgdep_6aa0567545c08191b840eed244589925`, statut succeeded. Même URL et audience. Le miroir GitHub conserve ses exclusions de données documentées.

La refonte est une priorité explicite de l'utilisateur. Après sa livraison, reprendre le programme moteur/catalogue sans réintroduire les fonctions secondaires devant la saisie.

Retour : rétablir les trois fichiers applicatifs depuis le parent du commit de cette tranche dans un nouveau commit, puis republier en privé. Ne modifier ni les sauvegardes ni les données pour annuler l'interface.
