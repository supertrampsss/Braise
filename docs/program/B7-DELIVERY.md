# B7 : cercles et duels asynchrones

Cercles privés : création, identité invitée en place sur l’invitation, jeton dans le fragment (pas les requêtes GET), adhésion explicite et idempotente, invitations hachées valables sept jours et limitées à vingt adhésions, révocation, exclusion permanente, défi commun par semaine de Paris et archives effectivement créées. Comparaison des seuls membres autorisés à partir des propositions serveur. Mode sans indice explicite. Limites techniques : cinq cercles par propriétaire, vingt membres, cent parties serveur personnelles et de cercle/studio combinées. Une invitation expirée ou ignorée ne crée aucun résultat.

Les parties de cercle réutilisent le stockage des parties avec une barrière d’adhésion dans toutes les lectures génériques et l’insertion atomique d’essai. Une exclusion ne se contourne pas par `/api/server-games`. Révocation et exclusion ne sont pas soumises au quota de création.

Duels : registre séparé, trois identités de cibles distinctes et immuables, acceptation atomique d’un seul adversaire, 48 heures après acceptation, trente mots distincts par manche et aucun indice. Révision, idempotence et clôture contrôlées lors de l’insertion. Les résultats dérivent des faits, y compris égalités, échéance et abandon explicite. Une revanche crée une invitation distincte. Aucun mot adverse ni cible dans la projection participante. Dix duels réellement actifs ou invitations non expirées maximum ; un duel terminé libère cette capacité.

Contrôles : tests de rejouement concurrent, six manches terminées et quota, échéance exacte, adversaire tiers, secret des réponses, mot gagnant, limite de trente, session révoquée, exclusion et quota commun. Relecture Astra max avec les bloqueurs corrigés. La qualification reste source/SQLite, pas D1 concurrent hébergé et pas navigateur.

V1 demeure inchangé. Le corpus intégral n’est pas supposé chargé. La publication privée et la présence des nouvelles tables seront constatées après déploiement, sans annoncer de vrais joueurs.
