# Task7B2 — checkpoint transport R2 borné (13 octobre 2026)

Le transport et la sonde sont préparés pour revue indépendante, sans activation du produit. Le corpus courant et les journées V1 restent inchangés. La qualification hébergée appartient au contrôleur et reste à réaliser après revue.

## Identités et paquet réel

- Corpus : `fr-fasttext-complete-bc68b0703375-0f34b2449278`, 1 013 881 mots, 300 dimensions.
- Manifest corpus : `e1c07accdc55196c180968d710030e938b861bd7b6c7bf2c0f764e030f365cf7`.
- Manifest présence : `77178f6fc85de9d5523db3f13141b751abdeb1c6b2d3ad6a4d020346a795c426`.
- Racine transport : `49f548a439d8034ceeee1d553c00ddaf42c52f0802afae201963e131bb587f70`, 45 316 octets.
- Pinset sonde : `d24043ff12595c6ee40ec011c23a20937697d0eccb2249e8776d0a0714fedceb`.
- Cible91 : manifest `ee333e66d388b407487e931a1ac38555ced5e2e183b4e0c882a036f1f7a3b155`, paquet `6adf8582b4c36c02e6fd0075031c130d31702bd8aae5dfb56949374f18d30786`, **7 338 496 octets**, 35 objets canoniques comparés octet par octet à l'archive déjà vérifiée indépendamment.

Le TAR présence entier (89 526 784 octets / 65 794 objets) et ses 11 blocs existants ont été rehashés lors de l'indexation. Aucun nouveau transfert présence/source/corpus. Les 260 shards réels sont tous validés : 65 829 objets, plus grand shard56 172 octets, deux fichiers chevauchant une frontière de bloc. La racine et chaque shard restent sous256KiB. Les 262 nouveaux blobs métadonnées+cible91 totalisent21 689 152 octets ; ils se trouvent dans `work/qualification/range-pack-checkpoint`, inventaire de transfert `work/qualification/range-pack-upload-inventory.json`.

## Contrat

`scripts/build-semantic-range-pack-v2.mjs options.json` produit des blobs immuables SHA. Options : corpusDir, presenceTar, presenceInventoryPath, archiveDir, targetIds, outputDir. Exemple exact local : `work/qualification/range-pack-options.json`. Il rehash les blocs/TAR, n'accepte que le sous-ensemble USTAR régulier/répertoire, rejette liens/PAX/chemins ambigus/doublons, vérifie le corpus présence, revalide les inventaires cible avant et après et refuse tout paquet cible≥8MiB. Il ne crée aucune attestation numérique ni activation.

L'adaptateur Worker ne parse jamais le TAR. Il lit uniquement `semantic-blobs/sha256/<hash>`, contrôle les SHA racine/shard, les tailles totales et métadonnées exactes des plages, reconstruit au plus deux plages contiguës et vérifie le SHA du fichier logique complet. Puis le reader existant contrôle à nouveau ses pins, formats/gzip/pages/valeurs. Taille R2 `size` = taille totale de l'objet, même lors d'une plage : [API Workers officielle](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).

Sonde : `POST /api/semantic-runtime-qualification`, corps exact `{ "caseId": "…" }`, un seul cas d'une liste compilée. Les variables temporaires `BRAIZ_TRANSFER_TOKEN`, `BRAIZ_TRANSFER_EXPIRES`, `BRAIZ_RUNTIME_QUALIFICATION_PIN` exact et binding `SEMANTIC_DATA` sont nécessaires ; défaut404. Aucun token en URL, mot/ID/chemin client, session élargie, date contournée ou fallbackV1. Authentification SHA de longueur constante partagée avec le transfert ; entrées bornées. Délai30s incluant le corps, corps≤256octets, ≤16 appels R2 et≤8MiB reçus. Annulation du corps et des lectures, annulation des objets reçus après expiration. Une corruption de lecture autorisée n'écrit jamais dans R2.

Réponse : caseId/pass/pinset/resultSha256/reads/bytes seulement ; les erreurs ne révèlent ni chemins ni données. `reads` et `bytes` sont des mesures réelles. Les caches et budgets sont des limites de conception, pas une mesure RSS.

Cas compilés : common-presence, accent-presence, rare-presence, absent-presence, exact-score, related-score, rare-score, crossed-range, wrong-pin, corrupt-range. Les trois résultats numériques attendus sont fixés à partir de l'identité cible et du BEE indépendant de91 (états score4324/r27 ; baspays6009/r2), pas calculés depuis le résultat du nouveau transport. Les deux cas négatifs exigent l'erreur d'intégrité précise ; une simple indisponibilité n'est pas un succès.

## Qualification locale et limites

`task7b2-range-real-local-results.json` : 10/10 cas, transport fichiers locaux simulant les lectures R2 réelles, 3–7 appels / 102277–455328octets par cas. Le cas crossed-range lit réellement deux blocs. Ce n'est pas une preuve d'exécution hébergée. `task7b2-range-pack-inspection.json` contient la comparaison de tous les objets cible et validation de toutes les métadonnées/plages. Aucun recalcul numérique de la cible91 n'a été répété.

Construction du paquet observée15 429ms sur cet hôte partagé avec le job numérique du contrôleur ; mesure descriptive unique, pas benchmark généralisé. Aucun calcul de consommation mémoire réelle revendiqué.

Suite ciblée finale :33 tests,33 réussis,0 échec/skip (~1,36s). Couverture : plages croisées, SHA, métadonnées taille totale/offset/longueur, troncature/surplus/absence, chemins/doublons/liens/PAX/TAR, quota4 du loader, conservation d'archive, auth fermée, mauvais pinset, corps et cas fermés, compteurs, limites réseau, annulation flux/pending GET/objet tardif/cancel bloqué. Typecheck0 ; lint0 erreurs/4 avertissements préexistants ; build vérifié final0 (route privée incluse et assetsV1 vérifiés). Les tests complets du produit restent au lot8B.

Les neuf dépendances du job numérique restent identiques aux SHA gelés. Aucune archive/e7/staging/data catalogue modifiée. Le nouveau pinset est uniquement un jeu fermé de qualification, jamais un calendrier activé. Les400 décisions,365 jours, interfaces futures et qualification Worker/R2 complète restent dans7B2.
