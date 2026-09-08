# B10a : démarrage hors connexion

Manifeste installable progressif, origine des métadonnées explicite et écran de secours français. Le service worker met uniquement en cache un document neutre : aucune partie, réponse API, page personnalisée ni score. Les erreurs HTTP d’accès ne sont pas transformées en succès hors ligne.

La mise à jour attend naturellement la fermeture des anciens clients, sans activation forcée, rechargement ou effacement du profil. Seuls les anciens caches portant le préfixe dédié sont supprimés.

Trois tests unitaires exécutent les gestionnaires du worker dans un contexte JavaScript isolé : cache minimal, exclusion API/origines étrangères/mutations, secours réseau. Ce ne sont pas des tests navigateur. 130 tests, TypeScript et construction passent. Installation réelle, comportement hébergé, intégration iframe et origine de démonstration restent à qualifier. B10 partiel, non publié à ce checkpoint.

Extension : route `/embed`, attribution et démonstrateur `/integration` sur la même origine. Contrat `braise-embed-v1`, vérification exacte de l’origine et de la fenêtre, tailles bornées. Aucun mot, utilisateur ou score transmis par postMessage. CSP `frame-ancestors 'self'` et X-Frame-Options SAMEORIGIN refusent les intégrations tierces. Le démonstrateur n’est pas présenté comme un partenaire ni comme une qualification inter-origines. Deux tests vérifient ce contrat et la préservation des réponses HTTP. Origine partenaire réelle, cookies tiers et installation navigateur restent non qualifiés.
