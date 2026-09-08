# B1d, index exact et éviction sûre du staging

## Statut

L'index de présence local et l'éviction coordonnée des cibles BRV2 sont implémentés et vérifiés. Ce lot complète l'outillage local B1b et B1c, sans activer le corpus V2 dans le jeu publié.

## Index de présence BPI2

- sidecar immuable lié au SHA-256 complet du manifeste BRV2 et à l'inventaire sémantique
- conservation exacte de chaque mot canonique et de son identifiant uint32, sans alias désaccentué ou ligature approximative de V1
- routage par deux octets de SHA-256, racine bornée, répertoires de préfixes bornés et feuille gzip bornée
- ordre binaire des octets UTF-8, table d'offsets uint32 et recherche exacte dans une seule feuille
- prise en charge vérifiée d'un mot dépassant 16 000 caractères
- mesure SQLite de la taille d'une feuille avant matérialisation ; une concentration supérieure à 4 Mio est refusée explicitement sans perdre d'entrée
- vérificateur indépendant contrôlant empreintes, en-têtes, ordre, préfixes, unicité et bijection complète mot-identifiant avant activation locale

Commandes :

```sh
npm run semantic:v2:index:build -- --corpus work/semantic-v2 --output work/semantic-targets-v2
npm run semantic:v2:index:verify -- --corpus work/semantic-v2 --output work/semantic-targets-v2
```

## Éviction sûre des cibles

- garde SQLite exclusive pour construction et éviction, partagée pour toute vérification publique
- compatibilité avec le fichier de garde vide laissé par B1c
- vérification exhaustive d'une cible complète avant suppression
- refus des racines, entrées et tombstones symboliques
- intention journalisée, renommage atomique, purge et clôture durable
- tombstone toujours comptée dans le quota tant que les octets subsistent
- identifiant réservé par son journal jusqu'à clôture, même si la purge a déjà eu lieu
- reprise idempotente après interruption juste après le renommage ou juste après la purge
- régénération après éviction reproduisant le manifeste et les pages immuables

Commande :

```sh
npm run semantic:v2:target:evict -- --corpus work/semantic-v2 --output work/semantic-targets-v2 --target-id <id>
```

## Vérifications

- `npm test` : 109 tests réussis, 0 échec
- tests ciblés BPI2 et BRT2 : 13 réussis, 0 échec
- `npm run typecheck` : réussi
- build de production Sites : réussi, avec régénération stable des 120 fragments V1
- ESLint ciblé sur les scripts et tests B1d : réussi
- `git diff --check` : réussi
- relecture gpt-6-astra maximale et trois audits spécialisés : trois chemins de panne corrigés, aucun bloqueur local restant

Le lint global reste non conforme sur huit erreurs préexistantes hors du lot B1d. Elles concernent notamment `components/game.tsx`, `lib/game-types.ts`, une fixture B1b et la copie de référence V1. Elles n'ont pas été modifiées dans ce lot.

## Limites réelles

- la source fastText française complète n'est pas disponible dans cet environnement et n'a pas été ingérée
- aucun nombre d'entrées complet, aucune durée réelle et aucun volume disque réel ne sont revendiqués
- les feuilles utilisent un préfixe SHA-256 de 16 bits ; une concentration supérieure à la limite configurée est refusée avant allocation et demanderait un niveau de pagination supplémentaire
- R2 n'est ni provisionné ni qualifié, et le lecteur Worker BPI2 n'est pas activé
- la mémoire et la latence Worker au volume complet restent à mesurer
- le moteur V1 publié reste inchangé avec 30 000 mots, 120 cibles et 3 600 000 scores réels
- aucun test navigateur n'a été demandé ou exécuté
- aucune nouvelle version du Site n'a été enregistrée ou publiée pour ce lot de staging

## Retour arrière

Annuler les scripts, tests et documents B1d dans un nouveau commit. Ne jamais supprimer manuellement une tombstone ou un journal en cours. V1, les sauvegardes, les fragments publiés et la version privée 2 restent inchangés.

## Prochaine action

Obtenir la source française complète autorisée, exécuter B1b, BPI2 et B1c sur son volume réel, enregistrer les mesures exactes, puis provisionner et qualifier R2 ainsi que le lecteur Worker avant toute activation produit.
