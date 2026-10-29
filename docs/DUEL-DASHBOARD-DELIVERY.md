# Duels : invitations et historique

Livraison du 29 octobre 2026. Les règles, scores, limites et conditions de révélation des mots restent ceux du moteur existant.

## Invitations

Le propriétaire d’une invitation encore valable peut choisir « Créer un nouveau lien » après fermeture de l’onglet. « Remplacer le lien » permet aussi ce changement depuis une invitation dont le lien est encore disponible. L’interface annonce avant l’action que l’ancien lien sera invalidé. Aucun lien n’est envoyé automatiquement.

Le serveur conserve uniquement l’empreinte SHA-256 du secret aléatoire de 256 bits. La version courante est communiquée au propriétaire authentifié pour une comparaison atomique. Le remplacement exige la session active, son CSRF, une origine autorisée, la version attendue, une invitation non acceptée et non expirée. Une réponse réseau incertaine conserve le même secret pour réessayer ; un ancien essai ne peut pas rétablir un lien remplacé depuis. Les revanches adressées conservent leur acceptation existante.

La date d’expiration initiale reste inchangée. Après remplacement, le propriétaire doit transmettre le nouveau lien. Le lien conservé dans l’onglet est contrôlé contre la version serveur avant affichage, pour ne pas proposer un lien remplacé sur un autre appareil.

## Historique

- **À jouer** : manches personnelles encore jouables et revanches adressées à accepter.
- **En attente** : invitations envoyées valables et duels dont les trois manches personnelles sont closes, dans l’attente de l’adversaire.
- **Terminés** : duels clos, abandonnés, expirés ou invitations annulées accessibles à cette identité.

L’API renvoie 50 résultats au maximum et un curseur pour la suite, avec un ordre stable par date de création puis identifiant. Les insertions récentes ne décalent pas les pages anciennes. Chaque page reste filtrée par l’identité authentifiée ; le curseur ne confère aucun droit d’accès. Une actualisation recharge les pages déjà demandées. Changer de liste conserve le duel ouvert et le mot en cours de saisie.

`GET /api/duels?group=play|waiting|finished|all&cursor=…` renvoie `duels`, `counts` et `nextCursor`. Le groupe absent conserve la liste générale. `POST /api/duels` avec `action: renew-invitation`, `id`, `previousVersion` et `token` remplace explicitement un lien. Aucune migration de base n’est nécessaire pour ces changements.

## Saisie et mesure

Un mot inconnu contenant `œ` peut recevoir une proposition en `oe`, uniquement si cette variante existe dans le dictionnaire du duel. « Utiliser » remplit le champ sans soumettre le mot ni consommer un essai. Aucun score n’est envoyé pour la proposition. La suggestion disparaît si le joueur a déjà saisi autre chose.

Les événements duels sont enregistrés après confirmation des actions, sans mot, rang, identifiant de duel ni lien. Le transport distant reste soumis au consentement du module de mesure commun. `duelCompleted` correspond ici à une soumission confirmée qui clôt le duel ; les ouvertures historiques, synchronisations, expirations et abandons ne produisent pas cet événement.

## Vérifications

38 tests ciblés passent : `duel-dashboard`, `duel-dashboard-ui`, `duel-complete`, `duel-http`, `duel-live`, `duel-components` et `duel-presentation`.

Les nouveaux tests couvrent les accès propriétaire/tiers, CSRF et origine, session révoquée, expiration et acceptation, répétition après réponse perdue, remplacement concurrent, pagination de 110 duels et insertion entre pages, catégories, maintien de la saisie, lien périmé conservé dans l’onglet et proposition orthographique avec les données Word2Vec réelles.

La recette visuelle sur appareils réels et le contrôle de production restent au lot de livraison global. Cette livraison n’effectue aucune publication.
