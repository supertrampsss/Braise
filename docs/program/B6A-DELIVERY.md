# B6a : socle serveur, qualification distante restante

Implémentation locale : identité invitée à pseudonyme, session opaque de 256 bits, jeton haché, cookie Secure/HttpOnly/SameSite et contrôle CSRF lié à la session et à l’origine canonique. Une visite ne crée pas de compte.

Les parties sont privées à leur invité. Le serveur choisit la cible V1 et conserve les essais réels. Une proposition est insérée sous condition de révision, session active, quota et état ouvert ; un trigger applique sa révision et sa victoire dans la même instruction. Les clés uniques couvrent mot, requête et numéro d’essai. Une clé réutilisée avec un autre mot est refusée. La vue de partie lit état et historique dans une seule instruction SQL cohérente.

Créations bornées : 20 par heure et IP au niveau de l’instance, 100 parties par invité et 1 000 invités sur ce premier socle privé. Ces plafonds sont des paramètres techniques, pas des chiffres d’usage. Les tables ont leurs contraintes et l’index du listing réel.

Le trigger `braise_guess_applies_revision` est une partie obligatoire de la migration initiale. Il doit être conservé explicitement lors d’une future reconstruction de table. Le test de migrations vérifie sa présence. Toutes les migrations B6a sont nouvelles et non appliquées à ce checkpoint ; aucun historique distant n’a été réécrit.

Interface `/espace` implémentée, non liée au menu tant que D1 réel n’est pas qualifié. Reprise, liste des dernières parties, saisie conservée sur erreur et idempotence de la nouvelle tentative. Pas de promotion des anciens résultats locaux. Les cercles et duels ne sont pas encore implémentés.

Contrôles locaux : 125 tests réussis, dont sessions expirées/révoquées, isolation propriétaire, requête rejouée, collision d’idempotence, révision concurrente, fermeture après victoire, snapshot cohérent et migrations SQLite. TypeScript et build de production validés. Ces tests utilisent SQLite réel avec un adaptateur D1 de test, pas D1 distant.

Relecture finale gpt-6-astra effort max : aucun bloqueur pour le checkpoint source uniquement ; quatre tests ciblés exécutés par le relecteur. Les qualifications distantes et les fonctions restantes ne sont pas validées implicitement.

Restent : provisionnement et qualification D1 réels, test des routes hébergées, révocation et récupération utilisateur, revue des créations face aux révocations simultanées, puis raccordement des fonctions sociales. Binding DB seulement déclaré dans le source ; aucune publication B6a. Tests navigateur non demandés/non réalisés. Version privée 3 conservée.

Retour : aucune donnée distante nouvelle à supprimer à ce stade. Après application, les migrations sont immuables et le retour de code ne doit jamais supprimer les tables ou résultats.
