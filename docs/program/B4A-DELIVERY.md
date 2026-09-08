# B4a : progression locale fiable

Statut : tranche implémentée et vérifiée. Le lot B4 reste partiel. Les archives, objectifs hebdomadaires et cosmétiques permanents ne font pas partie de cette tranche.

## Résultat livré

- Le profil personnel utilise un format V2 distinct, sans modifier ni supprimer `braise.v1.profile`.
- La chaîne V1 exacte est copiée et relue avant migration. Les sauvegardes et bases concurrentes utilisent des clés immuables liées à leur source, donc deux initialisations différentes ne s’écrasent pas.
- Le solde historique V1 est importé une seule fois. Les victoires dupliquées sont réduites à une entrée entière déterministe. Aucune date de réalisation historique n’est reconstruite.
- Chaque réponse acceptée conserve propositions et victoire dans un lot append-only. Les événements ont une identité stable, y compris pour l’identité commune des modes libre et défi.
- Les onglets reconstruisent la progression par union, se rafraîchissent sur les changements de stockage et au retour de visibilité, sans rejouer de célébration, son, toast ou focus.
- Une progression non persistée reste visible en mémoire, traverse les commandes suivantes et est retentée lorsque le stockage redevient accessible.
- Les nouvelles propositions conservent leur heure d’acceptation. Une victoire réconciliée utilise son heure de résolution valide, sans fabriquer une date à partir de la reprise.

## Expérience

Le jeu reste directement accessible. La fenêtre « Ma progression » indique que le profil est personnel, local au navigateur et au format V2. Elle affiche la présence de la copie de secours seulement lorsqu’elle a été réellement vérifiée. Les erreurs de stockage, conflits, données corrompues et versions futures ont un message persistant mais ne bloquent pas la partie.

Les compteurs et le son convergent entre onglets. La partie courante reste un instantané V1 local : jouer simultanément la même partie dans plusieurs onglets n’est pas encore une transaction partagée. Le profil ne constitue jamais un résultat compétitif vérifié.

## Contrats et reprise

- `lib/profile-storage.ts` possède les clés, parseurs stricts, migration, lecture, journal et reprise mémoire.
- `profileV2StartIndex` sépare par position les essais déjà compris dans le solde V1 des nouveaux essais. Les anciens numéros d’ordre, même irréguliers, ne servent pas à recalculer les gains.
- Une métadonnée V2 invalide est retirée sans invalider les essais, indices ou épingles V1.
- Une base inconnue ou corrompue est préservée. Aucun profil vide n’est écrit par-dessus.
- Les modifications tardives de `braise.v1.profile` sont signalées comme conflit et ne sont pas fusionnées additivement.

## Vérifications

- `npm test` : 38 tests passés, 0 échec.
- `npm run typecheck` : passé.
- Construction Sites de production : passée, avec régénération stable des 120 segments sémantiques.
- Migration vérifiée sur les trois fixtures V1 : même profil, mêmes gains, même son, source intacte et copie brute exacte après dix relectures.
- Pannes couvertes : accès au stockage refusé, écriture de secours refusée, activité en mémoire, reprise des écritures, format futur, données corrompues, conflit V1 et timestamp hors domaine.
- Concurrence couverte au niveau du journal : propositions distinctes conservées, même proposition et même victoire dédupliquées, préférence la plus récente conservée.
- Relecture indépendante ASTRA maximale : aucun défaut local bloquant restant après corrections.

## Limites réelles

- Aucun test navigateur n’a été demandé ou effectué. Le rendu, le focus et les annonces n’ont donc pas été validés en usage réel.
- La synchronisation concerne le profil dans le même navigateur, pas plusieurs appareils et pas une autorité serveur.
- Les parties V1 restent des instantanés séparés. Le futur stockage social et compétitif dépend de B6 et d’un binding D1 réel.
- Les archives, objectifs et cosmétiques restent à implémenter pour terminer B4.
- R2 réel et mémoire Worker restent non qualifiés dans B1.
- Aucune version Sites n’a été sauvegardée ou publiée pour cette tranche intermédiaire.

## Retour arrière et suite

Retour : rétablir les fichiers applicatifs antérieurs à B4a dans un nouveau commit. Ne supprimer ni `braise.v1.*`, ni les clés V2, ni les copies de secours du navigateur. Aucun binding, stockage distant ou déploiement n’a été créé.

Suite recommandée : ouvrir les archives passées côté serveur, interdire les dates futures et séparer date du puzzle et date de réalisation. Ensuite, ajouter les objectifs hebdomadaires du lundi à Paris avec déduplication des récompenses.
