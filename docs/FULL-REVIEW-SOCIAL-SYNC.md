# Synchronisation personnelle, cercles et duels — revue complète, lot 4

## Réalisations

| ID | Réalisation et fichiers | Preuve |
| --- | --- | --- |
| D16 | Texte distinct avec/sans invitation ; inspection explicite disponible, déjà acceptée, auteur, expirée, révoquée, complète, exclue ou inconnue ; aucune création/acceptation à la visite. Destination conservée dans sessionStorage pendant le passage par récupération. `invitation-status`, `/api/invitations`, circles/duels/server-game. | Tests API d’invitation : lecture sans consommation, états et authenticité ; session/recovery existantes ; D1 local. |
| D17 | Défi courant en tête, résultats de la dernière semaine réellement enregistrée par défaut, choix des archives et résultats datés ; membres/invitations regroupés dans un panneau fermé, gestion propriétaire ; aucune proposition adverse exposée. | API refuse un challenge d’un autre cercle ; stores avec membres actifs ; tests historiques du store. |
| D18 | Navigation commune, vrai hôte/adversaire, invitation avec date d’expiration Paris, 3 manches avec essais/restants, échéance, bilan des manches/égalités/abandon et revanche distincte. Liste projette réellement l’expiration/fin au lieu du seul état brut. | Tests de borne d’invitation, échéance du duel, égalités, refus de proposition tardive ; identités issues de D1. |
| A06 | Configuration volontaire dans Profil ; préparation et confirmation d’envoi, aperçu puis confirmation de fusion ; format spécifique `braiz-personal-device-sync` distinct du transfert de profil. Union des essais/épingles/contextes, révisions locales et distantes, rejet de conflits avant écriture. Copie privée appartenant à l’identité invitée. | `device-sync.test.ts`, `social-sync.test.ts`, qualification D1 réelle locale, contrôles TypeScript/build. |
| A08 | Objectif facultatif par cercle/semaine Paris, 0 désactive, 1–20 réussites ; propriétaire seul ; progression et contributions réelles, état accompli, sans récompense ni pression quotidienne. | D1 + test semaine DST : partie réellement gagnée via trigger, rejeu neutre, borne exacte et semaine suivante vide. |
| A02 serveur | Liste des parties du propriétaire datée, reprise par ID authentifié, destination `?game=` reprise aussi après récupération ; copies personnelles exclues du store compétitif. | Tests d’accès au store/server-games et auth existants. |
| D03 / D10 / D26 social | AppNavigation sur les trois surfaces, formulaires nommés, verbe Envoyer, erreurs/status écrits, visibilité de la portée, boutons d’action et confirmation. | TypeScript/SSR existant ; recette visuelle responsive à compléter au lot8. |

## Contrat de copie

Version1, corpus `fr-fasttext-30000-v1`, règles `classic-v1`, provenance `personal-unverified`. La copie contient un export de profil validé selon le contrat existant (y compris mots et références des faits de progression, anciennes données V1, styles/préférence de son), ainsi que les **sauvegardes classiques en cours** : essais avec scores/ordre/date quand connue, indices consommés, trois épingles au maximum, contexte daily/archive/free/challenge et contexte de collection/voyage lorsqu’enregistré. Les identités et zéros initiaux des graines sont conservés.

Cette copie ne transforme jamais des résultats locaux en résultats serveur. Elle ne contient pas les sessions, jetons CSRF, codes de récupération, invitations, clés inconnues du navigateur, diagnostics ni préférences calendrier/animation. Elle n’est pas chiffrée de bout en bout. Les états propres des autres variantes et le parcours de voyage complet ne sont pas transférés par ce format ; leurs parties classiques en cours et contextes éventuels sont conservés. Les parties déjà achevées ne sont pas copiées comme sauvegardes : leurs faits personnels restent dans le profil.

Limites explicites : **1 Mio UTF-8** pour l’enveloppe (borne adaptée à une ligne D1), 1 000 parties, 3 000 essais par partie, 3 épingles/indices. Une limite dépassée refuse l’ensemble sans suppression ni troncature. Les clés sont fermées à chaque niveau ; une sauvegarde ou ancienne copie brute V1 contenant des champs inconnus est refusée. Versions futures, horodatages futurs, identités incohérentes, profils corrompus, références/récompenses invalides et frontières V1 incompatibles sont refusés.

L’aperçu est sans écriture. La confirmation vérifie de nouveau la révision distante, tous les octets locaux concernés et le profil en mémoire (dont événements en attente). Les données sont préparées dans un stockage en mémoire. L’union garde les essais locaux, ajoute les mots manquants sans doublon et garde les épingles ; score contradictoire, contexte contradictoire ou plus de trois épingles/indices bloque la fusion. L’import marque la frontière de projection des essais pour ne pas les recompter au prochain coup. Il ne reconstruit aucun événement de diagnostic, score compétitif ni crédit de jeu.

Une copie distante existante ne peut pas être remplacée par une copie qui perd ses faits/preuves, parties, essais, indices, épingles ou contexte connu. Le joueur doit d’abord fusionner. Si une partie distante a depuis été terminée localement, le format des seules parties en cours peut empêcher ce remplacement : la suppression **explicite** de l’ancienne copie, puis un nouvel envoi, reste disponible. La copie locale ne disparaît jamais lors de cette suppression.

