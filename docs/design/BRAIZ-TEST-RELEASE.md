# BRAIZ : version pour les testeurs

Date : 14 septembre 2026.

## Périmètre

Marque BRAIZ dans l’application, les titres, le partage, le manifeste installable, l’export du profil et l’écran hors connexion. Le Site conserve son identité, sa base et ses sauvegardes. Les clés `braise.*`, les noms de cookies et les versions de protocole restent compatibles.

Le menu propose Mot du jour, Partie libre, Archives, Profil et Comment jouer. Voyage et Entre amis disparaissent, avec les liens vers Studio, Laboratoire, espace serveur et intégration. Les pages avancées redirigent vers l’accueil. Le code reste disponible derrière `EXTRA_MODES_ENABLED` pour une reprise ultérieure. Apparence et objectifs hebdomadaires ne sont pas proposés dans cette version de test.

## Corrections issues de la revue

- Le chargement interne des fichiers sémantiques passait par un hôte artificiel refusé par Vite. Le binding ASSETS utilise maintenant une origine locale admise ; il lit les mêmes fichiers avec les mêmes empreintes. Aucun score de remplacement.
- Le réglage Son utilisait exclusivement `crypto.randomUUID`, absent dans le navigateur de test HTTP. Un UUID v4 fondé sur `crypto.getRandomValues` assure la compatibilité.
- La pause d’animation est enregistrée localement. Un seul composant de flamme est monté dans le jeu visible.
- Les réponses provenant du nouveau domaine sont autorisées par la validation d’origine, uniquement si elles correspondent aussi à l’origine de la requête. Les autres origines restent refusées.
- Nettoyage des libellés : Fermer, singuliers du profil, texte hors connexion.

## Preuves et limites

167 tests automatisés réussis après la correction des attentes de nom d’export et de version de cache. Ces attentes ne changent ni les assertions de contenu ni la compatibilité des données. Tests d’origine étendus à braiz.io et aux tentatives inter-origines.

Parcours navigateur sur la prévisualisation réelle : accueil, saisie, score réel, doublon refusé, saisie invalide conservée, cinq essais puis indice, tri, épingle, rechargement avec reprise, victoire, partage copié sans réponse, continuation libre, archive, profil, bascule Son, pause mémorisée, lancement d’export, aide et retour au jeu. Accès direct à /duels redirigé vers l’accueil. Le fichier d’import conserve sa suite de tests automatisés ; aucun import de fichier via navigateur effectué dans cette revue.

WebGL est désactivé dans ce navigateur de test. Le visuel de secours est inspecté, les contrôles de pause sont vérifiés, mais l’animation WebGL, sa fluidité et Safari sur iPhone restent non testés. Les rendus EGL antérieurs ne remplacent pas cette qualification.

## Raccordement du domaine

braiz.io est enregistré auprès du service d’hébergement. À ce checkpoint, les DNS et le certificat sont en attente de validation. Aucun accès Cloudflare connecté n’est disponible pour écrire dans la zone. Les enregistrements exacts sont remis au propriétaire. Le nouveau domaine possède son propre stockage de navigateur : la progression de l’ancienne URL peut être transférée par export/import du profil, mais les parties en cours et épingles ne sont pas incluses dans cet export.

Publication et ouverture publique : vérifier les résultats des opérations d’hébergement après ce commit avant d’annoncer le lien accessible. L’ancien programme automatisé reste arrêté.
