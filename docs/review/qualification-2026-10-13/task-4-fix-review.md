# Task 4 — re-revue ciblée, correction 1

**Needs fixes — I1 reste partiellement ouvert (P2). I2 et I3 sont corrigés.**

Base : `886b9472f80bab96c8bfb52542fa10e061dddf10`. HEAD contrôlé : `ac02ea2599d956b2ce8ce78643726ef762e47d11`. Périmètre : les trois constats de `task-4-review.md`, leur correction et les régressions directement introduites dans ces chemins. Le checkout, l’index et HEAD ont été laissés intacts ; seul ce rapport est écrit.

## I1 — Partiellement corrigé, reste P2

**Partie corrigée :** `components/device-sync.tsx:19`, `lib/device-sync.ts:46–64`, `components/game.tsx:242–246`. Après le GET, le vrai bouton prend le snapshot mémoire le plus récent et rapproche les faits persistés dans un staging privé. Les préférences et activités en attente sont conservées. La lecture du plateau courant refuse une sauvegarde absente ou appauvrie ; les essais classiques pending sans plateau sont également contrôlés. Les tests `tests/social-sync-components.test.ts:21–35` et `:83–95` couvrent ces cas à partir d’un panneau sans envoi préparé. Aucun stockage réel n’est écrit par la préparation.

**Reste dans la frontière I1 : un refus ne retire pas un envoi déjà préparé. Localisation : `components/device-sync.tsx:19` et `:21`.** Le nouveau chemin peut afficher « Envoi refusé pour éviter une copie incomplète », tout en laissant actif le bouton de confirmation et son ancien payload. La préparation invalide seulement `candidate`, puis remplace `upload` uniquement en cas de succès ; l’exception de la nouvelle garde laisse donc `upload` inchangé. Un joueur qui relance la préparation pour inclure un nouvel essai peut confirmer cette ancienne copie, dépourvue de cet essai, malgré le refus affiché.

**Reproduction ciblée exécutée sur le vrai composant, en mémoire uniquement :** monter `DeviceSync` avec un profil valide, une partie `free-001` enregistrée sans essai et la garde du plateau ; configurer puis préparer l’envoi (une confirmation présente). Retirer la sauvegarde et fournir au même plateau un nouvel essai `arbre` ; cliquer de nouveau « Préparer l’envoi de cet appareil ». Résultat : le message de refus attendu apparaît, mais `Confirmer l’envoi` reste présent **et activé** (`count=1`, `disabled=false`). Son gestionnaire conserve `upload` et appelle toujours PUT avec cet ancien payload. Aucun fichier de reproduction ni service n’a été créé.

**Correction attendue :** invalider l’ancien `upload` lorsque démarre une nouvelle préparation, et conserver son absence en cas de refus/échec. Ajouter au test du vrai composant la séquence préparation réussie → nouvel état mémoire non enregistré → préparation refusée, avec aucune confirmation ni PUT possible. Cette demande prolonge uniquement la frontière déjà nommée « partie en mémoire / sauvegarde manquante ou périmée » ; elle ne demande pas une nouvelle revue des chemins inchangés.

## I2 — Corrigé

`lib/device-sync.ts:66–85` et `app/api/sync/route.ts:22–23` partagent la comparaison des faits d’essai. La nature indice/proposition et les dates connues ne peuvent plus être perdues lors d’un remplacement ; l’union enrichit une date absente et refuse deux dates connues incompatibles. Les conflits répondent 409 avant écriture. L’ordre local reste conservé dans l’union, et un superset réordonné est accepté au remplacement.

Assertions relues : `tests/device-sync.test.ts` (test « game fact union preserves known timestamps… »), `tests/social-sync.test.ts` (test « replacement rejects hint/date metadata loss… »), et `scripts/qualify-social-local.ts:19–22`. Elles vérifient les deux directions d’enrichissement, les suppressions/conflits hint/date, les octets et révision inchangés après refus, puis le remplacement réordonné autorisé.

## I3 — Corrigé

`components/invitation-status.tsx:7–29`, `components/circles.tsx:14–15,32–36`, `components/duels.tsx:15–16,32–35`, `app/api/invitations/route.ts:13–17`. Le parent possède l’inspection et conditionne création/acceptation à une disponibilité réellement inspectée, avec expiration revérifiée au submit. La clé token/identité/tentative et l’annulation empêchent une réponse retardée, y compris A→B→A, de réactiver une ancienne invitation. Les états indisponibles proposent une sortie ; accepté/propriétaire propose une reprise vers l’identifiant renvoyé uniquement à un membre/participant. Les codes saisis valides restent conservés dans l’onglet pour récupération.

Assertions relues : `tests/social-sync-components.test.ts:38–72` (deux composants, états indisponibles/pending, submit direct, identité puis réinspection/acceptation, reprise et réponses périmées), et `tests/social-sync.test.ts` (destinations uniquement membres/participants). L’inspection reste sans consommation ni création automatique.

## Preuves et limites

Logs relus : `work/task4-fix1-tests.log` **129 tests / 129 pass / 0 fail**, avec les nouvelles assertions présentes ; `work/task4-fix1-d1.log` **PASS D1 local réel**, y compris perte de métadonnées refusée 409 et copie intacte ; typecheck sans diagnostic ; lint ciblé vide. Le build final porte `verified-frozen`, 120 cibles, SHA256 V1 `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`, et se termine par `Build complete`. La preuve contre la base immuable contient **24 tests / 15 pass / 9 fail attendus** ; elle ne couvre pas la séquence résiduelle décrite ci-dessus. Aucune suite complète n’a été relancée ; une seule reproduction a été exécutée pour ce doute précis.

**Régressions critiques/importantes introduites :** aucun autre constat ; le seul P2 est l’interaction du nouveau refus I1 avec l’ancien envoi préparé.

**Hors périmètre, non bloquant pour cette re-revue :** recette navigateur responsive/clavier/multi-onglets et qualification finale du lot 8, limites transactionnelles localStorage, lint Game préexistant et pipelines V2 Windows déjà cadrés. Aucun nouvel audit de ces sujets ni constat bloquant ajouté.

**Verdict final : Needs fixes**, limité à l’invalidation de la confirmation ancienne lors d’une préparation refusée (I1). I2 et I3 approuvés.
