# B1a : stockage sémantique segmenté

Statut : implémentation locale contrôlée, B1 non terminé. Le binding R2 du Site reste non configuré, sa lecture réelle et la mémoire du Worker ne sont donc pas qualifiées. Aucune publication ni validation navigateur n'a été réalisée.

## Livraison

- Le corpus V1 figé produit 120 objets BRZ1 immuables. Chaque cible contient ses 30 000 scores int16, rangs de compétition uint16 et indices d'ordre stable uint16.
- Le générateur vérifie l'empreinte du JSON V1 avant conversion. L'index conserve versions, licence, dimensions, métadonnées, chemins, tailles et deux SHA-256 par objet.
- Le lecteur asynchrone vérifie objet compressé, décompression, en-tête, cible, dimensions et objet brut avant de créer les tableaux.
- Le cache LRU est borné à 4 Mio. Quatre lectures peuvent être actives, huit chargements uniques au total ; les appels simultanés pour la même cible sont dédupliqués.
- Le jeu et les indices utilisent ce lecteur. Une panne de stockage renvoie 503 avec une saisie client conservée et aucun score inventé.
- Avec `r2: null`, les segments packagés et le binding Worker `ASSETS` explicite sont le transport provisoire. Dès qu'un binding est déclaré, R2 devient exclusif et aucune erreur R2 ne déclenche de repli vers les assets.
- L'export CC BY-SA historique est diffusé comme flux d'asset, sans importer sa matrice dans le Worker.

## Résultats observés

| Contrôle | Résultat |
|---|---|
| Conversion reproductible | Agrégat identique après reconstruction |
| Équivalence exhaustive | 3 600 000 scores, rangs et positions d'ordre identiques |
| Tests | 22 passés, aucun échec |
| TypeScript | Passé |
| Build | Passé |
| Worker construit | 1,1 Mio sur le système de fichiers, contre 11 Mio avant B1a |
| Matrice V1 dans le Worker | Aucun témoin base64 détecté |
| Mesure Node | Pic RSS observé 107 176 Kio pour le candidat contre 237 780 Kio pour la référence, une exécution séparée par lecteur |
| Runtime Worker compilé | Tentative locale non aboutie, lancement du simulateur refusé par l'environnement |
| R2 réel | Non configuré et non testé |
| Navigateur | Non demandé, non testé |
| Publication | Non réalisée |

Les tailles du Worker sont des tailles de fichiers arrondies rapportées par le système. Les mesures Node sont un point local reproductible, pas une preuve de comportement Cloudflare ni une tendance statistique. Elles ne satisfont pas le seuil de qualification Worker proposé dans le plan.

Les segments représentent 21 607 680 octets bruts et 20 039 248 octets compressés. Le manifeste compact fait 380 041 octets. L'export JSON public V1 de 9 940 146 octets reste packagé séparément pour conserver le téléchargement existant ; il n'est pas importé par le code serveur.

## Suite et retour

Pour terminer B1 : provisionner le binding R2 réel lors d'un jalon de publication autorisé, charger les objets contrôlés, vérifier succès, objet absent et panne, puis mesurer la charge dans le runtime cible. B1 doit rester `partial` jusque-là. B3 peut avancer indépendamment.

Retour : rétablir le lecteur sémantique du commit avant B1a dans un nouveau commit. Conserver les données V1, les sauvegardes `braise.v1.*` et les références de partie. Aucun binding ni aucune donnée distante n'a été créé par B1a.
