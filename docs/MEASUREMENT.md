# Mesure first-party BRAIZ

État du code au 29 octobre 2026. La présence de ce code ne prouve pas son déploiement, l'existence d'une audience ni la configuration des secrets opérateur.

## Choix du joueur

- Désactivée par défaut. Aucun identifiant de mesure, cookie ou appel de collecte n'est créé sans choix explicite dans Profil > Préférences > Mesure facultative.
- L'identifiant est aléatoire, propre au navigateur et distinct des sessions/identités du jeu. Il ne permet pas de rejoindre les tables joueurs, mots, duels ou sauvegardes. Seule son empreinte SHA-256 est conservée en D1.
- Un consentement dure 35 jours. Il n'est jamais renouvelé automatiquement. Le dernier état compatible est partagé entre onglets; le retrait arrête les envois et les requêtes en cours.
- Le retrait supprime les événements associés côté serveur. Une empreinte révoquée est conservée jusqu'à expiration pour empêcher qu'une activation retardée réactive le même identifiant.
- Si le serveur est indisponible, l'état « suppression en attente » reste conservé. Le listener de reconnexion vit dans le collecteur, indépendamment du montage du panneau Profil. Un échec de stockage ne bloque pas la tentative de suppression serveur : arrêt en mémoire et communication aux autres onglets par BroadcastChannel lorsqu'il est disponible.
- Limite réelle : si réseau et stockage échouent ensemble, fermer tous les onglets peut perdre une demande de suppression qui n'a pas pu être persistée. Les données sont alors exclues à leur expiration. Ne pas annoncer une suppression serveur sans confirmation.

## Contrat des événements

`recordProductEvent(storage, type, context)` conserve le diagnostic local existant. Seules les actions nouvelles, validées et allowlistées passent vers la mesure après consentement actif. Aucun historique n'est relu pour l'envoyer.

La requête contient seulement `action`, un jeton de consentement et un événement à trois champs : `id` aléatoire d'idempotence, `type` allowlisté, `context` allowlisté. Le serveur refuse les champs supplémentaires, types inconnus, origines non autorisées et corps de plus de 1 024 octets.

Exclus : mots, solutions, rangs, scores, identifiants de partie/duel/compte, pseudonymes, URL et referrer. `credentials: omit` exclut le cookie de session du jeu. `referrerPolicy: no-referrer` exclut l'adresse de la page de la requête. L'hébergeur reçoit nécessairement les informations réseau habituelles; le collecteur ne les stocke pas dans ses tables. La limite antiabus utilise temporairement l'adresse réseau dans la mémoire du Worker, sans l'écrire en D1.

Actions : jeu ouvert/repris, premier essai accepté, essai accepté/refusé, indice, victoire, aide/bilan, partage confirmé/copier, activité suivante, création/acceptation/fin de duel et revanche, erreurs réseau/indisponibilité/délai dépassé. Une fin de duel ouverte depuis l'historique ne produit pas un nouvel événement.

Le diagnostic local reste séparé, limité à 100 événements, exporté uniquement sur demande. Une version de diagnostic incompatible n'est pas écrasée; ce chemin peut également empêcher la collecte d'une action. Aucun envoi différé ni rattrapage hors connexion : les compteurs reflètent les observations effectivement reçues.

## Stockage et limites

- `drizzle/0009_product_metrics.sql`, généré avec `db:generate --name product_metrics`, ajoute deux tables, leurs index et aucune relation aux tables métier.
- `braiz_metric_consents` : empreinte, date d'autorisation, expiration, révocation.
- `braiz_metric_events` : empreinte, ID d'événement, jour Europe/Paris, type, mode, date de réception serveur. La clé composée empêche les doublons.
- Plafond de 500 événements reçus par navigateur/jour. Après ce seuil, les événements sont ignorés. Les requêtes de création et révocations de jetons inconnus utilisent la limite antiabus existante; le retrait d'un consentement connu n'est pas limité par ce quota.
- Au plus 10 000 consentements actifs. Les jetons révoqués inconnus ont un quota séparé de 10 000 et ne saturent pas la capacité d'activation. Les révocations d'identifiants actifs restent possibles même si le quota des jetons révoqués inconnus est atteint.
- Les données expirées sont exclues de la collecte et des rapports. Leur suppression physique se produit à la prochaine requête du service, par recherche indexée des consentements expirés puis de leurs événements. Aucun ordonnanceur n'est installé par ce lot. Pour une purge physique quotidienne même sans visiteurs, l'opérateur doit planifier un appel authentifié de rapport ou une tâche équivalente sur son infrastructure.

