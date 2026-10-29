# Architecture BRAIZ

État du dépôt au 29 octobre 2026. Les détails numériques, empreintes et procédures de reconstruction restent dans [Word2Vec](WORD2VEC.md) et les [dossiers historiques](program/BRAISE-PLAN.md).

## Exécution et frontières

React et TypeScript utilisent les conventions App Router via Vinext. Vite et le plugin Cloudflare construisent un Worker avec assets. Le projet Sites existant est identifié dans [.openai/hosting.json](../.openai/hosting.json) ; une correction ne crée pas un Site de remplacement.

| Zone | Responsabilité |
| --- | --- |
| `app/` | Pages, métadonnées et routes API |
| `components/game.tsx` | Plateau classique, saisie, reprise et résultat |
| `components/duels.tsx`, `use-duel-sync.ts` | Parcours duel et actualisation des états |
| `lib/classic-game.server.ts` | Résolution de l'édition d'une partie |
| `lib/word2vec*.ts` | Contrat, calendrier et lecteur Word2Vec |
| `lib/legacy-storage.ts`, `profile-storage.ts` | Sauvegardes historiques et faits du profil |
| `lib/local-backup.ts`, `device-sync.ts` | Transfert local complet et synchronisation serveur |
| `lib/duel-store.ts`, `db/` | Persistance et transitions des duels |
| `lib/advertising.ts`, `product-events.ts` | Publicité et mesure, avec consentements distincts |

Bindings : `ASSETS` sert notamment les colonnes Word2Vec ; D1 `DB` porte les identités, duels, copies synchronisées et mesures ; R2 `SEMANTIC_DATA` reste disponible pour le stockage sémantique historique. Une indisponibilité de stockage ne produit jamais un score inventé.

Les moteurs et manifestes ne sont pas importés dans le bundle client. Ne pas importer `semantic.ts`, `semantic-storage.ts`, `legacy-puzzles.ts`, `word2vec.server.ts` ou leurs données dans un composant client. L'export public historique `/semantic-data.json` reste distinct de ces imports.

## Partie classique

GET `/api/game` ouvre une partie et renvoie son identité publique. POST évalue une proposition ou demande un indice avec la référence de partie. Le serveur valide mode, date, édition et référence avant le calcul. Une identité quotidienne expirée renvoie 409 ; elle ne devient pas implicitement une archive.

Le calendrier utilise la date civile de Paris. Les archives acceptent une date passée depuis le lancement historique et gardent l'identité du quotidien correspondant. Une victoire en archive ne prolonge pas rétroactivement la série quotidienne.

Les nouvelles parties depuis le 13 octobre 2026 utilisent `word2vec-v1`. Le calendrier quotidien choisit par hash parmi 475 cibles ; les graines libres gardent 120 emplacements historiques. Une référence explicite ancienne conserve son moteur `classic-v1` ou `classic-v2`, ses scores et sa sauvegarde.

Le lecteur Word2Vec évalue les 155 562 lignes source. Le rang est ordinal : cible exacte d'abord, puis cosinus avant arrondi décroissant, puis identifiant source pour départager. Seule l'identité exacte donne une victoire. Les formes canoniques en collision participent toutes au rang ; la recherche prend le premier identifiant source.

Chaque colonne BWS2 est compressée et immuable. Le lecteur contrôle tailles, empreintes SHA-256, décompression bornée, en-tête, permutation, ordre et cible. Le cache de tableaux décodés est limité à 4 Mio et quatre chargements distincts simultanés ; ce plafond ne représente pas toute la mémoire du Worker. Voir le [contrat complet](WORD2VEC.md).

La normalisation retire les espaces externes, applique minuscules françaises, NFC et l'apostrophe droite. Un mot absent renvoie 422. L'alternative `œ → oe` est une suggestion vérifiée après refus ; elle ne modifie pas le moteur et ne se soumet pas automatiquement.

Les plateaux courants autorisent trois indices au maximum. `classic-hints.ts` cherche un mot inutilisé, distinct de la réponse, autour de 75 % du meilleur rang et jamais sous 60 % de ce rang. Aucun candidat admissible signifie aucun indice disponible.

La jauge transforme le rang avec une interpolation logarithmique entre ses repères Top 5 000, Top 1 000, Top 100, Top 10 et Trouvé. Son pourcentage désigne le remplissage visuel ; le classement exact reste affiché dans les essais.

## Saisie et effets

Une réponse obsolète ne remplace ni une autre partie ni une saisie modifiée depuis l'envoi. Les doublons normalisés sont refusés avant mutation. Les erreurs réseau conservent le mot ; `request-json.ts` borne l'attente à 15 secondes. Une mutation de duel au résultat incertain conserve sa clé d'idempotence pour une relance sûre.

