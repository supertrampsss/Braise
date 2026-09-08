# Données nécessaires au miroir GitHub

Le dépôt public `supertrampsss/Braise` contient un instantané du code applicatif, des tests, des dossiers éditoriaux et de la documentation de la source Sites `5f349c1f1eaf0dc114bc85cbfa9a4fe3c69e23da`.

**Un clone GitHub seul ne permet pas encore de construire le jeu.** Le transfert des données n'est pas complet. Les éléments suivants n'ont pas été copiés :

- `data/semantic-fr.json`, source V1 figée requise par la construction ;
- `public/semantic/fr-fasttext-30000-v1/source.json`, son export public identique ;
- les 120 fichiers `public/semantic/fr-fasttext-30000-v1/targets/*.brz`.

Le contrôle de publication de cette session a refusé l'envoi des fichiers compressés opaques. Ce n'est pas un rejet émis par le serveur GitHub. Aucun contournement de ce refus n'est autorisé. Les deux grands JSON ont également été exclus du transfert. Les données V1 et l'historique Git d'origine restent conservés dans la source canonique Sites ; le jeu privé existant n'a pas été remplacé.

Pour une construction reproductible, il faut obtenir la source V1 exacte par une voie autorisée et contrôler son SHA-256 : `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`. `npm run build` peut ensuite recréer les fragments et l'export. Le générateur Python ne garantit pas à lui seul des octets identiques ; ne jamais modifier l'empreinte historique pour accepter un résultat différent. La régénération de l'oracle historique exige aussi le commit `85b05a71cba67b3283e1a19a1745d2d90570bcd2`, absent de ce miroir instantané.

Le corpus V2 complet et ses fichiers de calcul locaux ne font pas partie du transfert GitHub et ne sont pas activés sur le Site. Les preuves éditoriales versionnées ne sont pas une copie des colonnes numériques nécessaires au fonctionnement V2.

Version utilisable pour la revue : https://braise-mots.yellow-drake-7186.chatgpt.site (accès privé inchangé).
