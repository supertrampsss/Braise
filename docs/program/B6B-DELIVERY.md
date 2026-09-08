# B6b : révocation et création protégée

Déconnexion explicite de l’appareil, contrôlée par origine et CSRF. La session est révoquée côté serveur avant expiration du cookie. Les parties ne sont pas supprimées. L’interface demande une confirmation et explique l’absence actuelle de récupération.

La création de partie utilise désormais une instruction SQL conditionnée à la validité de la session au moment de l’écriture. Une session expirée ou révoquée ne peut pas créer de partie après une authentification antérieure. La répétition d’une création conserve la cible initiale.

Contrôles : 126 tests, TypeScript et build réussis ; cinq tests ciblés repassés après ajout du cas d’expiration. Aucun test navigateur, aucune publication, aucune qualification D1 distante. La version privée 3 reste inchangée.

La récupération d’accès reste à implémenter, puis D1 et les routes hébergées doivent être qualifiés avant activation de cet espace. Aucun statut de completion B6 n’est revendiqué. Retour : code précédent, sans suppression des parties.
