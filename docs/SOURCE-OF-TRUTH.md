# Sources et publication BRAIZ

Décision du 31 octobre 2026 : [supertrampsss/Braise](https://github.com/supertrampsss/Braise), branche `main`, est le dépôt de référence.

## Pourquoi les dépôts différaient

Les publications Sites utilisaient leur dépôt technique propre. Le transfert GitHub initial avait été limité à un instantané, sans certaines données de jeu ni l'historique d'origine ; les publications suivantes n'avaient pas été synchronisées. La production fonctionnait donc avec un code plus récent que GitHub.

La consolidation réunit les deux historiques. Le code et les données de production proviennent exactement du commit `f72792f2f324f64037d63e6781d043f67f102c94`, version 60. Les contributions GitHub des PR 1 et 2 restent dans `docs/braiz-refonte/`. Leur prototype est un document de travail ; la consolidation ne l'active pas dans le jeu et ne remplace pas les choix produit courants.

## Publier une modification

1. Récupérer `main` depuis GitHub et partir de son état courant. Conserver les contributions apparues entre-temps.
2. Modifier, puis exécuter les contrôles adaptés et la construction. Conserver les parties, lecteurs et rangs historiques.
3. Committer et pousser dans GitHub. Si une branche de travail est utilisée, l'intégrer dans `main` selon les règles du dépôt.
4. Se placer sur le commit final de `main`, avec un arbre propre, et exécuter `node scripts/verify-github-source.mjs`.
5. Fournir ce même commit au dépôt technique Sites, puis enregistrer et publier sur le projet existant identifié dans `.openai/hosting.json`. Tout nouveau commit produit pendant la préparation doit d'abord être envoyé dans GitHub et revérifié. Ne pas publier une source présente seulement chez Sites.
6. Consigner le commit GitHub, la version et le résultat réel du déploiement. Une source synchronisée n'est pas à elle seule une preuve de publication.

L'origine GitHub peut être utilisée explicitement si un outil de publication gère temporairement les remotes : `https://github.com/supertrampsss/Braise.git`. Ne jamais mettre un jeton dans l'URL, un fichier versionné ou un journal.

## Hébergement et données

Le domaine `braiz.io`, le Worker Sites existant et ses bindings D1/R2 sont conservés. Une migration d'hébergement constituerait une opération distincte avec transfert des données et des secrets. Aucune base de joueurs, session ou clé privée n'est à publier dans GitHub.

Les assets requis par la construction sont versionnés. Les modèles externes destinés à la reconstruction, le staging, les dépendances et les archives de compilation restent séparés. [Inventaire et reconstruction](../GITHUB-DATA-ASSETS.md).
