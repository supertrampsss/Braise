# Objectif exécutable Braise

## Mandat

Poursuivre le programme des dix évolutions défini dans `docs/program/BRAISE-PLAN.md`, à partir du Site existant `appgprj_6a9f1dfb001081918c9323599f7d8d6b`. Livrer les périmètres complets, préserver les parties, améliorer ensemble UX, DX et AX et conserver une publicité discrète. L'utilisateur a autorisé la planification et la reprise autonome. Ne pas demander de validation des choix d'implémentation courants déjà couverts par ce mandat.

Ce fichier décrit un objectif. Il n'active pas à lui seul une commande `/goal`. La session courante ne dispose ni de cet outil natif ni d'un exécutable Codex local. La reprise programmée est une automatisation distincte, explicitement annoncée.

## Réglages des agents

Préférence utilisateur : ASTRA MAXIMUM pour orchestrer, ASTRA MINIMAL pour douze spécialistes. Réglages disponibles lors de la planification : `gpt-6-astra`, effort `max` pour l'orchestrateur délégué ; `gpt-6-astra`, effort `low` pour les spécialistes. Ces réglages ont été utilisés pour la rédaction du plan.

À chaque reprise, vérifier les capacités exposées. Le plan n'impose pas des réglages inexistants au moteur de la tâche programmée. Si le modèle de l'agent principal ne peut pas être modifié, conserver cet agent comme propriétaire du Site et déléguer la synthèse bornée à l'orchestrateur configuré. Dire les réglages réellement utilisés, sans présenter un texte dans un prompt comme une configuration effective.

Les douze responsabilités sont permanentes ; solliciter seulement les spécialistes nécessaires à la tranche courante. Respecter la concurrence disponible. Aucun sous-agent n'écrit dans le checkout, ne publie ou ne crée d'autres agents lorsque les instructions Sites l'interdisent.

## Reprise, dans cet ordre

1. Obtenir le Site existant par son identifiant exact, lire ses instructions et retrouver le dépôt source associé. Ne jamais créer un nouveau Site pour reprendre.
2. Réutiliser le checkout `/workspace/sites/braise` s'il correspond à cette identité. Sinon cloner le dépôt retourné par Sites dans un répertoire vide avec son mécanisme d'authentification temporaire. Aucun secret dans les fichiers, remotes ou journaux.
3. Lire `AGENTS.md`, `docs/program/BRAISE-PLAN.md`, `docs/program/EXECUTION.json` et le dernier checkpoint. Vérifier l'état local et distant avant toute mutation ; préserver les modifications utilisateur et ne jamais forcer une réécriture.
4. Vérifier qu'une autre reprise n'est pas déjà en cours. Acquérir un bail dans l'état distant du même objectif, avec propriétaire et expiration, par commit puis push normal fondé sur le HEAD lu. Commencer le code seulement après la réussite de ce push. Si un concurrent a poussé, relire l'état et céder si le bail lui appartient ; aucun push forcé. Ne pas écraser un travail actif. Réconcilier un bail ancien avec l'état réel plutôt que le déclarer libre automatiquement.
5. Choisir le prochain lot dont les dépendances sont vérifiées. Découper au besoin une tranche bornée ayant une sortie utilisable. Ne pas relancer tout le programme ni demander douze agents sans travaux indépendants utiles.
6. Réaliser cette tranche, vérifier les risques concrets, corriger les échecs, puis enregistrer les preuves. Une maquette, un bouton mort ou un résultat simulé ne clôture pas une fonctionnalité.
7. Pour le code, appliquer les tests pertinents et les gates de `AGENTS.md`. Les tests navigateur suivent les conditions explicites des skills ; aucune nouvelle autorisation ne se déduit de ce fichier. Enregistrer toute vérification non réalisée.
8. Mettre à jour état, checkpoint, blocages, prochaine action et références du code testé. Committer puis pousser le changement exact avec l'identité source existante. Attendre la réussite du push. Le seul fait d'écrire un fichier local ne garantit pas la reprise durable.
9. Publier uniquement les jalons complets prévus, dans l'audience déjà autorisée, via les outils Sites et le commit exact. Une modification documentaire ou une tranche incomplète ne déclenche pas une publication. Conserver l'URL précédente tant que le statut de la nouvelle publication n'est pas confirmé.
10. Donner un compte rendu concis des réalisations, vérifications et éventuels blocages. Préserver la prochaine action, puis libérer le bail.

## Arrêt et blocages

- Séparer `implementation`, `automated_checks`, `browser_validation` et `publication`. Un contrôle navigateur non demandé ou non exécuté ne devient jamais un succès implicite.
- `verified` exige les contrôles autorisés et preuves ; `published` exige en plus une publication confirmée. `blocked` n'est jamais un synonyme de `done`.
- Si un lot est bloqué, noter sa cause précise et continuer les autres lots indépendants.
- Une indisponibilité de régie, de domaine ou de partenaire ne bloque pas le moteur, les modes de jeu ou l'adaptateur publicitaire inactif.
- Si plus aucun travail autorisé et exécutable n'est disponible, suspendre l'automatisation et signaler une seule fois l'action externe nécessaire. Ne pas multiplier les rappels ou les requêtes d'approbation identiques.
- Après deux exécutions consécutives sans progrès pour la même cause, suspendre et rapporter les preuves, même si une erreur semble temporaire.
- Lorsque B0 à B11 sont implémentés, les contrôles autorisés passés et la publication privée attendue confirmée, marquer le programme principal terminé. Employer `completed_with_validation_pending` si des validations d'usage restent non réalisées, et les énumérer explicitement. Conserver séparément C1 (activation commerciale) et C2 (extensions conditionnelles), avec leur statut exact. Suspendre la reprise ; ne pas déclarer les publicités actives ou l'accès public si ce n'est pas le cas.
- Un arrêt demandé par l'utilisateur prévaut immédiatement : enregistrer l'état et désactiver les reprises futures.

## Preuves minimales d'un checkpoint

Identité du lot et de la tranche ; versions contrat/règles/corpus/sauvegarde ; état avant/après ; fichiers modifiés ; commandes réalisées et résultats ; commit du code vérifié ; publication éventuelle ; anomalies ; procédure de retour ; prochaine action explicite.

Un checkpoint qui contient le hash d'un commit pointe vers le code qu'il a vérifié, pas vers son propre commit contenant ce checkpoint. Le commit de checkpoint est constaté par Git à la reprise, ce qui évite un identifiant autoréférent impossible.

## Conditions commerciales réelles

Ne pas acheter un domaine, inscrire des coordonnées, accepter un contrat, utiliser une identité d'éditeur ou activer des traceurs avec des valeurs inventées. Préparer intégralement les éléments techniques autorisés. Toute action demandant des informations ou une capacité effectivement absente reste identifiée comme telle, sans contourner les contrôles d'accès.

Les critères d'audience et d'approbation définis dans les outils et instructions de l'environnement prévalent. La version de référence est privée ; les objectifs commerciaux ne changent pas implicitement son audience.
