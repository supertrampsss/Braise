# BRAIZ

Jeu web français de proximité sémantique, accessible directement sur [braiz.io](https://braiz.io). Le joueur cherche un mot secret ; chaque proposition reçoit son classement réel dans le corpus.

Le dépôt de référence est [supertrampsss/Braise](https://github.com/supertrampsss/Braise), branche `main`. Il contient le code courant, les données de jeu distribuées, les tests et l'historique complet importé de Sites. OpenAI Sites reste l'hébergeur du site existant. Procédure : [sources et publication](docs/SOURCE-OF-TRUTH.md).

Consolidation des sources au 31 octobre 2026, à partir de la version de production 60. L'état d'un compte externe ou d'un déploiement se vérifie séparément.

## Parcours actuels

La navigation principale tient dans un burger : Mot du jour, Partie libre, Archives, Duel, Profil et Règles.

- Le quotidien change à minuit à Paris. Les archives reprennent une date passée dans son édition d'origine.
- La partie libre utilise une graine reproductible. La flamme et la jauge suivent le meilleur classement ; le pourcentage est leur remplissage visuel.
- Les plateaux classiques courants proposent au plus trois indices : un mot réellement mieux classé, choisi en fonction du meilleur essai.
- Le duel oppose deux personnes sur trois mots, avec 30 essais par manche, sans indice, dans les 48 heures après acceptation. Les solutions et essais adverses se dévoilent une fois les recherches correspondantes closes.
- Le profil conserve la progression et propose une sauvegarde locale complète. L'accès aux duels et la synchronisation serveur passent par l'identité de l'appareil.

Les routes avancées restent activées par `lib/release.ts` : entraînement, laboratoire, cercles, studio et intégration. Elles ne sont pas toutes présentes dans la navigation principale.

## Moteur courant et compatibilité

Les nouvelles éditions classiques utilisent Word2Vec depuis le 13 octobre 2026 : **155 562 entrées source, 500 dimensions et 475 cibles**. Les scores proviennent du cosinus des vecteurs ; aucun voisin ajouté ni score de remplacement ne corrige les associations du modèle.

Les quotidiens choisissent parmi les 475 cibles. Les graines libres conservent les 120 emplacements historiques, évalués dans le corpus Word2Vec complet. La sélection ne garantit pas l'absence de répétition.

Les objets BWS2 sont servis par le binding `ASSETS`, vérifiés avant lecture et chargés côté serveur. Un mot absent est refusé sans essai ajouté. Une suggestion orthographique explicite peut être proposée après vérification ; le joueur doit la choisir puis l'envoyer.

Les lecteurs `classic-v1` et `classic-v2`, leurs données et leurs identités restent disponibles pour les anciennes parties. Une reprise ne convertit jamais leurs scores en Word2Vec. Contrat, reconstruction et licences : [Word2Vec](docs/WORD2VEC.md), [données historiques](docs/DATA-LICENSE.md).

## Développement

Node.js 22.13 ou supérieur. Le lockfile npm fait référence ; les scripts Node gèrent Windows et Linux.

| Commande | Usage |
| --- | --- |
| `npm run install:ci` | Installer les dépendances figées |
| `npm run dev` | Démarrer le développement |
| `npm run typecheck` | Vérifier TypeScript |
| `npm test` | Exécuter les tests du projet |
| `npm run check` | TypeScript puis tests |
| `npm run lint` | Contrôler le code avec ESLint |
| `npm run build` | Vérifier les segments historiques puis construire le Site |
| `npm run start` | Démarrer via le lanceur du projet |
| `npm run db:generate` | Générer les migrations Drizzle |
| `node scripts/audit-code-usage.mjs` | Inventorier les imports et candidats inutilisés, sans suppression |

React, TypeScript et Vinext utilisent les conventions App Router et Cloudflare Workers. La configuration [Sites](.openai/hosting.json) conserve l'identité du projet, D1 `DB` et R2 `SEMANTIC_DATA`. Les assets sont servis par `ASSETS`. Réutiliser cette identité et le commit source exact pour chaque publication.

## Données, mesure et publicité

Le profil et les parties classiques sont sauvegardés localement. La sauvegarde portable inclut les parties en cours et terminées ; l'ancien export de profil reste distinct. Chaque import affiche un aperçu, exige une confirmation et refuse les conflits. Les secrets d'accès aux duels sont exclus du fichier.

La synchronisation serveur existe via D1. Les lecteurs historiques et les faits de progression sont conservés sans crédit supplémentaire à la restauration.

Le diagnostic reste local par défaut. La mesure produit de première partie exige un consentement explicite ; elle n'envoie ni mots, ni solutions, ni classements, ni identifiants de duel. Son tableau opérateur requiert un jeton autorisé et non expiré.

La diffusion publicitaire est inactive : `AD_RUNTIME_CONFIG = null`. L'adaptateur existe, mais la validation du compte, les emplacements réels et l'intégration du consentement restent des prérequis distincts. Voir [l'état AdSense](docs/ADSENSE-READINESS.md).

## Documentation

- [Architecture actuelle et invariants](docs/ARCHITECTURE.md)
- [Duels : invitations, listes et pagination](docs/DUEL-DASHBOARD-DELIVERY.md)
- [Sauvegarde portable et synchronisation](docs/PORTABLE-BACKUP-DELIVERY.md)
- [Revue éditoriale du catalogue](docs/EDITORIAL-QUALITY.md)
- [Nettoyage du code et preuves de suppression](docs/CODE-CLEANUP.md)
- [Registre de revue et points encore ouverts](docs/CONTINUOUS-REVIEW.md)
- [Programme historique B0 à B10](docs/program/BRAISE-PLAN.md), [baseline V1](docs/program/BASELINE.json) et [pipeline V2](docs/program/B1E-DELIVERY.md)

Les documents du programme conservent les décisions et mesures de leur date. Ils ne décrivent pas à eux seuls la version actuelle. Les commandes `semantic:v2:*` restent des outils de reconstruction, de preuve et de staging ; elles ne remplacent pas automatiquement le moteur courant.
