# B1f : restauration contrôlée du corpus complet

## Résultat

Une commande unique et reprenable restaure désormais le corpus V2 supprimé du checkout sans modifier V1 ni activer le produit :

```sh
npm run semantic:v2:restore -- --download
```

Sans `--download`, la commande exige la source locale exacte. Avec cette option, elle accepte uniquement l'URL fastText Wikipedia français figée. Aucun argument ne permet de la remplacer.

## Contrôles d'intégrité

La restauration impose avant ingestion le nom `wiki.fr.vec`, la taille de 3 027 096 151 octets et le SHA-256 `bc68b0703375da9e81c3c11d0c28f3f8375dd944c209e697c4075e579455ac2a`. Elle reconstruit ensuite BRV2 et BPI2, les vérifie indépendamment et compare leurs identités, inventaires et manifestes aux empreintes mesurées en B1e. Enfin, elle vérifie le catalogue éditorial sur le corpus restauré.

Le téléchargement reprend un fichier partiel, borne les octets déclarés et reçus, annule les réponses incohérentes, traite les écritures courtes et n'installe le fichier qu'après validation complète. Les verrous concurrents sont exclus par SQLite. Une récupération exige l'identifiant exact du propriétaire abandonné et refuse un processus encore vivant. Les fichiers symboliques, spéciaux, remplacés en cours de transfert et les installations avec écrasement sont refusés.

## Vérifications

- 10 tests ciblés de restauration réussis.
- 167 tests du projet réussis.
- TypeScript réussi.
- ESLint ciblé réussi.
- Build de production Sites réussi.
- Relecture ASTRA maximale : aucun bloqueur après ajout de l'ouverture non bloquante des fichiers spéciaux.
- Relecture Luna du plan de reprise : source, compteurs et empreintes historiques concordants.

## Limites réelles

La source de 3 Go et les sorties `work/` ne sont pas présentes dans ce checkout à la fin de cette tranche. La commande a été testée avec des sources réduites, mais la restauration réelle complète n'a pas été exécutée ici. V2 reste inactif. Le stockage R2 et la mémoire Worker restent à provisionner et qualifier. Aucun test navigateur n'a été demandé ou effectué. Aucune nouvelle version du Site n'est publiée par ce lot.

## Suite

Exécuter la commande avec `--download` dès qu'un transfert sortant durable est disponible, conserver sa sortie JSON comme mesure, puis reprendre les rotations éditoriales par groupes bornés. Après 365 approbations, produire le calendrier immuable. Après 400 approbations et qualification R2/Worker, seulement alors envisager l'activation V2.
