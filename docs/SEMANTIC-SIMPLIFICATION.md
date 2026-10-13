# Simplification du jeu — 13 octobre 2026

Cette correction suit la nouvelle instruction utilisateur et remplace les choix de guidage de la revue précédente.

Référence de fonctionnement : [FAQ officielle de Cémantix](https://static.certitudes.org/html/cemantix-faq). Les associations et leur ordre viennent du modèle ; aucune liste humaine ne remonte ou ne descend un mot.

- Les explications répétées, commentaires de chaleur, phrase du dernier essai, compte à rebours des indices et téléchargement du signalement sont retirés du plateau.
- Les indices automatiques sont retirés. Une ancienne requête d’indice reçoit HTTP 410, sans proposition ni score ajouté. Les anciens essais marqués comme indices restent lisibles dans les sauvegardes.
- La sélection éditoriale des voisins V1 et son filtre de variantes sont supprimés. Le service V2 n’expose plus ses trois indices choisis à la main.
- Le plateau conserve la température et la progression parmi les 1 000 mots les plus proches : rang 1 → 1 000 ‰, rang 2 → 999 ‰, rang 1 000 → 1 ‰ ; aucune progression n’est affichée au-delà.
- Les scores, rangs, segments numériques, mots déjà joués, archives et profils ne sont pas réécrits. Le calendrier préexistant détermine le mot du jour.

## Ce qu’expliquent les scores d’assiette

Vérification réelle du quotidien du 13 octobre 2026 : impôt 47,20 ° / rang 4 ; impôts 44,20 ° / rang 13 ; taxe 37,40 ° / rang 84 ; bol 34,50 ° / rang 152. Le voisinage contient à la fois beurre, plat et salade, mais aussi fiscale, cotisation et imposition. Il mêle donc les usages culinaires et fiscaux du mot. L’[usage fiscal d’assiette](https://bofip.impots.gouv.fr/bofip/9396-PGP.html/identifiant%3DBOI-RFPI-CTRL-10-20190321) explique une association possible ; la pondération précise dépend du modèle.

## Portée

BRAIZ conserve son modèle [fastText Wikipedia français](https://fasttext.cc/docs/en/pretrained-vectors.html), ses cosinus quantifiés et son dictionnaire actuel. La correction reprend le principe de Cémantix ; elle ne prétend pas reproduire les températures de son modèle Word2Vec ni en posséder les mêmes données. La polysémie peut produire des associations surprenantes même sans couche éditoriale.

Les contenus historiques de qualification et les anciens manifestes restent des preuves, pas des correcteurs de score. Aucun nouveau calendrier, voisin choisi à la main ou transfert de corpus n’est introduit par cette correction.
