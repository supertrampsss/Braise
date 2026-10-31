# Sortie d'OpenAI Sites

Décision du 31 octobre 2026 : le propriétaire veut héberger BRAIZ hors de Sites et déployer depuis GitHub. La version 61, source `c280af6a197197d668a5336e96d6ae22c25f8601`, est une publication transitoire demandée explicitement. Le Site existant reste disponible. La migration n'est pas réalisée et un push sur main ne déploie pas encore braiz.io.

## Destination proposée et accès

Cloudflare Workers dans le compte du propriétaire convient à l'architecture actuelle Vinext, avec D1 `DB`, R2 `SEMANTIC_DATA` et les assets. [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) peut relier GitHub et déployer les changements de main. Aucun service payant ne doit être acheté implicitement.

L'authentification Cloudflare locale était absente au dernier contrôle. Il faut connecter le compte cible, autoriser le dépôt Braise, disposer de la gestion DNS de braiz.io et obtenir un export complet des données actuellement gérées par Sites. Les droits Sites ne prouvent pas un accès direct à son compte Cloudflare. Les outils disponibles de lecture bornée des tables ne constituent pas à eux seuls un export cohérent et exhaustif.

## Préparation puis bascule

1. Configurer le Worker du propriétaire et ses vraies ressources D1/R2. `vite.config.ts` contient actuellement une base de substitution de développement ; ne pas la traiter comme la base de production. Garder le déploiement cible isolé tant que la migration n'est pas validée.
2. Exporter de façon sécurisée la D1 complète, notamment identités, sessions, duels, cercles et copies synchronisées. Préserver les identifiants et contraintes. Prévoir un mécanisme d'export sécurisé si aucun export natif complet n'est disponible. Ne jamais committer les données des joueurs ni les secrets dans GitHub.
3. Transférer les objets historiques R2 et contrôler leurs clés et empreintes. Les colonnes Word2Vec versionnées dans GitHub sont distinctes de ce stockage. Copier les secrets nécessaires par le canal du compte cible, sans les inclure dans les sources.
4. Vérifier sur la cible les API, rangs, anciennes parties, sessions et duels, synchronisations et sauvegardes. La sécurité autorise braiz.io ; une origine de recette doit être prévue explicitement, sans ouvrir les origines à tous les domaines.
5. Préparer le transfert final des écritures et un retour arrière. Éviter deux bases acceptant des écritures divergentes pendant la transition. Bascule DNS uniquement après contrôle du transfert cohérent.
6. Garder braiz.io : l'origine navigateur des sauvegardes et du cookie reste la même. Conserver aussi les sessions en base pour maintenir les accès aux duels. Vérifier la nouvelle production, puis activer la chaîne GitHub du propriétaire et mettre à jour l'automatisation.

Référence : [import et export D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/). Le choix de Cloudflare est une proposition fondée sur les bindings existants ; aucune ressource cible, export ou bascule ne doit être déclaré réalisé avant preuve.

## Règle pendant la transition

Les corrections vérifiées sont committées et poussées sur GitHub main. `node scripts/verify-github-source.mjs` vérifie l'alignement du commit. Elles restent non déployées jusqu'à disponibilité de la nouvelle chaîne. Une nouvelle publication Sites exige une demande explicite du propriétaire et suit alors [la procédure de source exacte](SOURCE-OF-TRUTH.md). Ne supprimer ni le Site ni ses données pendant la préparation.
