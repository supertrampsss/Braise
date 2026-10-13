# Qualification du corpus — phase A, 12 octobre 2026

Le corpus canonique complet et les sauvegardes R2 sont disponibles. Cette phase livre la portabilité Windows, le pilote borné et l’archivage complet des colonnes avant éviction. **Task 7 reste ouverte** : décisions réelles jusqu’à 400 approbations, calendrier de 365 jours, objets runtime R2 et lecteur Worker relèvent de la phase B. Aucun catalogue ou calendrier actif n’a été changé.

## Empreintes et portée

| Élément | SHA-256 |
| --- | --- |
| Source `wiki.fr.vec`, 3 027 096 151 octets | `bc68b0703375da9e81c3c11d0c28f3f8375dd944c209e697c4075e579455ac2a` |
| Manifeste corpus, 1 013 881 entrées, 248 segments | `e1c07accdc55196c180968d710030e938b861bd7b6c7bf2c0f764e030f365cf7` |
| Inventaire sémantique | `8440d4e963ae309c5761818a58bcf752d1aa5750b6b6876d94a055ca177f732d` |
| Index exact, 65 536 feuilles | `77178f6fc85de9d5523db3f13141b751abdeb1c6b2d3ad6a4d020346a795c426` |

La restauration officielle complète a réussi avant cette phase : corpus dans `work/semantic-v2-canonical`, index dans `work/b2`. La colonne partielle non publiée `work/b2/.../targets/0000000091` et l’ancien staging non canonique restent intacts. Aucun verrou n’a été supprimé manuellement.

V1 conserve ses 120 cibles et ses assets canoniques. Le binding R2 existe, mais le sélecteur publié V1 reste sur les assets. Les assertions historiques « aucun transfert R2 possible » sont remplacées par le constat ci-dessous.

## Sauvegardes R2 et restauration

Les [quatre inventaires et le reçu du contrôleur](../program/qualification-2026-10-12/r2-native-qualification.json) totalisent 4 258 556 169 octets et 509 références de fragments de 8 Mio maximum. Chaque fragment a été relu par GET et comparé au SHA-256 local avec Node natif, sans modification d’agent utilisateur ou filtre de sécurité. Les secrets temporaires ont été retirés en révision 7 ; l’ancien accès retourne 404 après déploiement de nettoyage.

Cette phase a contrôlé la cohérence des quatre inventaires et les entrées des deux archives locales : corpus = 250 fichiers + 1 répertoire ; index = 65 794 fichiers + 2 répertoires. Les pointeurs contenus dans les tar renvoient exactement aux manifestes épinglés. Les archives ne contiennent ni lien, ni chemin traversant, ni SQLite/verrou.

Pour restaurer, lire les fragments `semantic-blobs/sha256/<sha256>` dans l’ordre de l’inventaire, contrôler chaque fragment et la taille totale, concaténer, puis comparer le SHA-256 global. Valider noms et types des tar avant extraction dans un staging vide, vérifier les pointeurs/manifeste, puis exécuter les vérificateurs indépendants officiels. Les chemins runtime du corpus, de l’index et des cibles doivent encore être provisionnés en phase B. Le prototype Node du contrôleur n’est pas présenté comme un outil de production testé par cette phase ; aucun nouvel accès distant n’a été effectué ici.

## Pilote et reprise

```sh
node scripts/qualify-semantic-batch-v2.mjs --corpus work/semantic-v2-canonical --targets ../t --evidence work/e7 --archive work/a7 --checkpoints work/p7 --target-ids 140,199,389,648,656,1562
```

Ce premier lot conserve les six colonnes restantes déjà calculées. Pour la suite, fournir les identifiants réels sélectionnés dans le catalogue lexical (maximum 400 identifiants distincts par invocation). Le pilote n’approuve rien. Les cibles 91 et 240 disposent déjà de leurs archives ; les inclure à nouveau entraîne une revérification indépendante de reprise.

Chaque cible passe par : construction officielle si nécessaire (quota par défaut 8, plafond existant 64 inchangé), vérification numérique indépendante, capture BEE2 contrôlée, copie exacte d’`active.json`, du manifeste et de **toutes les pages valeurs et ordre**, puis recontrôle des empreintes source et éviction officielle. Capture, archivage et éviction partagent le même verrou exclusif. Le vérificateur numérique n’est pas relancé entre capture et éviction : son résultat reste dans le processus et tous les objets canoniques sont recontrôlés avant suppression.

