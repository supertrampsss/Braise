# B0 : référence et contrats

Statut : implémenté et contrôlé dans le dépôt. Publication différée au jalon prévu ; la version privée en ligne reste V1. Aucun test navigateur demandé ou réalisé.

## Changements

- Les 120 identités de cibles, l'époque du calendrier, ses coefficients et les versions sont figés dans `data/legacy-v1.json`. Le lecteur historique résout les cibles par identité même si un catalogue est réordonné. Le corpus V1 est conservé avec son empreinte.
- Les métadonnées publiques ajoutent une référence versionnée, sans solution ni index de cible. L'API vérifie les références reçues avant de produire un score ou un indice. Une référence incompatible reçoit 409 ; une requête V1 sans référence reste acceptée.
- L'interface transmet et vérifie cette référence. L'ordre d'essai reste local. Aucun résultat personnel n'est présenté comme un résultat compétitif vérifié.
- Les clés `braise.v1.*` et les règles de lecture sont conservées dans un module partagé réellement utilisé par l'interface. La restauration ne réécrit pas les données et ne crée pas de victoire.
- Les contrats des extensions distinguent contexte, variante, état durable, effet transitoire, progression, contenu et décision publicitaire. Les fonctions correspondantes restent à implémenter dans leurs lots.

## Vérifications

| Contrôle | Résultat |
|---|---|
| `npm test` | 16 tests passés, aucun échec |
| `npm run typecheck` | Passé |
| Construction via le script Sites, exécutant `npm run build` | Passée |
| Diff Git | Aucune erreur d'espacement |
| Revue indépendante | ASTRA `max`, aucun défaut bloquant identifié |
| Spécialiste compatibilité | ASTRA `low`, cas limites et sauvegardes témoins relus |
| Navigateur et validation visuelle | Non demandés, non réalisés |
| Publication de B0 | Non réalisée, jalon de publication ultérieur |

L'oracle a été généré depuis le commit V1 `85b05a71cba67b3283e1a19a1745d2d90570bcd2`, indépendamment du code candidat. Il couvre 122 dates autour du premier cycle de 120 jours, 14 combinaisons mode/seed, 4 frontières temporelles et des scores/rangs témoins pour chacune des 120 cibles. Les tests contrôlent aussi une réorganisation et une extension artificielles du catalogue, exclusivement comme mutations de test.

Trois sauvegardes synthétiques, dont les scores proviennent réellement du corpus, couvrent une partie quotidienne commencée, une victoire et une partie libre avec indice reprise comme défi. Aucun historique utilisateur n'a été lu ou inventé. Les cas de stockage absent, illisible ou refusé conservent un repli sans écriture.

## Mesure et limites

`B0-MEASUREMENTS.json` conserve les résultats bruts et les empreintes du code mesuré. Deux processus Node distincts exécutent le même scénario : chargement à froid puis une proposition, un indice et une sélection quotidienne pour chaque cible. Le corpus source fait 9 940 146 octets. La comparaison locale ne montre pas de hausse matérielle du pic RSS dans cette mesure unique ; elle n'établit ni une tendance de performance ni la conformité à la mémoire du Worker.

La matrice V1 complète reste chargée côté serveur. La qualification du runtime cible et le stockage segmenté restent B1. Les jeux de données futurs doivent être publiés dans une nouvelle version, jamais en remplaçant silencieusement V1.

La correction des confettis rejoués lors de la restauration d'une victoire reste en B3. Les types d'état et d'événements sont prêts, mais ne constituent pas cette correction. La migration du profil, sa copie de secours et la gestion de plusieurs onglets restent en B4.

## Reprise et retour arrière

Prochain travail : B1, vérifier les capacités R2 réelles, préparer les artefacts immuables par cible et comparer le lecteur segmenté au même oracle. B3 est indépendant une fois B0 terminé et peut avancer si cette infrastructure est bloquée.

Retour : rétablir les fichiers applicatifs du commit précédent dans un nouveau commit, puis reconstruire. Ne pas effacer les sauvegardes du navigateur ni modifier les données V1. B0 n'introduit aucune migration D1/R2. Aucun changement de publication n'a été effectué pendant ce lot.
