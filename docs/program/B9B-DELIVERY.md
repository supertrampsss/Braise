# B9b : qualification D1 privée du studio

Le studio a été parcouru contre le vrai Site privé v7 et son D1 avec une identité auteur et une identité participante distinctes. Les autorisations Sites, sessions et identifiants sensibles sont restés en mémoire.

## Résultat

- Le catalogue auteur expose cinq titres et des références lisibles, sans graines sémantiques.
- Un brouillon créé par l'auteur reste inaccessible et non modifiable par la participante.
- Une édition publiée est idempotente et conserve ses deux étapes après modification du brouillon source.
- La projection participante expose seulement le titre, la longueur, l'avancement et la partie courante.
- L'entrée dans la première étape est idempotente.
- Une proposition réelle `maison` a été évaluée et conservée avec son rang.
- La participante ne peut pas retirer l'édition : la réponse neutre est contrôlée par une lecture d'état inchangée.
- Le retrait par l'auteur bloque immédiatement la progression, la lecture générique de la partie et les nouvelles propositions.
- Le brouillon révisé reste intact après retrait de son édition précédente.
- Les deux sessions QA du passage réussi ont été révoquées et leur inactivité vérifiée.

Les 28 invocations Worker ont toutes terminé avec un résultat d'exécution normal. D1 confirme le brouillon en révision 1 avec une entrée, l'édition immuable retirée en révision 0 avec deux entrées, une partie liée et une proposition réelle.

Une première tentative courte a détecté avant le parcours qu'un pseudonyme QA dépassait la limite publique de 24 caractères. La seule session alors créée a été révoquée par le nettoyage. Le nom a été raccourci et le passage complet suivant a réussi ; aucune contrainte du produit n'a été contournée.

## Vérifications

- 157 tests réussis.
- TypeScript réussi.
- ESLint ciblé réussi.
- Construction de production Sites réussie.
- Relecture spécialisée Astra sur le protocole.
- Aucun test navigateur demandé ou déclaré.
- Aucun déploiement : le produit publié était déjà le code qualifié ; cette tranche ajoute une commande reproductible et ses preuves.

## Suite

B9 peut être considéré comme qualifié sur l'hébergement privé actuel. La reprise revient au passage B7 durci pour obtenir une clôture avec trois sessions révoquées, puis à la restauration contrôlée du corpus complet et aux rotations B2.
