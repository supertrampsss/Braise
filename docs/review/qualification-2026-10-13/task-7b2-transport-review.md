# Task7B2 — revue du checkpoint transport

## Spec Compliance

- ❌ **Écart trouvé : délai maximal non garanti en cas d’annulation R2 bloquée** (`lib/semantic-v2-range-r2.ts:18`, `lib/semantic-v2-bounded-r2.ts:44`). Le ruling impose une sonde bornée, y compris lors d’une erreur ou d’une annulation. Voir I1.
- ✅ Le reste du périmètre inspecté respecte le checkpoint : liste compilée fermée, authentification temporaire, index de positions pinné, contrôles des plages et SHA des fichiers complets, construction hors Worker et absence d’activation du produit (`app/api/semantic-runtime-qualification/route.ts:6`, `lib/semantic-runtime-qualification.ts:29`, `lib/semantic-v2-range-r2.ts:73`, `scripts/build-semantic-range-pack-v2.mjs:85`).
- ⚠️ La preuve R2/Worker hébergée reste à réaliser par le contrôleur après correction/revue ; elle n’est pas revendiquée ici (`docs/program/qualification-2026-10-12/task7b2-range-checkpoint.md:27`). Cette revue ne statue pas sur les 400 approbations, le calendrier365 ou l’achèvement global de Task7.

## Strengths

- L’autorité est copiée puis vérifiée : racine/shards≤256KiB, cache borné, chemins fermés, métadonnées de taille totale/offset/longueur exactes, au plus deux plages contiguës, SHA de l’objet logique complet avant restitution (`lib/semantic-v2-range-r2.ts:16`, `:32`, `:44`, `:58`, `:73`, `:88`). Les tests couvrent corruptions, métadonnées erronées, troncature, surplus et concurrence (`tests/semantic-v2-range-r2.test.ts:25`, `:37`, `:46`, `:66`, `:79`).
- La sonde exige token+expiration+pinset exact, refuse les paramètres URL et champs supplémentaires, limite le corps à256octets et n’accepte qu’un caseId compilé ; les réponses n’exposent que résultats hachés et compteurs (`lib/semantic-transfer-auth.ts:2`, `lib/semantic-runtime-qualification.ts:14`, `:30`, `:37`, `:55`). Les échecs négatifs exigent les erreurs d’intégrité précises (`lib/semantic-runtime-qualification.ts:49`).
- Le constructeur rehash le TAR et ses chunks, refuse liens/PAX/chemins ambigus, revalide l’archive cible avant et après empaquetage et impose un paquet strictement inférieur à8MiB (`scripts/build-semantic-range-pack-v2.mjs:22`, `:47`, `:70`, `:78`, `:81`). La mesure réelle cible91=7 338 496octets et les260shards sont consignés, sans prétendre qualifier les400cibles (`docs/program/qualification-2026-10-12/task7b2-range-pack-inspection.json:7`).

## Issues

### Critical (Must Fix)

Aucun.

### Important (Should Fix)

**I1 — Une annulation de corps R2 qui ne se termine pas immobilise la sonde au-delà de sa deadline.**

- Preuve : `lib/semantic-v2-range-r2.ts:18` attend `object.body.cancel()` avant de rejeter une réponse aux métadonnées incorrectes ; `:24` fait de même sur surplus. Le corps fourni par le wrapper attend lui-même `reader.cancel()` avant de terminer (`lib/semantic-v2-bounded-r2.ts:44`). Lorsque ce dernier ne se résout pas, l’abort n’interrompt pas la promesse de cancellation déjà attendue ; `cancelBody` ne fait que lancer une autre annulation sans libérer cette attente (`:29`). Le timer de30s de la sonde n’impose donc pas son délai dans ce chemin (`lib/semantic-runtime-qualification.ts:32`, `:41`).
- Vérification ciblée effectuée : vrai adaptateur + vrai wrapper, objet de taille2 alors que la racine attend1octet, flux dont `cancel()` retourne une promesse permanente. Abort déclenché à20ms ; à100ms le chargement reste en attente. Résultat exact : `{"result":"STILL_PENDING_AFTER_ABORT","cancelCalls":1,"aborted":true}`. Aucun accès cloud ni écriture du reproducteur.
- Impact : une réponse R2 invalide peut laisser une requête authentifiée pendante malgré le délai annoncé et empêcher une qualification fiable des chemins d’échec.
- Correction attendue : rendre les annulations de nettoyage non bloquantes ou explicitement bornées par l’abort, rejeter immédiatement l’erreur de métadonnées/surplus et assurer la libération des verrous sans attendre un cancel non coopératif. Ajouter un test avec cancel permanent sur ces chemins R2 ; le test actuel de cancel bloqué porte uniquement sur le corps de requête (`tests/semantic-runtime-qualification.test.ts:57`).

### Minor (Nice to Have)

Les quatre avertissements lint préexistants restent affectés à8B selon le contrôleur ; ils ne constituent pas un nouveau défaut transport. Le rapport les conserve explicitement (`docs/program/qualification-2026-10-12/task7b2-range-checkpoint.md:31`).

## Assessment

**Task quality: Needs fixes.**

L’architecture d’intégrité et d’autorisation est cohérente avec le checkpoint, mais I1 enfreint une garantie explicite de délai. Corriger ce seul blocage puis revoir la correction avant transfert/probe hébergée.

## Vérifications et limites de revue

- BASE `f7b5a57c5efb6ff340db6348293c8f08fe118a55` ; HEAD `01ed71d2b2237b6c7544d72626cbf1493a4ff6ee`.
- Brief7B2, contraintes7B, rulings finaux du registre et rapport de l’implémenteur consultés. Diff fourni utilisé comme vue des changements ; la sortie initiale étant tronquée au milieu, seul le segment masqué pinset→constructeur a été récupéré. Aucun fichier modifié relu séparément et aucune commande Git.
- Une seule vérification ciblée supplémentaire : risque d’annulation R2 non coopérative décrit en I1, compilation/reproduction entièrement en mémoire avec esbuild. Aucune suite relancée ; les33tests/typecheck/build rapportés ne sont pas présentés comme une exécution indépendante du reviewer.
- Aucun réaudit du corpus, des archives historiques ou de l’oracle numérique. Aucun accès cloud, transfert, preview, secret, mutation source/index/HEAD/data. Seul ce rapport est écrit.
