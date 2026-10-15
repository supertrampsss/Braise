# Duel complet et indices progressifs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** livrer les sept améliorations du duel validées par l’utilisateur, aligner les nouveaux duels sur Word2Vec et modérer les trois indices classiques.

**Architecture:** les anciennes parties gardent duel-v1 et leur table immuable. Une nouvelle table additive accepte les rangs Word2Vec. Une projection serveur décide pour chaque manche des informations communicables : progression adverse sans mots, puis solution et historique adverse seulement lorsque les deux recherches sont closes ou le duel terminé. Les revanches sont des invitations adressées au même adversaire, à accepter explicitement. Les réponses fraîches remplacent les faits sans effacer la saisie ni rejouer les animations.

**Tech Stack:** React/TypeScript, Vinext, Cloudflare Workers/D1, tests Node/SQLite existants.

**Spec:** proposition en conversation approuvée par « GO parfait. fais tout ça », complétée par l’exigence d’indices proportionnels au meilleur rang. L’utilisateur a explicitement demandé l’exécution complète ; aucune nouvelle validation de plan n’est nécessaire.

## Global Constraints

- Trois indices au maximum, jamais la réponse, jamais un mot déjà utilisé. Cible de rang à 75 % du meilleur rang ; aucun indice sous 60 % du rang actuel. Si aucun candidat éligible dans cette plage, ne rien consommer.
- Score, rang et identité réels uniquement ; ne modifier ni corpus ni oracle historique nextHint ni pack d’entraînement immuable.
- Trois manches, 30 essais par manche, 48 h après acceptation. Aucun indice en duel.
- Une manche est révélable après les deux clôtures, expiration globale ou abandon global. Aucun mot adverse ni solution d’une manche encore jouable par l’un des deux dans une réponse accessible avant ce seuil.
- Nouvelles parties versionnées Word2Vec ; anciennes parties inchangées. Une personne sans accès ne reçoit ni faits ni solution.
- Réutiliser l’identité Sites existante, l’audience publique, les sauvegardes et le design flamme/remplissage/Mot/Envoyer. Respecter le mouvement réduit.

## Review Focus

1. Deux joueurs sur des manches différentes : aucune fuite d’une autre solution via bilan, historique, partage, invitation ou réponse réseau.
2. Zéro essai contre un rang supérieur à 30 000 : une manche vide ne doit jamais battre un vrai résultat.
3. Révocation de session, invitation expirée et accès tiers : aucune acceptation ni mutation de revanche possible.
4. Actualisation tardive pendant une saisie, navigation ou envoi : préserver le texte et refuser une réponse obsolète sans effets visuels de restauration.
5. Candidats d’indices rares ou absents dans la plage : aucune accélération excessive ni consommation d’indice fictive.

## Task 1 — Indices dosés

**Files:** lib/classic-hints.ts ; tests/classic-hints.test.ts ; lib/site-content.ts.
**Interfaces:** betterHintId conserve sa signature ; les lecteurs V1 actuels et Word2Vec l’appellent sans migration de sauvegarde.

- [ ] Ajouter un test avec 155562 rangs et un meilleur essai au rang 100000 : chaque indice reste entre 60 % et le rang précédent, jamais dans le Top 100. Ajouter un lexique éligible seulement trop proche : résultat null.
- [ ] Exécuter le test ciblé et constater son échec avec la politique 350/80/12.
- [ ] Remplacer les seuils fixes par la plage relative, vérifier trois gains successifs et rangs 1/2/3.
- [ ] Exécuter les tests ciblés du moteur et enregistrer le résultat.

## Task 2 — Données et équité du duel

**Files:** drizzle/0008_duel_word2vec.sql ; db/schema.ts ; lib/duel-store.ts ; lib/duel-rules.ts ; lib/duel-engine.server.ts ; lib/duel-presentation.ts ; app/api/duels/route.ts ; tests/duel-complete.test.ts.
**Interfaces:** nouvelles vues vocabularySize, opponentGuesses et rounds (own/opponent/revealed/answer/decision), score partiel et invitation de revanche. Les champs guesses/decisions/role restent compatibles.

- [ ] Tester la projection avant/après double clôture, expiration, abandon, accès tiers, absence d’essais et conservation des faits historiques.
- [ ] Ajouter les tables Word2Vec et revanches sans réécrire les anciennes tables ; migration et test SQLite.
- [ ] Versionner la sélection/évaluation des nouvelles cibles avec Word2Vec, préserver duel-v1, sélectionner trois cibles distinctes et différentes du duel parent.
- [ ] Ajouter les invitations adressées, acceptation explicite et contrôle d’identité/quota/session côté serveur.
- [ ] Vérifier les cas d’accès et les moteurs via les tests serveur, puis la suite complète.

## Task 3 — Interface, synchronisation et livraison

**Files:** components/duels.tsx ; components/duel-board.tsx ; components/duel-review.tsx ; app/duels/duel.css ; lib/site-content.ts ; tests/duel-components.test.ts ; tests/duel-presentation.test.ts.
**Interfaces:** les écrans lisent uniquement la projection publique du Task 2. Les réponses de fond ne produisent aucun reçu volant, son, focus ou confetti.

- [ ] Ajouter les tests d’affichage de la solution, des mots adverses et du motif de résultat ; partage sans solutions ; actualisation sans saisie perdue ni navigation réouverte.
- [ ] Afficher les deux progressions et le score partiel, les trois bilans, l’historique consultable, la revanche adressée et le partage sans spoiler ; conserver la grosse flamme.
- [ ] Actualiser par requêtes bornées pendant la visibilité, à la reprise de focus et après une mutation ; arrêter au démontage et préserver les saisies/identités de requêtes.
- [ ] Mettre à jour les explications publiques et les règles pour la révélation après clôture.
- [ ] Exécuter TypeScript, suite complète et construction ; demander une revue indépendante conformément au skill d’exécution ; corriger tout défaut important.
- [ ] Vérifier les deux joueurs en navigateur local et le serveur publié, capturer les écrans, publier sur le Site existant et joindre un bilan de livraison concis.