## Raccord au plateau et navigation

`ProfilePanel.onDeviceSync` est distinct de l’import de profil seul. Le plateau fournit une garde requête + navigation + identité de partie et état occupé ; elle est vérifiée à l’instant exact précédant les écritures, après les lectures réseau et validations. Changement de partie, chargement, proposition/indice en cours ou changement de navigation impose un nouvel aperçu. Les références de callbacks sont mises à jour après rendu pour éviter une décision sur un ancien état.

Une fusion admise invalide l’ancienne requête et annule les timers/focus de retour différés. Puis la sauvegarde **courante et compatible** est relue en mémoire, avec actualisation de la liste des reprises. Ni vue, ni saisie, ni focus ne changent. Aucun son, toast, célébration, activité profil ou checkpoint de récompense n’est déclenché. Les événements storage sur la partie courante appliquent également cette relecture silencieuse aux autres onglets et invalident leur ancienne réponse. Les octets futurs/corrompus sont conservés et bloquent les écritures.

Le test de transition utilise la vraie fusion, le vrai lecteur V1 et l’écriture admise : union essais/épingles → ancienne réponse retardée ignorée → prochain essai garde l’union. La recette navigateur multi-onglets reste au lot8.

## Authentification, suppression et récupération

GET `/api/sync` exige une session ; PUT/DELETE exigent aussi l’origine autorisée et le CSRF existant. Le corps est borné pendant la lecture du flux. La clé propriétaire provient exclusivement de la session serveur, jamais du client. Un numéro de révision protège tous les changements ; le store revalide aussi session active et révision dans la requête SQL de mutation.

La suppression remplace uniquement le payload de l’identité courante par `NULL` et incrémente la révision. Une tombstone conserve guest_id/version/révision/date pour empêcher un ancien client de recréer la copie avec une ancienne révision. Elle ne supprime ni profil local, ni parties serveur, ni données d’autres joueurs. « Désactiver sur cet appareil » ferme le transfert facultatif sans effacer la copie ; aucun transfert automatique n’existe. La révocation réelle de session est accessible dans Votre espace.

La récupération réutilise le code existant, à usage unique, envoyé en corps HTTPS et jamais en URL. Elle retrouve la même identité et invalide les anciennes sessions. L’invitation est seulement gardée dans sessionStorage de l’onglet ; un lien interne sans jeton mène au cercle/duel après récupération. Aucun OAuth, nouvelle identité automatique ni invité fictif ajouté.

## Objectif coopératif

`braise_circle_goals` possède une ligne unique cercle/semaine, cible bornée0–20. L’écriture n’accepte ni semaine ni propriétaire clients : semaine déterminée à Paris, propriétaire et session vérifiés en SQL. Les contributions sont dérivées de `COUNT(DISTINCT circle_game_id)` joint aux jeux serveur `won`, membres actifs, challenge de la semaine et `completed_at` dans l’intervalle exact Paris [lundi00:00, lundi suivant00:00[. Une participation par membre/challenge est déjà unique. Aucun mot n’est sélectionné par cette requête. La frontière Paris utilise une recherche exacte à la milliseconde indépendante du lecteur historique V1 et reste correcte au changement d’heure.

## Migration et qualification

Migration ajoutée seulement : `drizzle/0005_sudden_toro.sql`, snapshot Drizzle0005 et entrée du journal générés par `npm run db:generate`. Schéma17 tables. Les migrations0000–0004 et triggers préexistants restent intacts. Nouvelles tables : `braise_device_snapshots` et `braise_circle_goals`.

Commandes reproductibles :

- `node scripts/test-social-sync.mjs` : nouvelles suites + store/auth, profil, moteur/reprises, compatibilité, fondations et objectifs hebdomadaires, sans pipeline V2 lourd.
- `node scripts/qualify-social-local.mjs` : runtime D1 réel local Miniflare, répertoire isolé `work/d4-*`, migrations0000–0005 dans l’ordre, API sync et invitation, victoire serveur/déduplication/objectif ; aucune ressource de production. Le runtime est fermé en fin de script.
- `npm run typecheck`, `npm run build` : compilation avec vérification de la source V1 figée.
- Lint de tous les fichiers modifiés ; le socle Game garde les alertes préexistantes détaillées au rapport, sans correction hors périmètre.

Limites de qualification : aucun test d’identité/invitation de production, déploiement ou navigateur mobile/desktop dans ce lot ; release flag avancé reste false. Suite exhaustive et pipelines V2 lourds non relancés conformément au cadrage du contrôleur, recette finale au lot8. localStorage n’offre pas de transaction atomique entre processus : révision et préparation limitent les conflits ; un échec d’écriture tente de restaurer les valeurs précédentes et affiche une erreur, une panne persistante du stockage peut empêcher une restauration intégrale. Aucun succès n’est annoncé dans ce cas.

Les scénarios D1 emploient des identités, mots et évaluations de test dans une base locale isolée ; aucun score ni participant de ces scénarios n’est publié. La qualification porte sur les véritables migrations, requêtes, triggers et routes d’API locaux, et ne remplace pas la recette du déploiement.
