# B6c : récupération d’identité

Un invité peut générer un code secret de 256 bits, conservé uniquement sous forme d’empreinte côté serveur. Le code est affiché sur demande et doit être conservé hors du site. Sa rotation invalide l’ancien code.

La rotation se fait en deux phases : préparation, puis confirmation explicite de conservation. Une réponse perdue pendant la préparation n’invalide pas le code actif précédent. La préparation est reprenable avec le même nonce et aucun code périmé ne reste affiché comme valide.

La récupération crée une session, révoque les anciens appareils et consomme le code dans un batch transactionnel. Un jeton éphémère conservé pendant la tentative rend la répétition après perte de réponse idempotente ; un autre jeton ne peut pas réutiliser le code. La rotation exige encore une session active au moment de l’écriture.

La récupération n’utilise aucun courriel fictif, fournisseur externe ni historique local promu comme vérifié. Les anciennes parties serveur restent attachées à la même identité.

Contrôles locaux : 127 tests, TypeScript et build réussis. Cas ciblés : code inconnu, code consommé, répétition identique, anciennes sessions révoquées et refus de rotation depuis une session révoquée. La migration ajoute une table et un index unique sans réécrire les tables existantes.

Publication privée v4 confirmée le 8 septembre 2026 à 08:07 UTC, depuis `4fd4e9b27a16ca1c60041419f6e0172f3ad45394`. La consultation native confirme le binding DB et les cinq tables attendues, dont récupération. Ceci prouve le provisionnement et la présence du schéma, pas les parcours HTTP ni la concurrence hébergée. Aucun test navigateur réalisé. Aucun jeton de contournement créé : son outil exige une demande utilisateur explicite. Les développements indépendants continuent.
