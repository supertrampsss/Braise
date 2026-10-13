# Task 3 — revue indépendante

Verdict : **Needs fixes — 2 Important, 0 Critical**.

HEAD relu : `fbcf6d652578754a0f580d34ad30745fce5782a1` ; base `a713d49b7070bee32232fd2ff5b20794565f94a1`.

## Important I1 — La portée affichée exclut des mots réellement exportés

- Fichier : `components/profile-transfer.tsx:89` ; affirmation également présente dans `docs/FULL-REVIEW-PERSONAL-PROGRESS.md:20`.
- Le nouveau tableau annonce « historique des mots » → « Non · restent sur cet appareil ». Or `createLocalProfileExport` sérialise les activités et preuves intégrales (`lib/profile-storage.ts:901–925`), dont les événements `guessAccepted` contiennent `word`, `order`, `occurredAt` et la référence de partie. Le contrat existant est légitime et doit rester intact ; c’est la nouvelle description du contenu qui est fausse.
- Reproduction ciblée exécutée en mémoire, sans fichiers ni données utilisateur : profil vierge → proposition acceptée `maison` dans `free-1` → export. Résultat `ok:true`, JSON contenant `activities[0].word = "maison"`, `order:1`, `occurredAt:"2026-10-12T10:00:00.000Z"`, `puzzleRef.id:"free-1"`. La partie elle-même reste effectivement exclue et non reprenable.
- Action : distinguer explicitement les mots/faits de progression présents dans le fichier des sauvegardes de parties, scores détaillés et épingles absents. Corriger tableau et documentation sans changer le format ni retirer les preuves nécessaires au crédit. Ajouter une assertion sur un export avec activité réelle et sa description UI. D13 exige une portée exacte avant transfert.

## Important I2 — METHOD:PUBLISH sans ORGANIZER viole le profil iTIP annoncé

- Fichier : `lib/calendar-reminder.ts:53` ; commentaire ligne 50, test `tests/calendar-reminder.test.ts:17`, documentation lignes 30 et suivantes.
- Tous les fichiers émettent `METHOD:PUBLISH` tout en excluant `ORGANIZER`. La table normative de [RFC5546 §3.2.1](https://www.rfc-editor.org/rfc/rfc5546.html#section-3.2.1), consultée durant la revue, impose exactement un `ORGANIZER` pour cette méthode. Cela concerne le rappel actif comme le fichier d’arrêt, indépendamment de l’absence d’envoi réseau. Les tests de forme actuels consacrent cette combinaison non conforme ; aucun import réel ne la qualifie.
- Action recommandée : produire un objet calendrier autonome RFC5545 sans `METHOD`, garder `UID`, séquence, état et dates identiques pour l’arrêt, et conserver la suppression manuelle explicite. [RFC5545 §3.7.2](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.7.2) permet un calendrier sans méthode de planification. Aucun organisateur fictif ni destinataire n’est nécessaire. Adapter tests et documentation. Ce correctif précise le ruling du contrôleur : l’absence d’organisateur est compatible avec le besoin, mais pas avec la méthode iTIP choisie.
- Portée de la preuve : non-conformité normative démontrée ; aucun refus Apple/Google particulier n’est affirmé sans essai.

## Éléments approuvés

D11/D12 : raccordement Profil réel, résumé court, objectifs et styles accessibles malgré le flag avancé désactivé ; callbacks de style/son existants réutilisés. Aucun diff des migrations, activités, récompenses ni crédits. D26 : titres, états textuels, captions/en-têtes, régions défilables et focus/cibles CSS présents ; recette intégrale réservée au lot 8.

A13 : médianes vides inconnues, dénominateurs propres, aucune datation inventée, exclusion des dates futures/invalides de la tendance, distinction des modes stockés quotidien/archive et historique paginé. Le stockage filtre les modes invalides ; le libellé de repli reste « Mode inconnu ». Copie du seuil de réussite corrigée, assertion SSR présente.

D13 : aperçu, révision avant mutation et annulation préservés ; garde de sélection pour les succès et erreurs de lecture. Aucun import de faits ne génère d’événement de jeu.

A10 : seuil de trois jours Paris fondé sur les propositions réellement acceptées du journal, aucun effet au montage/restauration, horizon borné, conversion IANA/DST vérifiée dans les tests (trous, doublons, décalage fractionnaire), CRLF/échappement/repli UTF-8, UID stable, arrêt sans alarme, refus de reçu futur/corrompu et garde des UID concurrents. L’interface n’affirme pas retirer un événement externe. Limite non transactionnelle interprocessus documentée.

## Vérifications et limites

Brief, ruling RFC/testscope, sections sélectionnées de la spécification, diff, modules, callsites et nouveaux tests relus. Journaux consultés : 118/118 tests ciblés, typecheck sans erreur, build terminé et lint ciblé vide ; pas de répétition de la suite inchangée. Test additionnel uniquement en mémoire pour I1. Les 11 échecs lourds Windows restent au lot 7, la recette calendrier externe et accessibilité complète au lot 8. Aucun serveur, push, sous-agent ou changement de production ; seul ce rapport est écrit.
