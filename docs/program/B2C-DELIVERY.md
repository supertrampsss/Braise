# B2c : premier lot éditorial borné

Huit cycles réels ont été exécutés séquentiellement sur le corpus complet de 1 013 881 entrées. Chaque ancienne colonne disposait d'une preuve BEE2 durable avant son éviction officielle. Chaque emplacement libéré a ensuite reçu une nouvelle cible, dont tous les scores, rangs et pages ont été générés et vérifiés avant la capture de sa preuve.

Le staging contient toujours exactement huit colonnes : `ciel`, `planète`, `faune`, `jardin`, `printemps`, `hiver`, `cheval` et `étoile`. Les neuf décisions antérieures restent liées à leurs preuves archivées. Le dépôt contient maintenant dix-sept preuves durables, dont neuf correspondent à des colonnes évincées et huit aux colonnes présentes.

Deux spécialistes éditoriaux gpt-6-astra en effort faible se sont réparti la relecture des 96 voisins réels. `ciel`, `jardin` et `cheval` sont approuvés avec trois indices distincts issus de leur preuve. `planète`, `faune`, `printemps`, `hiver` et `étoile` sont rejetés pour ce dossier de douze voisins, sans transformer une preuve numérique en validation éditoriale. Le catalogue atteint dix approbations et sept rejets documentés. Il manque 355 approbations pour créer le calendrier de 365 jours et 390 pour atteindre la livraison principale de 400 cibles approuvées.

Une anomalie DX a été corrigée dans le README : les scripts npm de capture et de vérification portent déjà leur opération, donc la commande documentée ne la duplique plus. Le premier arrêt provoqué par cette documentation n'a corrompu aucune donnée ; la capture de `ciel` a repris sur sa colonne complète et vérifiée.

État honnête : le catalogue V2 reste inactif, V1 et la version privée publiée restent inchangés. R2 et la mémoire Worker ne sont pas qualifiés. Aucun test navigateur ni nouvelle publication n'a été effectué.

La prochaine tranche doit augmenter la profondeur du voisinage éditorial de manière versionnée avant les grands lots suivants. Cinq rejets sur huit demandent explicitement davantage que les douze premiers voisins. À rendement identique, les 400 candidats ne permettraient pas d'atteindre les 365 approbations du calendrier.

Vérifications : le catalogue réel et ses dix-sept preuves ont été relus exhaustivement sur le corpus complet. Les 146 tests, TypeScript, la construction de production et `git diff --check` passent. La relecture gpt-6-astra en effort maximal ne relève aucun bloqueur technique ou éditorial dans cette tranche.

Retour arrière : conserver les dix-sept preuves jusqu'à restauration du staging précédent. Évincer officiellement les huit cibles de ce lot, régénérer et vérifier les huit cibles du checkpoint B2b, puis restaurer sélection et catalogue. Aucun état V1 ni aucune partie utilisateur ne nécessite de migration inverse.