L’archive contient aussi le BEE2 et un inventaire immuable SHA-256. Aucun score temporaire, base SQLite ou verrou de génération n’y est copié. Les checkpoints sont installés après sauvegarde et éviction. Une archive sérialisée ne vaut pas preuve numérique : la reprise revérifie les pages contre le corpus et le BEE2 avant d’accepter le checkpoint ; elle termine les évictions interrompues via l’outil officiel. Toute incohérence arrête le lot sans écraser les archives précédentes. La phase B transférera et vérifiera ces objets à distance.

Les journaux par cible contiennent seulement identités SHA et temps d’étape, sans histogramme/manifeste complet. Un verrou de pilote protège chaque répertoire de checkpoints ; le verrou du staging sérialise ses mutations. Checkpoints et archives doivent rester hors du staging. Sous Windows, utiliser les outils Node pour les archives dont certains noms complets dépassent 260 caractères : les temporaires SQLite courts résolvent leur propre limite sans tronquer les identités immuables.

## Preuve canonique et coûts observés

Les [mesures réelles](../program/qualification-2026-10-12/task7a-real-batch.json) portent sur le corpus complet :

| Cible | Construction + contrôle intégré | Contrôle capture | BEE2 | Archive | Éviction | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 91, pays, déjà construite | — | 29,803 s | 17,845 s | 0,143 s | 0,029 s | 47,846 s |
| 240, école, nouvelle | 60,141 s | 31,757 s | 18,353 s | 0,130 s | 0,034 s | 110,427 s |

Le manifeste 91 reste exactement `ee333e66d388b407487e931a1ac38555ced5e2e183b4e0c882a036f1f7a3b155`. Son BEE2 existant conserve `0288d29ce92900f8fce1de464162c6b82e4e3e74b335a3e6571554086350492e`. Le nouveau manifeste 240 est `40266092dbeabcaab6dcd7d99be9971e36e1ed480ea74f67ff60dfd684d21a28`. Chaque inventaire référence 32 pages, le pointeur, le manifeste et le BEE2 : 35 objets par cible.

Le profil CPU initial a rencontré une pause d’échantillonnage de 562,676 s sur 645,679 s : il ne permet pas d’attribuer neuf minutes à une copie mémoire. Un contrôle de trois vrais segments a reproduit leurs octets avec deux tailles de tampon, mais aucune optimisation de décompression ou de calcul n’a été retenue. Les temps ci-dessus sont locaux et ne qualifient pas le Worker.

## Portabilité et contrôles

Les chemins Windows longs, 8.3 et variantes de casse sont acceptés après contrôle de tous leurs composants réels. Les liens symboliques et junctions demeurent interdits pour l’éviction. Les temporaires SQLite conservent l’intégralité du UUID dans un nom court. Un test reproduit l’ancien chemin de 261 caractères. Le test du lecteur concurrent attend explicitement la prise et la libération du verrou.

Suite complète : 261 tests réussis, aucun échec, trois cas explicitement ignorés faute de privilège Windows pour les liens symboliques fichier (`EPERM` uniquement). Les cas de junction répertoire sont exécutés. Les tests couvrent aussi corruption après vérification, échec d’archive avant suppression, immutabilité d’une archive précédente et faux hashes/checkpoint cohérents rejetés par le vérificateur numérique indépendant. TypeScript et la vérification non mutante V1 passent.

## Palier B1 — traitement groupé qualifié, 13 octobre 2026

Le pilote prépare puis traite au plus huit cibles à la fois. Les scores provisoires gardent les checkpoints existants ; aucun pointeur actif n'est publié avant la réussite du contrôle numérique de tout le groupe. Trois frontières indépendantes sont conservées : contrôle des pages avant activation, nouveau contrôle runtime avant éviction, puis oracle éditorial BEE. Chacun lit et valide le corpus complet ; leur calcul ne consomme aucun reçu numérique ni score du producteur comme vérité.

Les accumulateurs restent float64 dans l'ordre initial des dimensions, sur les mêmes entrées float32. Le producteur trie les identifiants par comparaison score décroissant / identifiant croissant ; le vérificateur reconstruit l'ordre par comptage stable indépendant. À 1 048 576 entrées maximum, les tableaux du producteur représentent 6 Mio par finalisation et ceux du vérificateur au plus 10 Mio par cible, donc 80 Mio pour huit. Ce sont des bornes sur les tableaux de données, pas sur toute la mémoire Node. Au-delà, SQLite est conservé ; les tests peuvent aussi le forcer. Le format, le gzip canonique, les hashes, les rangs uint32 et les quotas 8 par défaut / plafond 64 restent inchangés.

