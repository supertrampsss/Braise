# B4c : rituel hebdomadaire et styles permanents

Statut : tranche implémentée et vérifiée. Le lot B4 reste partiel tant que le parcours d’export et d’import n’est pas livré.

## Résultat livré

- Une édition immuable contient exactement trois objectifs variés : proposer 15 mots, jouer pendant 3 jours civils distincts et trouver 2 mots sans indice.
- La semaine commence le lundi et se termine le dimanche selon les dates civiles de Paris, y compris pendant les changements d’heure.
- Les propositions proviennent des événements V2 acceptés, hors indices. Les victoires proviennent de la vue effective dédupliquée et de leur instant réel `completedAt`.
- Les totaux V1 sans horodatage n’inventent aucun progrès. Une archive déjà gagnée ne devient pas une nouvelle victoire hebdomadaire.
- Chaque objectif terminé produit une identité de récompense déterministe et un événement d’acquisition append-only. Les relectures, réconciliations, nouvelles tentatives d’écriture et onglets concurrents ne peuvent ni la multiplier ni la retirer.
- Trois styles permanents sont associés aux objectifs. Ils modifient seulement l’ambiance de marque et l’emblème, sans changer les scores, rangs, indices ou états du jeu.
- Le choix d’un style est un événement local V2 distinct. Il converge entre onglets et survit à une panne d’écriture temporaire.
- Les objectifs et styles ne consultent pas la décision publicitaire et ne demandent aucun visionnage.

## Expérience

La colonne de jeu présente une carte « Trois étincelles » avec la période exacte, trois lignes toujours visibles, un compteur, une barre et l’état « Terminé » écrit explicitement. Aucun bouton « Réclamer » ne ralentit la boucle : un style est acquis automatiquement dès que les faits réels satisfont l’objectif.

La fenêtre « Ma progression » conserve les succès existants et ajoute « Votre style ». Le style classique reste toujours disponible. Chaque autre style affiche son nom, son aperçu, sa condition et un état explicite « Verrouillé », « Équiper » ou « Équipé ». Les contrôles sont des boutons natifs de 44 px et les changements ne déplacent pas le focus vers le plateau.

Sur mobile, la colonne latérale reprend un ordre vertical simple afin d’éviter les cartes comprimées ou réordonnées. Les mouvements restent couverts par `prefers-reduced-motion` et les informations ne reposent jamais sur la couleur seule.

## Contrats

- `lib/weekly-ritual.ts` centralise l’édition, les seuils, les cosmétiques et la projection pure.
- Les récompenses ont la forme `weekly-ritual-v1:lundi:objectif`. Les éditions futures devront ajouter une nouvelle configuration sans modifier rétroactivement celle-ci.
- `ProfileSnapshot.activities` expose la vue canonique utile aux projections sans ajouter de champ aux bases V2 persistées.
- `weeklyRewardEarned` matérialise une acquisition déjà prouvée sans effet transitoire. `cosmeticChanged` est un événement de préférence append-only. Les lots `gameProgress` continuent d’accepter exclusivement propositions et victoires.
- Le calcul de victoire hebdomadaire part de `Profile.wins`, après priorité quotidienne sur archive, et ignore les victoires historiques sans `completedAt`.

## Vérifications

- `npm test` : 60 tests passés, 0 échec.
- `npm run typecheck` : passé.
- Construction Sites de production : passée, avec régénération stable des 120 segments sémantiques.
- Frontières lundi et dimanche contrôlées au printemps, à l’automne et au changement d’année.
- Indices, événements futurs, doublons et historique V1 non daté exclus.
- Seuils, remise à zéro hebdomadaire et conservation permanente des styles vérifiés.
- Préférences cosmétiques persistées, convergentes et récupérées après panne locale.
- Acquisition monotone vérifiée après remplacement tardif d’une victoire archive par sa victoire quotidienne prioritaire.
- Inspection statique du source : trois barres nommées, états équipés ou verrouillés et absence de récupération ou publicité trompeuse.
- Projection regroupée en une passe et mémorisée hors du compteur à la seconde afin de préserver la fluidité avec un long historique.
- Relecture indépendante ASTRA maximale : aucun bloqueur local restant.

## Limites réelles

- Aucun test navigateur n’a été demandé ou effectué. Le rendu, le clavier, le focus, le zoom et les contrastes des styles n’ont donc pas été validés en usage réel.
- Le profil reste personnel, local et non compétitif. Un acquis gardé uniquement en mémoire pendant une panne peut être perdu à la fermeture ; l’avertissement de stockage existant reste visible.
- L’export et l’import contrôlé restent à implémenter pour terminer B4.
- R2 réel et mémoire Worker restent non qualifiés dans B1.
- Aucune version Sites n’a été sauvegardée ou publiée pour cette tranche intermédiaire.

## Retour arrière et suite

Retour : rétablir les fichiers applicatifs antérieurs à B4c dans un nouveau commit. Conserver toutes les clés `braise.v1.*`, les clés V2, les événements de préférence et les copies de secours locales. Aucun binding, stockage distant ou déploiement n’a été créé.

Suite recommandée : terminer B4 par un export lisible, un import contrôlé sans écrasement et des messages de conflit explicites, puis reprendre les lots débloqués par le graphe du programme.
