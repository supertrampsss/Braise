# Task 4 — revue indépendante

**Needs fixes — 3 écarts P2.**

HEAD relu : `886b9472f80bab96c8bfb52542fa10e061dddf10` ; base : `b7d1560d255d5063e0a2ddad3a8ed7804eaae237`. Le rapport de livraison désigne bien ce HEAD. Revue du brief et de ses consignes contrôleur, du rapport, de la spécification/backlog approuvés, du paquet `review-b7d1560..886b947.diff` et des appels réels concernés. Aucune modification de production, aucun serveur, push, déploiement ou sous-agent.

## Corrections nécessaires

### 1. [P2] Inclure le profil en mémoire dans la préparation d’envoi

**Localisation : `components/device-sync.tsx:19`.**

La préparation appelle `createDeviceEnvelope(localStorage, loadLocalProfile(localStorage))` au lieu de tenir compte du `snapshot` courant, pourtant disponible dans `latest.current.snapshot`. Après un échec de persistance, le moteur de profil conserve les nouvelles activités dans `pendingActivities` et les affiche dans le profil. Une nouvelle lecture du stockage les perd ; l’envoi est néanmoins proposé et peut être confirmé comme réussi. Un changement d’appareil ne retrouve alors pas toute la progression/préférence que le joueur croyait sauvegarder. Le contrat A06 et le mécanisme existant d’export des activités en mémoire ne sont donc pas respectés.

**Preuve exécutée en mémoire, sans fichier ni service :** créer une base persistée, refuser les écritures suivantes, appeler le vrai `setLocalSound`, puis comparer les deux vrais appels `createDeviceEnvelope`. Résultat : `pendingActivities=1`, export avec le snapshot courant : `activities=1`, chemin utilisé par le composant : `activities=0`. Le même contournement concerne les activités de jeu laissées en attente par le moteur de profil.

**Attendu :** préparer à partir d’une réconciliation conservant le snapshot mémoire courant et les faits persistés, ou refuser explicitement un transfert incomplet. Ajouter un test du branchement de préparation après échec de stockage ; ne pas seulement tester la bibliothèque avec un snapshot correct fourni manuellement.

### 2. [P2] Empêcher le remplacement cloud de perdre les métadonnées d’un essai conservé

**Localisation : `app/api/sync/route.ts:22`.**

La garde de conservation ne compare que `word`, `rank` et `temperature` des essais distants. Elle accepte qu’un nouvel envoi retire `hint` et `acceptedAt` d’un essai existant, tant que le compteur global d’indices ne baisse pas. Deux appareils ayant rencontré le même mot par un indice et par une proposition peuvent ainsi remplacer silencieusement l’interprétation historique de cet essai ; une date connue peut aussi disparaître. Cela contredit la conservation annoncée des faits et contourne le conflit d’indice que `unionGame` refuserait lors d’une véritable fusion.

**Preuve exécutée sur les vraies routes et migrations, avec la base SQLite locale en mémoire du support de tests :** PUT initial d’un essai `arbre`, rang 200, température 12, `hint:true`, `acceptedAt:'2026-10-01T12:00:00Z'`, `hints:1` → **200**. PUT révision 0 conservant le même mot/score/compteur mais supprimant `hint` et `acceptedAt` → **200** ; le payload relu a effectivement perdu les deux propriétés. Authentification, origine et CSRF étaient valides. Aucune ressource distante utilisée.

**Attendu :** une règle commune de conservation/fusion des faits de partie, incluant au minimum la nature indice/proposition et les dates connues ; refuser un remplacement incompatible ou appauvri. Tester la route de remplacement et les conflits correspondants, en conservant la politique explicite de réordonnancement de l’union.

### 3. [P2] Relier les actions d’invitation à l’état réellement inspecté

**Localisation : `components/invitation-status.tsx:4–7`, `components/circles.tsx:30–34`, `components/duels.tsx:30–33`.**

`InvitationStatus` garde le résultat d’inspection dans son propre état et ne transmet ni l’état ni une destination exploitable au parent. Les parents branchent leurs actions uniquement sur la présence du token/session. Un lien expiré, révoqué, complet ou inconnu continue donc à proposer la création d’identité pour rejoindre/accepter ; un joueur identifié voit encore « Accepter et démarrer les 48 heures » même quand l’inspection annonce que cela est impossible. Un lien déjà accepté n’obtient pas d’action propre de reprise. Le joueur peut créer une identité inutile, puis arriver à une erreur prévisible.

**Écart de spécification D16 :** le critère approuvé demande un message **et une action propres** pour nouveau/existant/expiré/révoqué/déjà accepté ; seul le message a été raccordé. Ce point relève du comportement du lot 4, pas de la seule recette visuelle du lot 8.

**Attendu :** partager le résultat inspecté avec le parent ; proposer l’acceptation seulement pour l’état approprié, une reprise pour une invitation déjà acceptée et une sortie/nouveau lien pour un état indisponible. Garder l’inspection neutre, sans consommation automatique, et conserver la destination pendant récupération.

## Contrôles satisfaisants

- Format personnel distinct et fermé, 1 Mio UTF-8, bornes explicites, profil validé, mots réellement annoncés, identités/graines conservées ; pas d’envoi des clés inconnues, sessions ou codes de récupération. Les exclusions des autres variantes et du parcours complet sont documentées.
- Fusion préparée sans écriture, révisions locale/distante, garde de plateau requête/navigation/identité et occupation au commit, invalidation des requêtes/timers/focus, relecture silencieuse et union des essais/épingles. Les tests de transition de bibliothèque ne constituent pas une recette navigateur complète.
- Propriétaire cloud issu de la session ; origine/CSRF, lecture du corps bornée en flux, CAS SQL, revalidation de session, suppression par tombstone. Pas de transformation des imports en résultats serveur.
- Reprise serveur sous identité propriétaire ; récupération existante, destinations de liens conservées dans le même onglet ; inspection d’invitation sans acceptation.
- Objectif propriétaire borné, semaine Paris calculée serveur, contributions de vraies victoires de membres actifs, `COUNT(DISTINCT game_id)`, borne exacte de fin et DST ; aucun mot projeté. États/échéances et résultats des duels dérivés des données réelles.
- Migration append-only : uniquement `0005_sudden_toro.sql`, snapshot 0005 et journal modifiés dans Drizzle. `prevId` du snapshot 0005 correspond à l’ID du snapshot 0004 ; les migrations anciennes restent intactes.

## Preuves et limites

Logs relus : **117 tests ciblés, 117 pass, 0 fail** ; qualification **D1 réel Miniflare** migrations 0000–0005/API/révocation/objectif terminée avec PASS ; typecheck sans diagnostic ; build final terminé avec `Build complete` et qualification V1 `verified-frozen`, SHA256 `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`, 120 cibles, raw 21607680, compressed 20039248, manifest 380041. Les codes de sortie 0 sont consignés dans le rapport de livraison. Pas de répétition des suites lourdes inchangées ; seulement les deux reproductions ciblées ci-dessus.

Comparaison des deux JSON de lint Game : **9 erreurs / 5 avertissements** pour la base et pour le final. Aucun constat de cette revue ne porte sur ces alertes préexistantes. Aucun verdict de lint global vert, suite exhaustive verte ou qualification de production n’est formulé. La recette navigateur responsive/clavier/multi-onglets et le nettoyage final de lint restent au lot 8, conformément au cadrage. La limite transactionnelle de localStorage et la tentative de restitution sur erreur sont documentées.

Seul ce rapport de revue a été enregistré.
