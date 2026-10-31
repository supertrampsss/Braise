# Sources et données dans GitHub

Depuis la consolidation du 31 octobre 2026, `supertrampsss/Braise`, branche `main`, contient la source de production 60 et son historique Sites, ainsi que les contributions GitHub existantes. L'ancien instantané incomplet est remplacé sans effacer son historique.

Les fichiers auparavant absents sont inclus :

- `data/semantic-fr.json`, source V1 figée ;
- `public/semantic/fr-fasttext-30000-v1/source.json` et les 120 segments `.brz` ;
- le manifeste et les 475 colonnes Word2Vec BWS2 actuelles ;
- les sources, ressources, tests, migrations et lecteurs historiques.

L'empreinte de la source V1 reste `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`. Le commit historique `85b05a71cba67b3283e1a19a1745d2d90570bcd2` est conservé. Aucun score n'a été régénéré pour cette consolidation.

Un clone complet possède désormais les sources et assets requis par `npm run build`. Installer d'abord les dépendances avec `npm run install:ci`. Les outils d'oracle et certains tests utilisent l'historique Git : conserver un clone complet plutôt qu'un clone superficiel.

Les gros modèles externes utilisés uniquement pour reconstruire les corpus restent téléchargeables et vérifiables selon [WORD2VEC.md](docs/WORD2VEC.md) et les procédures historiques. Le staging local de calcul, les dépendances installées et les sorties de compilation ne sont pas versionnés.

La base D1 de production, les objets historiques R2 et les secrets d'exécution restent chez l'hébergeur. GitHub contient leurs schémas et le code qui les utilise, pas les identités ou parties privées des joueurs. La consolidation du dépôt ne déplace pas ces données et ne modifie pas le domaine.

Voir [la procédure de publication](docs/SOURCE-OF-TRUTH.md). Les notes antérieures décrivant GitHub comme un miroir incomplet sont des constats historiques.
