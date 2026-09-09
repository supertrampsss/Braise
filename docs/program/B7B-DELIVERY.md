# B7b : qualification D1 privée des cercles et duels

La tranche a exécuté les parcours sociaux contre le vrai Site privé v7 et son D1. Trois identités QA isolées ont été utilisées. Les jetons de session, invitations et autorisations Sites sont restés en mémoire et ne figurent ni dans les fichiers ni dans la sortie de la commande.

## Résultat fonctionnel

- Cercle créé par son propriétaire, inaccessible à un tiers.
- Invitation rejointe deux fois avec un résultat identique.
- Même défi hebdomadaire obtenu par le propriétaire et le membre.
- Entrée de partie idempotente et proposition réelle `maison` enregistrée avec son rang.
- Résultat visible au propriétaire, puis accès au cercle, à la partie générique et aux mutations refusé après exclusion.
- Invitations révoquées et nouvelle adhésion refusée.
- Duel créé, accepté une seule fois par l'adversaire attendu et refusé au tiers.
- Proposition réelle, rejouement identique et collision de révision contrôlés.
- Aucun mot de l'hôte ni aucune cible dans la projection ouverte de l'adversaire.
- Abandon explicite conservé, décisions factuelles produites et nouvelle proposition refusée après clôture.

Les 39 invocations Worker observées couvrent toute la séquence fonctionnelle. Les tables D1 confirment une invitation de cercle révoquée, un membre exclu, une proposition de cercle, deux propositions de duel dans deux manches et le duel terminal avec l'adversaire comme abandonnant.

## Nettoyage et limite exacte

La commande a révoqué une session QA. La connexion d'exécution a ensuite été interrompue pendant le nettoyage final, après toutes les assertions fonctionnelles. Les deux jetons restants n'ont jamais été persistés et sont donc inaccessibles ; leurs sessions opaques expireront automatiquement sous trente jours. Les lignes métier QA restent volontairement identifiables, car aucune route de suppression n'existe.

Le harnais a été durci pour les reprises : les identités sont créées séquentiellement afin qu'aucune session ne puisse échapper au nettoyage, puis le tiers est révoqué avant les évaluations sémantiques plus lentes. Le membre et le propriétaire sont révoqués dès la fin des assertions métier. Le quota de création partagé interdit un nouveau passage immédiat sans attendre sa fenêtre normale ; cet incident transitoire ne justifie ni simulation ni désactivation du programme.

## Vérifications

- 157 tests réussis.
- TypeScript réussi.
- ESLint ciblé réussi.
- Construction de production Sites réussie.
- Aucun test navigateur demandé ou déclaré.
- Aucun déploiement : la tranche ajoute une commande de qualification et ses preuves, sans modifier le produit publié.

## Suite

Rejouer une fois le harnais durci après renouvellement du quota afin de confirmer les trois révocations, puis qualifier le studio B9 sur le même D1 privé. Restaurer ensuite le corpus local contrôlé et reprendre les rotations B2.
