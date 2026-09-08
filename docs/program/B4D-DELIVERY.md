# B4d : transfert local contrôlé

Statut : tranche implémentée et vérifiée. Le lot B4 est fonctionnellement terminé ; sa publication privée reste un état séparé.

## Résultat livré

- La fenêtre « Ma progression » télécharge un fichier JSON lisible et versionné qui contient le profil, les récompenses et les préférences.
- Le fichier exclut explicitement les parties en cours et les épingles. Aucun compte, utilisateur ou résultat compétitif n’est créé.
- L’import lit et valide le fichier sans modifier la progression, affiche un résumé, puis exige une confirmation explicite.
- La confirmation revalide l’état local. Si un autre onglet a changé la progression, un nouvel aperçu est imposé avant toute écriture.
- La fusion conserve tous les faits locaux et importés, y compris une activité qui attendait seulement en mémoire après une panne de stockage.
- Un seul lot append-only adressé par son contenu rend l’import visible d’un bloc aux autres onglets. Réimporter le même fichier est idempotent.
- Une source V1 différente, même pas encore migrée, est refusée avant toute mutation. Les bases, copies brutes et événements existants ne sont jamais supprimés ou écrasés.
- Les fichiers futurs, tronqués, trop volumineux, incohérents ou porteurs d’une récompense non prouvée sont refusés avec un message explicite.

## Expérience

Le téléchargement demande un clic. L’import demande le choix du fichier puis une confirmation, sans dialogue imbriqué. Le résumé précise les éléments nouveaux, déjà présents et réconciliés, ainsi que la reprise éventuelle du solde historique. Il dit explicitement qu’aucun changement n’a encore eu lieu.

Les résultats de prévalidation et les erreurs utilisent des régions annoncées. Annulation, réussite et erreur de confirmation rendent le focus au bouton d’import. Les contrôles tactiles mesurent au moins 44 px, se replient en une colonne sur petit écran et respectent le style existant.

Le transfert ne déclenche ni son, toast, confettis, crédit, focus vers le plateau ou annonce de victoire. Les données restent locales et sont seulement déplacées par l’action explicite de la personne.

## Contrats

- Enveloppe : `braise-personal-profile`, version d’export 1, profil V2.
- Portée : `profile-only` ; aucune clé de partie `braise.v1.game.*` n’est exportée.
- Taille maximale : 8 Mio mesurés en octets UTF-8.
- Import : schéma à clés exactes, 50 000 activités au maximum, identités stables, dates non futures et références limitées aux règles réellement produites.
- Les acquisitions hebdomadaires importées doivent être redémontrées par les propositions et victoires du fichier, y compris une preuve historique conservée après réconciliation ; une identité de récompense seule ne suffit pas.
- La base V1 est liée à sa chaîne brute et à son empreinte. Deux frontières distinctes ne sont jamais additionnées.
- Le plan de confirmation lie le fichier à une empreinte de tous les enregistrements de profil locaux et des faits en attente.

## Vérifications

- `npm test` : 77 tests passés, 0 échec.
- `npm run typecheck` : passé.
- Construction Sites de production : passée, avec régénération stable des 120 segments sémantiques.
- Aperçu sans écriture, import atomique, réimport dix fois et convergence des préférences vérifiés.
- Historiques V1 incompatibles, V1 non migrée, copie de secours manquante et migration seulement en mémoire couverts.
- Changement concurrent, panne d’écriture, fichier tronqué, JSON hostile, date future, références incohérentes et limite UTF-8 couverts.
- Une victoire quotidienne historique reprise depuis les archives reste exportable et réimportable.
- Relecture indépendante ASTRA maximale : bloqueurs de frontière, progression mémoire, validation hostile, preuve des récompenses et export partiel corrigés.

## Limites réelles

- Aucun test navigateur n’a été demandé ou effectué. Le rendu, le sélecteur de fichier, le téléchargement, les annonces et le focus n’ont donc pas été validés dans un navigateur réel.
- Le téléchargement est lancé par le navigateur ; Braise ne prétend pas pouvoir vérifier que le fichier a été conservé sur disque.
- Le profil est personnel et modifiable. L’import ne transforme pas ses données en classement ou résultat vérifié.
- Les parties en cours et les épingles restent sur leur appareil d’origine.
- R2 réel et mémoire Worker restent non qualifiés dans B1.
- `npm run lint` reste hors gate et signale les sept erreurs de référence déjà présentes dans `game.tsx`, `game-types.ts` et sa copie d’oracle ; aucun nouvel échec ne concerne le module de transfert, son stockage ou ses tests.

## Retour arrière et suite

Retour : rétablir les fichiers applicatifs antérieurs à B4d dans un nouveau commit. Conserver toutes les clés `braise.v1.*`, les bases et événements V2, les copies de secours et les lots d’import déjà présents. Aucun binding ou stockage distant n’a été créé.

Suite recommandée : reprendre la qualification B1 dépendante d’un binding R2 réel, puis engager B2 avec un catalogue versionné et un calendrier durable. Les interfaces et validations locales indépendantes peuvent être préparées sans présenter R2 comme qualifié.
