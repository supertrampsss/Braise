# Task 7B2 — première revue éditoriale en lecture seule

13 octobre 2026. Livrable : work/qualification/editorial-agent-review/recommendations.json.

## Résultat

**80 dossiers, 5120 voisins réellement lus intégralement, 71 recommandations favorables, 9 demandes d'extension.** Les 71 trios comportent exactement trois mots français littéraux distincts, soit 213 indices, avec leur id, score et rang exacts. Leur progression est strictement croissante en score et décroissante en rang. Aucune décision n'a été inscrite au catalogue ; aucune approbation indépendante ou activation n'est revendiquée.

Propriété figée dès le début dans work/qualification/editorial-agent-review/ownership.json : 80 IDs parmi les dossiers complets de work/e7, appartenant à la sélection lexicale et sans décision approuvée historique dans data/editorial-v2-selection.json. Les exclusions comprennent les huit dossiers des notes initiales et les huit entrées du controller-editorial-review-batch1.json, soit 16 IDs explicites, même si le dispatch annonçait 15. Snapshot communiqué immédiatement au contrôleur. Les 16 IDs du batch2 du contrôleur ne chevauchent pas ces 80 ; ils sont réservés pour les exclusions d'un éventuel prochain lot, sans modifier le snapshot actuel.

## Méthode et preuve exacte

loadActiveCorpus officiel a contrôlé le corpus canonique work/semantic-v2-canonical. loadEditorialEvidence officiel a chargé chaque dossier de work/e7 avec expectedSha256 fixé au snapshot : contrôles des SHA, du contenu, des références et de la chaîne de révisions. Une copie locale de lecture est dans dossiers.json. Seuls les 64 voisins effectifs de chaque dossier ont été affichés et lus, en huit séries de dix ; aucune sélection automatique d'indices n'a été appliquée.

Les choix et motifs spécifiques ont été rédigés dans decisions-01.json à decisions-08.json. reviewedAt est l'heure réelle de sauvegarde de chaque série de décisions après sa lecture (mtime du fichier de brouillon), non une date historique réutilisée. Actor /root/corpus_qualification, kind agent. Le validateur de scratch a rechargé les 80 preuves officielles avec le SHA attendu, vérifié les IDs propriétaires et l'absence d'approbation historique, résolu les trois mots choisis littéralement et contrôlé l'unicité et les inégalités strictes des scores/rangs. Validation finale réussie le 2026-10-13T07:29:19.571Z.

Chaque recommandation conserve evidenceSha256, targetManifestSha256, fichier exact et supersedesEvidenceSha256. Aucun lien de succession n'a été créé ; aucune preuve historique n'a été substituée. Ce passage de lecture contrôle l'intégrité des dossiers et les indices ; il ne refait pas les calculs numériques exhaustifs déjà qualifiés par la production.

## Extensions recommandées

- 43 naissance : voisinage biographique encombré de collages ; grandit utile, mais lieu trop général et mort/décès redondants. Trois indices autonomes restent à trouver.
- 118 guerre : presque exclusivement noms de conflits collés et flexions ; mondiale seul ne suffit pas.
- 151 famille : nombreuses déformations et classifications latines ; les trois termes aristocratiques disponibles seraient un trio trop étroit et répétitif pour la parenté courante.
- 517 cinéma : films et hollywoodien utiles, reste dominé par dérivés et noms en ciné-/ciném-.
- 631 sport : collages commerciaux et flexions quasi exclusifs, aucun trio de notions autonomes.
- 658 radio : télévision et diffusant ne suffisent pas ; sigle fm et dérivés répètent trop directement la solution.
- 920 science : biais massif science-fiction et dérivés ; fiction et futurologie seuls ne fondent pas trois indices distincts du savoir scientifique.
- 932 montre : sens verbal montrer et contexte cycliste dominants, aucun trio horloger pour la cible classée objets.
- 1207 arbitre : siffle, récuser et récusation ne donnent que deux relations distinctes ; noms propres et flexions dominent.

Ces réserves concernent les dossiers actuels de 64 voisins, non un rejet lexical définitif : extension réelle ou remplacement à décider ultérieurement par la chaîne officielle. Aucun indice absent n'est inventé.

## Sens et difficulté à reprendre lors de l'intégration

Les recommandations favorables 845 chambre, 940 chaîne et 1017 pièce reposent respectivement sur le sens parlementaire, le canal télévisuel et l'œuvre dramatique. Une catégorie cohérente doit être choisie explicitement, sans prétendre que le dossier étaye la pièce à coucher, la chaîne métallique ou la monnaie. 1200 bureau est administratif. 121 saison mêle télévision et compétition ; 383 corps est anatomique malgré les corps militaires ; 554 voix et 1154 mémoire conservent une polysémie explicitée dans leur motif.