Les effets de flamme, progression et mot volant sont transitoires. Ils suivent une réponse acceptée de la partie courante et respectent `prefers-reduced-motion`. Une restauration ou une synchronisation ne rejoue ni célébration, ni son, ni prise de focus.

## Duels et identité

Une identité d'appareil possède une session serveur ; les jetons sont hachés en D1. Les mutations contrôlent origine, CSRF, session et appartenance. Les écritures rejouables utilisent une clé d'idempotence.

Un duel comporte trois manches, 30 essais par personne et par manche, sans indice. Il expire 48 heures après acceptation. Trouver le mot l'emporte ; si les deux trouvent, le nombre d'essais départage ; sinon le meilleur rang décide. Les égalités restent possibles.

Tant qu'une recherche peut encore être jouée, les mots adverses et la solution restent masqués. La fermeture des deux recherches permet la consultation de la manche ; un duel terminé expose son bilan. Ces restrictions sont appliquées par le serveur.

L'hôte peut renouveler explicitement une invitation encore valide. Le nouveau lien invalide l'ancien sans prolonger l'expiration ; le serveur ne conserve pas de jeton brut permanent. Les listes À jouer, En attente et Terminés utilisent un curseur serveur et des pages de 50. Détails, courses concurrentes et tests : [livraison du tableau des duels](DUEL-DASHBOARD-DELIVERY.md).

## Sauvegarde et reprise

Les clés `braise.v1.*` restent compatibles. Le profil V2 conserve sa frontière V1, la copie brute et des faits à identité stable. Réimporter ou synchroniser un fait existant ne crédite pas une seconde fois la progression.

La sauvegarde portable `braiz-local-backup` inclut le profil et les parties classiques en cours ou terminées, dans une limite de 8 Mio et 1 000 parties. L'ancien export limité au profil reste distinct. Les secrets de session, accès aux duels et préférences de mesure sont exclus.

L'aperçu ne modifie rien. La confirmation revérifie conflits, révision et présence sur disque des faits du plateau en mémoire. Un conflit bloque tout le lot ; une erreur d'écriture déclenche la restauration des valeurs précédentes et reste signalée si cette restauration échoue. Cette garde mémoire protège aussi la fusion serveur.

La synchronisation D1 conserve son propre format et sa limite de 1 Mio, avec les parties classiques en cours. La reprise d'identité dans `/espace` est séparée du fichier portable. Voir [les contrats de transfert](PORTABLE-BACKUP-DELIVERY.md).

Le service worker prévoit une page hors ligne. Seul le pack d'entraînement téléchargé explicitement fournit son jeu hors connexion ; cela ne rend pas le corpus classique complet disponible hors ligne.

## Mesure et publicité

Le diagnostic produit reste local par défaut. Après consentement explicite, `/api/metrics` accepte seulement les événements et contextes définis par le contrat, sans mots, solutions, rangs ni identifiants de duel. Les données expirent après 35 jours. La révocation est un parcours distinct.

La lecture des agrégats exige `BRAIZ_METRICS_OPERATOR_TOKEN` et une expiration valide `BRAIZ_METRICS_OPERATOR_EXPIRES`. La page `/observatoire` ne contourne pas cette autorisation. Ces mesures ne représentent que les navigateurs consentants.

`AD_RUNTIME_CONFIG` reste nul. La diffusion exige une configuration réelle, un compte validé, une CMP prête, un consentement publicitaire, une partie inactive et la fréquence autorisée. Le consentement de mesure n'autorise jamais une annonce. [État et limites AdSense](ADSENSE-READINESS.md).

## Maintenance et lecteurs historiques

Conserver les lecteurs V1, quotidien V2 et Word2Vec, les données figées, les anciennes preuves BEE2 et les validateurs de sauvegarde. Un fichier utilisé seulement par une commande, un test, une ressource Python ou une route du framework n'est pas automatiquement du code mort.

Les commandes `semantic:v2:*` restent des outils de staging et de preuve : empreintes contrôlées, vérificateur indépendant, verrous et quota de cibles. Elles ne basculent pas le produit par simple génération. Références : [baseline V1](program/BASELINE.json), [ingestion V2](program/B1E-DELIVERY.md), [preuves éditoriales](program/B2B-DELIVERY.md).

Avant une modification du moteur, du calendrier, de la normalisation ou de l'API : lire les contrats concernés puis exécuter les tests adaptés. Les commandes usuelles sont dans le [README](../README.md). L'inventaire en lecture seule `scripts/audit-code-usage.mjs` et les suppressions démontrées sont documentés dans [CODE-CLEANUP](CODE-CLEANUP.md).
