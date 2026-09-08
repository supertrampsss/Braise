# B6d : autorité serveur qualifiée sur l'hébergement privé

Le parcours B6 a été exercé contre la version privée 7 réellement déployée, issue du commit `4f7852afd69f05593d8e02a33f08b0e781dbcb96`. Le contrôle utilise le D1 du Site existant et des identités portant explicitement le préfixe `QA-`. Elles ne représentent ni des joueurs réels ni une mesure d'usage.

Une session invitée a été créée avec les attributs de cookie attendus. La création répétée d'une partie a rendu la même vue publique, sans graine ni cible. Une proposition `maison`, admise par le corpus V1, a produit un score réel, un rang borné et un booléen de victoire ; son rejeu avec la même identité de requête n'a ajouté aucun essai. Deux propositions distinctes envoyées simultanément avec la même révision ont donné exactement une réussite et un conflit, puis une seule proposition persistée.

Les lectures sans session ont été refusées. Les mutations sans CSRF et avec une origine étrangère ont été refusées sans changer la vue de la partie. La récupération a conservé la même identité invitée et la partie exacte, révoqué l'ancienne session, puis la nouvelle session de contrôle a été révoquée.

Le harnais reproductible `npm run qa:hosted:private` exige un jeton temporaire uniquement en mémoire, fixe l'origine de Braise, borne chaque requête et expurge les erreurs. Une relecture gpt-6-astra effort max a identifié puis fait corriger deux risques de fuite et de nettoyage. Deux erreurs synthétiques ont ensuite confirmé que le cookie est révoqué et qu'aucun cookie, CSRF ou code de récupération n'est affiché. La dernière relance réelle a rencontré la limite horaire attendue après les passages précédents ; son nettoyage a réussi. Les faits hébergés ci-dessus avaient déjà tous été observés sur les passages réels précédents.

Les 157 tests, TypeScript, le lint ciblé et la construction de production passent sur `c9cbdb3dbc24a6edd3f6a6c995e38a92fab015fa`. Ce lot ferme B6. Il ne qualifie pas encore les routes hébergées des cercles, duels ou studio, ne réalise aucun test navigateur et ne modifie pas la publication privée.

Les sessions des passages réussis et limité ont été révoquées. Les lignes invité et partie restent dans D1, car aucune API de suppression n'existe. Le tout premier essai du harnais, antérieur au nettoyage renforcé, a perdu son jeton après une assertion ; cette session `QA-` inaccessible expirera automatiquement sous trente jours. Aucun effacement direct de données n'a été tenté.

Prochaine tranche : étendre le même contrôle aux cercles et duels, puis au studio. En parallèle, ajouter la commande de restauration contrôlée du corpus local ignoré avant de reprendre les rotations B2.