Les indices de 837 rugby, 1021 portail, 1041 économie, 1051 bibliothèque et 1134 moteur demandent des connaissances sportives, architecturales, économiques, documentaires ou mécaniques. Ne pas leur attribuer mécaniquement une difficulté facile. Les mentions de genre et parenté sont factuelles ; aucun métier n'est présenté comme réservé à un sexe.

## Limites de propriété respectées

Écritures uniquement dans work/qualification/editorial-agent-review/ et le présent rapport. Aucun fichier suivi, script producteur, catalogue, data/, index de preuve, archive ou staging modifié. Aucun calcul numérique, serveur, agent, commit, publication, transfert ou configuration. Le job du contrôleur et le rédacteur Task8A conservent leurs propriétés. Le rapport porte uniquement sur ce premier lot de 80 ; Task7B2 et l'objectif 400/365 restent ouverts.

Batch3 contrôleur également réservé pour toute sélection future : 1445,1563,1626,1666,1668,1734,1735,1738,1752,1781,1788,1813,1832,1880,1896,1919. Exclusions conservées dans next-batch-exclusions.json ; aucune modification du snapshot80.

SHA256 des livrables figés : ownership.json 158f9cf3c3f102e9b79ccfc07fc99f6287851eba46277a166394075341f9737e ; recommendations.json a061c4849cf65192465c014c62c3606c7e9cbb1bf6845be5da66d521d327f937.

## Deuxième lot — 13 octobre 2026, lecture seule terminée

Livrable work/qualification/editorial-agent-review/batch2/recommendations.json. Snapshot annoncé au contrôleur dès sa création : batch2/ownership.json, **71 dossiers complets disponibles** après exclusion des 80 précédents, des 48 dossiers contrôleur (notes initiales et batch1/2/3) et de toute approbation historique. Aucun ajout après le snapshot pendant la progression du job numérique.

**71 dossiers, 4544 voisins intégralement lus, 69 recommandations favorables et 2 extensions nécessaires.** Les 207 indices retenus ont été choisis après lecture de tous les voisins, puis résolus littéralement et revérifiés avec id/score/rang par loadEditorialEvidence officiel et le SHA du snapshot. Trois indices distincts par avis favorable ; score strictement croissant et rang strictement décroissant. Aucun trio automatique. Actor /root/corpus_qualification, kind agent ; reviewedAt reprend l'heure réelle de sauvegarde de chacune des sept séries de décisions après lecture/relecture. Dernière validation complète le 2026-10-13T07:37:23.385Z, sans recalcul numérique exhaustif.

Extensions :

- **1923 tente** : les 64 voisins relèvent du verbe tenter ; aucun trio pour l'abri de campement. Extension ou remplacement de la cible nominale, sans substitution silencieuse de sens.
- **1984 fontaine** : seuls abreuvoir et lavoir donnent des indices courants autonomes ; le reste est essentiellement toponymes, fragments et dérivés. Un troisième vrai voisin doit être recherché dans un dossier étendu.

Sens/difficultés à décider explicitement avant intégration : **2146 échelle** est une graduation ou un rapport de mesure, pas l'objet à barreaux, donc reclassement conceptuel à examiner. **3044 dimension** s'appuie sur hypersphère(id191456,5537,r65), euclidien(id29716,5559,r64), singularité(id24312,5597,r63) : trio exact et cohérent mais mathématique très spécialisé, recommandation uniquement pour une difficulté élevée, jamais facile. **2598 pensée** est philosophique ; **2798 chiffre** est orienté valeur numérique/financière ; **2515 échec** signifie revers ; **1930 huile** mêle peinture et substance alimentaire. Ces réserves sont dans les rationales individuelles, sans reclassification canonique à ce stade.

Bilan des deux lots de cet agent : **151 dossiers et 9664 voisins lus ; 140 recommandations favorables, 11 besoins d'extension**. Ce sont des recommandations de l'agent, pas 140 nouvelles approbations persistantes. Les décisions historiques exactes et les autres avis restent intacts.

Écritures de ce deuxième passage limitées à work/qualification/editorial-agent-review/batch2/ et à cet append. Aucun fichier suivi, index de preuve, archive, staging ou catalogue changé ; aucun job numérique, serveur ou agent lancé. Les productions du contrôleur et Task8A continuent sous leur propriété. J'attends désormais le dispatch explicite de production 7B2 avant toute intégration ou extension.

SHA256 batch2 : ownership.json e28941a94ba1590b693adbb6352f1299de982dbe3e1196b780070e7743ae8435 ; recommendations.json 8f0f90c2005a7eec5bc7f0d48074b880f4e05e149a1a9711d2f297f682c122a7.

## Troisième lot — 13 octobre 2026, lecture seule terminée

Snapshot annoncé au contrôleur : work/qualification/editorial-agent-review/batch3/ownership.json, **30 nouveaux dossiers complets**, sans collision avec les 151 dossiers précédents, les 48 du contrôleur ou les approbations historiques. Aucun ajout après ce snapshot. Livrable batch3/recommendations.json.

