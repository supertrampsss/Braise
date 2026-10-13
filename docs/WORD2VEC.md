# Corpus Word2Vec BRAIZ

Les nouvelles éditions classiques utilisent le modèle public Word2Vec français **frWac_non_lem_no_postag_no_phrase_500_skip_cut100.bin**, de Jean-Philippe Fauconnier : 155 562 entrées source, 500 dimensions, toutes conservées dans les calculs et les rangs.

Les poids exacts du service Cémantix ne sont pas publiquement identifiés : ce corpus ne promet donc pas les mêmes températures. Les associations fiscales ou culinaires d'« assiette » sont celles du modèle, sans correction thématique ni sélection de voisins.

## Source et attribution

- Auteur : [Jean-Philippe Fauconnier](https://fauconnier.github.io/#data).
- [Binaire source](https://embeddings.net/embeddings/frWac_non_lem_no_postag_no_phrase_500_skip_cut100.bin).
- Licence : [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Les objets BRAIZ dérivent de ces vecteurs par calcul de cosinus, quantification et classement ; les vecteurs source ne sont pas modifiés.
- Taille épinglée : 312 726 847 octets.
- MD5 publié : `af38908c244dce973e289c70a4ce7242`.
- SHA-256 contrôlé : `d617b3a27db256c5fdf39483ed9caa07424b3446813503d936e7fd972592790a`.
- Identité : `frwac-word2vec-155562-d617b3a27db2-v1`.

## Présence et correspondances de secrets

L'union des 120 secrets historiques et des 406 entrées éditoriales comporte 475 mots. Trois graphies demandées sont absentes du modèle : `œuf`, `sœur`, `cœur`. Leurs graphies source `oeuf`, `soeur`, `coeur` sont réellement présentes. La **sélection des secrets des nouvelles éditions seulement** utilise ces trois correspondances explicites. Les 120 emplacements historiques gardent leur ordre avec `oeuf` au nouvel emplacement d'`œuf`. Les 475 secrets de la nouvelle édition sont présents et disposent chacun d'une colonne.

Les propositions utilisent un lookup exact : les ligatures absentes restent inconnues, aucune conversion `œ→oe` ni alias approximatif n'est ajouté. Les données, températures, sauvegardes et calendriers fastText historiques restent figés. Le manifeste liste les trois absences initiales et leurs correspondances de secrets séparément du vocabulaire source.

La canonisation applique espaces externes retirés, minuscules françaises, Unicode NFC et apostrophe `’→'`. Elle produit 19 groupes de collision (38 lignes source). Chaque ligne conserve son identifiant et participe au rang ; le lookup utilise le premier identifiant source du groupe. Aucune ligne n'est écartée. Les groupes complets, formes source et identifiants sont documentés dans `data/word2vec-index.json`, champ `canonicalCollisions`. Certaines formes du vocabulaire peuvent rester inhabituelles : aucun filtre lexical n'est appliqué.

## Contrat numérique et format

Le cosinus porte sur les composantes float32 originales promues avant les opérations, avec accumulation float64 et renormalisation des deux vecteurs. Les composantes et normes de toute la source sont contrôlées : aucune composante non finie et aucune norme nulle. Les normes mesurées vont de 0,01312860169519757 à 14,954481399346953.

Le rang est ordinal : la cible exacte d'abord, puis cosinus **avant arrondi** décroissant, puis identifiant source croissant en cas d'égalité. Les 155 562 lignes participent, y compris les collisions canoniques. Une température stockée vaut `floor(cosinus × 10000 + 0.5)`, bornée entre -10000 et 9999 hors cible ; seule l'identité exacte porte 10000 et le rang 1. Le lecteur renvoie exactement ce score divisé par 100, soit deux décimales et un maximum de 99,99 hors victoire, sans nouvel arrondi. Une proximité élevée n'est jamais une identité.

Chaque objet BWS1 a un en-tête little-endian de 32 octets : magic `BWS1` à 0, version uint32 1 à 4, nombre de lignes à 8, identifiant source du secret à 12, offset des scores à 16, offset des rangs à 20, longueur brute à 24, réservé zéro à 28. Suivent 155 562 scores int16 puis 155 562 rangs uint32. Le gzip est déterministe : date zéro, sans nom de fichier, niveau 9 et byte OS 255.

Le manifeste serveur contient les 155 562 mots alignés aux identifiants, la provenance, les collisions, les correspondances et les tailles/SHA-256 de chaque objet compressé et brut. Il ne doit jamais être importé côté client.

## Stockage et contrôles

`lib/word2vec.server.ts` utilise explicitement `env.ASSETS`, indépendamment du stockage R2 historique. Il valide taille compressée, empreinte compressée, décompression bornée, empreinte brute, en-tête et identité. Objet absent, binding absent, corruption ou échec de lecture produisent une erreur de stockage, sans repli sémantique. Un mot inconnu renvoie `null`.

Les 475 objets portent l’extension `.bws` et contiennent les octets gzip épinglés. Une extension `.gz` faisait déclarer `Content-Encoding: gzip` au serveur statique : `fetch` décompressait alors la réponse avant sa validation. Le renommage conserve toutes les empreintes et tous les scores ; le lecteur conserve un seul contrat compressé, sans accepter un second format brut. L’attribution publique est accessible dans Confidentialité et dans `/semantic/word2vec-NOTICE.txt`.

## Éditions classiques et reprise

À partir du 13 octobre 2026, minuit à Paris, les nouveaux plateaux quotidiens, libres, collections et défis utilisent les références `daily-w2v-YYYY-MM-DD` et `free-w2v-SEED`, les règles `word2vec-v1` et le calendrier `paris-daily-word2vec-v1`. La première journée conserve `assiette`. Ensuite, le hash FNV-1a de `paris-daily-word2vec-v1:DATE` sélectionne un emplacement parmi les 475 cibles du manifeste immuable. Une archive restitue exactement le même secret. Les graines libres/défis conservent le même emplacement historique parmi les 120 secrets attestés ; les évaluations et les rangs portent toujours sur les 155 562 entrées.

Le paramètre de reprise `edition` transporte `classic-v1`, `classic-v2` ou `word2vec-v1` dans l’URL et le GET. Le POST transporte la `puzzleRef` complète. Les anciennes éditions utilisent leur lecteur et leurs données figées. Les anciennes sauvegardes restent sous leur propre identité : leurs températures ne sont jamais copiées dans une édition Word2Vec. Voyage lit les deux identités et reprend une sauvegarde historique non vide dans son propre moteur. Les victoires de collection des deux éditions conservent le même secret et la progression acquise.

Les nouveaux documents de partie déclarent `schemaVersion: 3`, leur référence complète et des rangs jusqu’à 155 562 ; ils refusent les indices et les identités incohérentes. Les exports de profil et copies de synchronisation qui contiennent cette édition déclarent la version 3 et acceptent explicitement les faits historiques V1/V2. Les formats historiques restent acceptés. Une répétition de transfert ou de reprise ne crédite pas de nouveau les faits existants et ne déclenche pas de célébration de victoire restaurée.

Le cache LRU de tableaux décodés est borné à 4 Mio. Au plus quatre objets distincts sont chargés simultanément ; les lectures d'un même objet partagent leur promesse. Un échec reste réessayable. Le cache n'inclut pas le manifeste ni les buffers transitoires ; sa borne n'est pas une mesure de mémoire totale du Worker. La qualification publiée relève du contrôleur.

Livraison : 475 objets, 443 366 900 octets bruts, 329 587 952 octets compressés (314,32 Mio), objet compressé maximal 702 359 octets, manifeste 1 893 810 octets. Chaque objet reste sous 25 Mio. Le binaire source reste sous `work/`, ignoré par Git.

## Reconstruction et oracle

Python 3.13 et NumPy 2.3.1 ont été utilisés, sans gensim et sans nouvelle dépendance Worker. Depuis la racine du dépôt, déposer le fichier épinglé dans `work/word2vec-source/`, puis lancer :

```powershell
$env:OPENBLAS_NUM_THREADS = '2'
python scripts/build-word2vec.py
python scripts/verify-word2vec.py
npm test
npm run typecheck
npm run build
```

`--source`, `--root` et `--report` permettent de préciser les chemins. Le générateur contrôle le fichier entier (taille, MD5, SHA-256, en-tête, EOF, vecteurs et normes), puis calcule des lots de 16 cibles. Il n'utilise ni limite de vocabulaire ni liste de voisins.

Le vérificateur n'importe aucun calcul du générateur : il relit la source en streaming, recalcule séparément normes et produits scalaires float64, et contrôle **73 891 950 températures et 73 891 950 rangs**, toutes les correspondances mot/identifiant, les 120 emplacements historiques, chaque en-tête et empreinte et l'inventaire des 475 fichiers. Il utilise une réduction NumPy indépendante du produit matriciel BLAS du constructeur et un tri stable distinct. Les rapports locaux sont `work/word2vec-build-report.json` et `work/word2vec-verification.json`.

Observations de la colonne « assiette » (score stocké et renvoyé en centièmes de degré) :

| Proposition | Température stockée | Rang |
|---|---:|---:|
| impôts | 39,66 | 42 |
| taxe | 35,79 | 138 |
| roti | 35,05 | 179 |
| bol | 33,02 | 296 |
| rôti | 32,44 | 341 |
| institut | 1,53 | 105 341 |

Ces observations sont couvertes par les tests et recalculées depuis la source par l'oracle. Les anciennes éditions ne sont pas reconstruites avec ce corpus.
