# B4b : archives fidèles au calendrier

Statut : tranche implémentée et vérifiée. Le lot B4 reste partiel. Les objectifs hebdomadaires, cosmétiques permanents et parcours d’export ou d’import ne font pas partie de cette tranche.

## Résultat livré

- Les mots quotidiens passés depuis le lancement du calendrier V1 sont accessibles par leur date réelle.
- Le serveur valide une date civile canonique, refuse les dates antérieures au lancement, le jour courant et le futur avant tout calcul sémantique.
- Une archive retrouve exactement la cible, les scores, les rangs, les indices, l’identité et le numéro d’édition du quotidien correspondant.
- Le contexte `archive` reste distinct du contexte `daily`. Une ancienne requête quotidienne expirée continue donc d’être refusée au lieu de devenir une archive implicitement.
- Le lien `?archive=YYYY-MM-DD` restaure la date choisie. Le partage d’une archive conserve ce lien et ne fabrique pas un défi.
- La même clé locale reprend essais, indices, épingles et victoire du quotidien correspondant, sans deuxième gain.
- Les nouvelles victoires conservent séparément la date du mot et l’instant réel de réalisation. Une archive terminée plus tard ne remplit pas rétroactivement la série quotidienne.

## Expérience

Le jeu reste immédiatement disponible avec ses trois entrées principales. Un accès compact « Archives » révèle un champ de date natif, borné et explicitement validé par le bouton « Ouvrir ». En archive, le plateau indique clairement « ARCHIVE », affiche la date complète et garde un retour direct au mot du jour.

Le sélecteur reste présent pendant le chargement et les erreurs. Les données de la partie précédente sont retirées dès qu’une autre date commence à charger. Une date invalide explique le problème sans lancer de requête ; le serveur répète le contrôle pour les liens directs et les requêtes forgées. Les changements de partie conservent l’annulation des réponses, effets et rappels de focus devenus obsolètes. Une victoire nouvellement acceptée reçoit un retour neutre, sans promettre un gain déjà acquis.

## Contrats

- `lib/calendar.ts` possède la validation des dates civiles, la borne de lancement, la date de la dernière archive et les décalages de calendrier indépendants de la durée des journées.
- `getLegacyArchivePuzzle` réutilise la sélection quotidienne figée, avec l’identité `daily-YYYY-MM-DD` et une référence `archive`.
- GET exige `mode=archive&date=YYYY-MM-DD`. POST exige aussi `date` et `puzzleRef` pour ce nouveau protocole.
- Les anciens protocoles daily, free et challenge sans référence restent acceptés selon leur contrat V1.
- Le profil V2 accepte les nouvelles victoires `archive` et leur `completedAt`, tout en relisant les anciens événements V2 et les bases V1 sans modification.

## Vérifications

- `npm test` : 47 tests passés, 0 échec.
- `npm run typecheck` : passé.
- Construction Sites de production : passée, avec régénération stable des 120 segments sémantiques.
- Dates invalides, pré-lancement, courantes et futures refusées sans score ni rang sur GET et POST, pour proposition et indice.
- Équivalence cible, score, rang et indice contrôlée contre le moteur V1 réel.
- Références falsifiées, identités incohérentes et quotidien expiré refusés.
- Frontières du printemps et de l’automne à Paris vérifiées sans soustraction de 24 heures.
- Victoire archive datée réellement, série inchangée, victoire quotidienne historique prioritaire et reprise concurrente stable dans les deux ordres.

## Limites réelles

- Au premier jour suivant le lancement, une seule archive est honnêtement disponible. Les prochaines dates s’ouvrent automatiquement après leur journée quotidienne.
- Aucun test navigateur n’a été demandé ou effectué. Le rendu, le clavier, le focus et les annonces n’ont donc pas été validés en usage réel.
- Les parties restent des instantanés locaux V1. Le profil demeure personnel et non compétitif.
- Les objectifs, cosmétiques et export ou import restent à implémenter pour terminer B4.
- R2 réel et mémoire Worker restent non qualifiés dans B1.
- Aucune version Sites n’a été sauvegardée ou publiée pour cette tranche intermédiaire.

## Retour arrière et suite

Retour : rétablir les fichiers applicatifs antérieurs à B4b dans un nouveau commit. Conserver toutes les clés `braise.v1.*`, les clés V2 et les copies de secours locales. Aucun binding, stockage distant ou déploiement n’a été créé.

Suite recommandée : ajouter trois objectifs hebdomadaires configurés sur une semaine commençant le lundi à Paris, avec récompenses dédupliquées et indépendantes de la publicité, puis livrer les cosmétiques permanents associés.