Capture, oracle BEE groupé, archivage et éviction partagent le même verrou exclusif. Le résultat numérique original reste privé ; le callback reçoit une copie. Toutes les archives sont validées, puis tous les objets canoniques sont relus avant la première suppression ; chaque cible est encore contrôlée juste avant son renommage. L'identité du corpus est relue avant activation et éviction. Les refus de liens, les UUID complets, les verrous vivants et les journaux d'éviction demeurent applicables. Une reprise à partir d'une archive recalcule les preuves runtime et BEE ; les checkpoints n'en dispensent jamais.

### Mesures réelles et égalité

[Premier lot réel](../program/qualification-2026-10-12/task7b1-group8.json) : 1619,1344,2069,1767,1502,1987,898,1488, le 12 octobre. Préparation groupée mais trois oracles scalaires et finalisation SQLite : 1 174,651 s pour huit, soit 146,831 s/cible en incluant la préparation commune. La finalisation plus le contrôle de construction prenait 65,785–68,783 s/cible ; les deux autres oracles environ 35–37 s chacun.

[Lot final réel](../program/qualification-2026-10-12/task7b1-final-group8.json) : 1572,493,372,848,69,198,239,502, le 13 octobre. Les SHA des cinq scripts exécutés sont inclus dans ce rapport. Résultat : **164,119 s pour huit**, soit 20,515 s/cible en moyenne, CPU 168,125 s, RSS maximal 218096 Kio. Préparation 33,155 s ; finalisation 1,167–1,495 s/cible, dont tri 0,424–0,661 s ; oracle avant activation 40,454 s pour huit, runtime 44,736 s, BEE 31,324 s, archives 1,614 s et évictions 0,593 s.

Les seize manifestes obtenus sont **strictement identiques** aux manifestes contenus dans les preuves historiques sélectionnées par leur exact approvalReview.evidenceSha256. Cela lie les hashes de chaque page valeurs et ordre, brute et comprimée, et le contrôle indépendant les a effectivement lues. Les archives runtime et preuves fraîches sont conservées ; les références et décisions éditoriales historiques restent intactes. Le premier et le second lot concernent des cibles différentes sur un hôte partagé, à des dates différentes : leur ratio observé n'est pas un benchmark contrôlé universel. La suite intermédiaire 44401 a subi une suspension d'hôte de 13 h 42 ; son temps est exclu des mesures. Aucun job numérique ne tournait pendant cette suspension.

Le contrôle préalable 91 comparait [SQLite](../program/qualification-2026-10-12/task7b1-sqlite.json) et [mémoire](../program/qualification-2026-10-12/task7b1-memory.json) : 97,673 s contre 57,014 s, preuve entière identique SHA 900d2bdf2b6ea2245b74dfc1472b73c74211ebcaf5a797aac2a4e27fd1020d82. Il précédait les autres optimisations et n'est pas le temps final du pilote.

### Exécution suivante et portée restante

Interface CLI inchangée : les six arguments corpus/targets/evidence/archive/checkpoints/target-ids, maximum 400 identifiants distincts, groupes internes ≤8. Les événements de temps concernent désormais explicitement le groupe ; les checkpoints immuables individuels gardent leur format.

Après revue indépendante B1, le prochain lot manquant identifié est :

    node scripts/qualify-semantic-batch-v2.mjs --corpus work/semantic-v2-canonical --targets ../t --evidence work/e7 --archive work/a7 --checkpoints work/p7 --target-ids 865,1467,1627,335,536,558,826,1051

Les seize cibles des deux mesures doivent être retirées de la liste restante du contrôleur. Il y a 32 archives réelles et 365 candidats numériques restants dans cette liste ; **ce ne sont ni 365 approbations ni un calendrier disponible**. Le staging est vide après les évictions. Toute archive réincluse subit les contrôles de reprise, sans confiance dans un reçu. La longue exécution attend la revue B1 ; ce palier ne publie rien et ne termine pas Task7.

Validation ciblée finale : 43 tests réussis, 0 échec, 0 skip, dont égalité huit cibles avec le chemin SQLite scalaire, faux checkpoints cohérents refusés avant toute activation, rangs/ordre falsifiés avec hashes recalculés, corruption tardive du corpus, échec d'archive de groupe, préservation d'archives précédentes et test SQL forcé du chemin Windows 261 caractères. La suite complète lourde reste la recette finale Task8 ; elle n'est pas répétée à chaque palier.

TypeScript et build vérifié finaux : exit0. Le build recontrôle V1 sans mutation (source 7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16, 120 cibles). Aucun serveur ni publication n'a été lancé.