**30 dossiers / 1920 voisins intégralement lus / 29 avis favorables / 1 refus du dossier actuel : témoin4368.** Ses voisins sont dominés par les noms de toreros et rôles tauromachiques. Subornation et dénonciateur donnent deux appuis judiciaires ; le contexte de parrain ne constitue pas un troisième indice assez clair pour le sens courant. Le champ recommendation vaut rejected pour ce dossier. Un remplacement réel est envisageable ; toute évolution de capture demeure une décision future explicite.

Les 87 indices des 29 avis favorables sont littéralement présents, distincts et strictement progressifs en score/rang, contrôlés avec le loader officiel et le SHA du snapshot. Actor/time exacts comme dans les deux lots précédents. Le premier contrôle a détecté l'ordre inversé du duo octobre/équinoxe ; réordonné selon les vrais scores, de même que pédagogue/école lors de l'auto-relecture. Les mots choisis n'ont pas été remplacés pour cacher un échec. La validation complète finale passe, sans calcul numérique ni changement de preuves.

Sens/difficulté : défenseur2431 est sportif ; lecteur3494 retient la personne lisant malgré les appareils voisins. Roche2544 repose sur poudingue/granulite/granitique, trio géologique spécialisé. Traducteur4236 repose sur linguiste/lexicographe/philologue, trio savant. Ces difficultés sont explicites dans leurs rationales, sans classement automatique facile.

Précision sur les réserves des lots précédents : le schéma actuel capture 12 voisins en version1 et 64 en version2. **Aucune extension à 256 n'existe ni n'est revendiquée.** Les anciens champs extension-required expriment uniquement un besoin éditorial non résolu dans le dossier64 ; ils ne décrivent pas une fonctionnalité disponible. Pour atteindre 400 cibles valides, le contrôleur peut rejeter ces dossiers et commander de vrais remplaçants ; toute évolution de schéma nécessiterait un périmètre explicite après le job gelé.

Cumul de cet agent : **181 dossiers / 11584 voisins effectivement lus / 169 recommandations favorables / 12 dossiers actuellement insuffisants.** Aucune décision canonique ajoutée. Écritures limitées à batch3/ et à cet append ; aucune production, extension, archive, index, donnée suivie, serveur ou job modifié. Attente du prochain dispatch explicite.

SHA256 batch3 : ownership.json d3be9c3513eb3a2660676efd02e397c72f6d0bee4d465b23a1cddbc977fc1d89 ; recommendations.json 5c7bbfe3928736d3603305403dc28053e147d0e63990dfa1cf4ef5ce72d7b84b.

## Batch4 partiel — interruption pour correction transport

Snapshot immuable106originaux restants : batch4/ownership.json, SHA490e6f7762778cee61ce53309482883e9a136346f60cfcc2b8a4aa6c3109e8ee. Au13/10 08:35:15UTC :60dossiers/3840voisins réellement lus,57avis favorables/3rejets (2537bandeau,2721dragon,3418ivoire), trios progressifs exacts validés par loader officiel. batch4/recommendations-partial60.json SHA2ab2f1d1381857d569e2feba608c4bb848ce0da73a5c49d0e7524e790aae490e. Sens spécialisés explicités dans reviewedSense et rationales.46dossiers du snapshot restent non lus ; pas de revendication de106revues. Pause demandée par contrôleur pour correctionI1transport, sans catalogue ni données canoniques modifiés.

## Batch4 complet — 13 octobre

106dossiers/6784voisins réellement lus ;99recommandations favorables/7rejets :2537bandeau,2721dragon,3418ivoire,3644palette,3692aube,3928virus,4188dôme. Recommandations finales batch4/recommendations.json SHA009c46db954aa450cfc15ad837b4ee06b6914eda2b8ff3bc965451da7ddf0cf8. Les60faits et leurs dates du partiel sont deepEqual aux originaux ;46nouveaux faits ont leurs heures effectives. Une saisie relief pour3555colline a été refusée par le contrôle de présence littérale puis remplacée par tertre réellement présent ; rationale et heure de cette correction sont consignées, aucun indice absent n’a été validé.

400candidats initiaux tous revus, projet de bilan375favorables/25rejets en incluant historique62/3 et contrôleur45/3 ; comptage canonique encore à produire. Les32remplaçants choisis sont dans replacement-plan32.json ; présence réelle pinnée vérifiée parmi67propositions nouvelles, aucune approbation numérique/éditoriale implicite. Pilote officiel par groupes8 lancé vers ../t, work/a7/e7/p7 sous session96338, log work/qualification/replacements32-numeric.log, après autorisation explicite et fin réelle du job365du contrôleur. Les397archives antérieures ne sont pas recalculées.
