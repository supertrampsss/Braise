# Consolidation intermédiaire du 8 septembre 2026

Mise à jour de livraison : la publication privée v6 et le miroir GitHub sont maintenant confirmés. Voir `RECOVERY-DELIVERY.md` pour la source exacte, les limites du miroir et la restauration du corpus. Le texte ci-dessous conserve l'état historique de v5 ; il ne décrit plus la dernière publication.

La version privée v5 est publiée à 08:35 UTC depuis `0ef63845c7feaf1affc97c0a947bfd7d5603a18a`. 138 tests passent, ainsi que TypeScript et le build. Les régressions de quota, idempotence concurrente, invitation sans identité et remplacement du brouillon lors d’un retrait ont été corrigées. Le site historique et les corpus V1 restent conservés.

Ce n’est pas la fin du programme : le corpus réel complet est en cours d’ingestion, la qualification HTTP authentifiée n’est pas réalisée, aucun test navigateur ni qualification inter-origines n’a été effectué. L’outil de jeton de contournement exige une demande explicite et n’a pas été appelé. Aucune activation publicitaire ou publique.

La source fastText officielle a été téléchargée intégralement : 3 027 096 151 octets, en-tête 1 152 449 lignes et 300 dimensions. Le nombre d’entrées admises et l’empreinte sont à finaliser après vérification exhaustive. Le staging n’est pas activé sur le site.

Retour : conserver les migrations appliquées ; si nécessaire republier une source compatible v4 sans supprimer ni réécrire les tables. Ne jamais enlever les barrières d’accès des nouvelles parties en revenant à une route générique ancienne. Les données personnelles et historiques restent conservées.
