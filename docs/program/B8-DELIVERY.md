# B8 : laboratoire personnel

Deux variantes jouables, avec historiques séparés du classique :

- L’intrus : vingt quatuors versionnés, un choix par énigme, explication après réponse. Les solutions ne sont pas dans le GET initial. Revue éditoriale par agent, aucun panel humain revendiqué.
- Deux braises : douze paires immuables. Chaque proposition reçoit les deux évaluations V1 réelles indépendantes. Une découverte reste acquise et la fin exige les deux mots. Aucun indice ou score combiné.

Les historiques sont explicitement personnels, locaux et exclus de l’export du profil classique. Aucun gain, classement ou fait social vérifié n’est ajouté. Les écritures passent par le module de stockage de progression. Les propositions Deux braises sont append-only et dédupliquées, avec conservation des entrées corrompues lors d’une réparation. Les tentatives Intrus retiennent une réponse canonique et la restituent avec l’explication du serveur.

Les erreurs réseau conservent la saisie ; les sélecteurs sont bloqués durant la soumission. La reprise ne rejoue aucun effet de victoire. Les échecs de stockage sont affichés et les essais Deux braises restent en mémoire pendant les changements de paire.

Contrats : intrus-v1, deux-braises-v1, fr-fasttext-30000-v1. Aucun changement du corpus ni des sauvegardes classiques. Les versions de contenu doivent rester immuables après publication.

Vérifications finales : suite de 121 tests, TypeScript et build réussis après réparation de clé corrompue. Relectures Astra low indépendantes : problèmes identifiés corrigés. Tests navigateur et panel réel non demandés/non réalisés. La chaîne généralisée reste C2, non implémentée.

Retour : version privée précédente conservée ; retirer les liens ne supprime pas les historiques locaux. Publication documentée séparément après statut Sites confirmé.
