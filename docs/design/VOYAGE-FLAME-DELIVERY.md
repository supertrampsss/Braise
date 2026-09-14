# Voyage, flamme et finition · 14 septembre 2026

## Changements

- Retrait des deux phrases demandées. Boutons Envoyer et Indice, avec libellés accessibles cohérents.
- Voyage garde son chapitre et l’étape en cours dans le jeu. La réussite poursuit le même chapitre. L’URL conserve le contexte lors d’une actualisation. Le chargement abandonné ne reprend pas la navigation de force. La mémoire courante complète la sauvegarde locale si celle-ci échoue.
- Géométrie de flamme élargie horizontalement de 50 %. Intensité toujours issue de la vraie température. Trois posters produits avec le shader courant remplacent l’ancien visuel de chargement ; la première image WebGL utilise directement la température courante.
- En-tête aligné avec la colonne de jeu, styles de commandes partagés, focus de saisie et apparition du menu harmonisés. DESIGN.md documente la direction Foyer et les références effectivement consultées.

## Vérifications effectuées

- TypeScript : succès.
- Suite existante : 167 tests réussis, dont reprise et preuves d’expédition.
- Construction Sites : succès après les dernières modifications CSS.
- Shader de production compilé sous EGL ; images froid/chaud inspectées. Cette vérification logicielle n’est pas une mesure de performances sur téléphone.
- Aucun test navigateur effectué. L’absence du flash sur Safari et la fidélité finale sur iPhone restent à constater en navigateur.

Le moteur sémantique, le corpus et les réponses d’API restent inchangés. Ce checkpoint ne réactive pas l’ancien programme automatisé. Publication privée à confirmer par le statut de déploiement, indépendamment de la réussite du build.