## Tableau opérateur

`/observatoire` est une interface non indexable. Elle ne contient aucune donnée serveur à son chargement. Son formulaire reçoit un secret, le conserve uniquement pendant la demande, puis efface le champ. Il n'utilise ni URL, ni localStorage, ni cookie opérateur.

`GET /api/metrics` refuse tout accès sans Bearer valide. Il utilise deux variables serveur à configurer dans l'hébergement :

- `BRAIZ_METRICS_OPERATOR_TOKEN` : secret aléatoire de 64 à 512 caractères. Jamais dans le dépôt, une URL, une capture ou un export.
- `BRAIZ_METRICS_OPERATOR_EXPIRES` : date ISO 8601 avec fuseau, strictement future. L'accès cesse dès cette date; renouveler explicitement dans les paramètres serveur.

La comparaison est effectuée sur des empreintes de longueur constante via le mécanisme serveur de capacité temporaire existant. Le JSON renvoyé contient exclusivement : période, compteurs par jour, compteurs par action/mode, cohortes par date et limites de lecture. Les réponses sont `no-store`. Aucun endpoint d'export des événements individuels n'existe.

Le bouton « Exporter les agrégats » produit un JSON local sans le secret. Fermer le rapport le retire de l'interface. Ne pas partager ce rapport comme une mesure exhaustive de l'audience.

## Lecture opérationnelle

- Un navigateur volontaire n'est pas une personne. Les navigateurs refusant la mesure, les bloqueurs, erreurs réseau, révocations et expirations manquent aux résultats.
- « Navigateurs » compte les empreintes distinctes dans la fenêtre de 35 jours. Les colonnes d'actions sont des participations et volumes reçus, pas un entonnoir attribué à une session unique.
- La première activité de jeu observée forme la cohorte : ouverture, reprise, essai accepté, création ou acceptation de duel. Une visite d'aide seule ne crée pas une cohorte de jeu.
- J1/J7 signifie une activité observée exactement un ou sept jours calendaires Europe/Paris plus tard. Seuls les jours de retour entièrement terminés entrent au dénominateur. Avant cette maturité : `n/d`.
- Les erreurs sont des événements clients volontaires. Elles ne remplacent pas un moniteur de disponibilité, n'incluent pas les joueurs n'ayant pas chargé l'application et ne constituent pas un SLA.
- La suppression/revocation peut diminuer les anciennes cohortes. Comparer des périodes et des périmètres équivalents, sans extrapolation à tous les joueurs.

## Vérification avant ouverture

1. Publier avec la migration additive et vérifier la liaison D1 existante.
2. Configurer le secret opérateur et son expiration hors source. Sans eux, l'accès reste fermé.
3. Vérifier la réponse 401 sans secret, puis un rapport agrégé autorisé, initialement vide si aucune observation réelle.
4. Vérifier qu'aucun appel de collecte n'apparaît avant consentement. Activer volontairement sur un navigateur de test, jouer, retirer l'autorisation et vérifier que ses données disparaissent.
5. Vérifier les limites de lecture et l'absence de données sensibles dans le rapport. Aucune cohorte artificielle ne doit être ajoutée à la production.

Tests : `node work/run-duel-tests.mjs metrics-store metrics-http metrics-client`. Ils couvrent absence de consentement, idempotence, expiration/purge, retrait concurrent, quota de collecte, saturation des jetons inconnus, stockage bloqué, reprise de suppression hors Profil, origine/allowlist, secret expiré et cohortes J1/J7.
