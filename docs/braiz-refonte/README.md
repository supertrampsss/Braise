# BRAIZ : audit et refonte (30 octobre 2026)

Demande d'Antoine : même travail de refonte que pour 500 Signatures (audit, direction, prototype animé, implémentation). Ce dossier sert de passation, car le site en ligne n'est pas construit depuis ce dépôt.

## Constat de livraison

- `braiz.io` est publié depuis la source canonique Sites (`.openai/hosting.json`). L'interface en ligne (marque `BRAIZ.`, flamme image, rangs « 394e », « Prochain mot dans ») n'existe pas dans ce miroir GitHub, dont `components/game.tsx` affiche encore l'ancienne interface « braise ».
- Une modification de ce dépôt ne change donc pas `braiz.io`. Le portage se fait dans la source Sites, sur la base de `docs/BRAIZ-APPROVED-DESIGN.md` (branche `design/approved-ember-braiz`) et du prototype ci-dessous.

## Audit du site en ligne (1440 et 390 px, partie de 8 essais)

1. **Le dernier essai se cherche.** La réponse au mot envoyé s'insère dans la liste triée ; sur 8 essais, « arbre » arrive en 5e ligne. Le joueur doit lire toute la liste après chaque envoi.
2. **Couleurs de proximité incohérentes avec la métaphore.** 394e en jaune, 4 068e en vert, puis gris : le vert ne dit pas « tiède ». L'échelle doit suivre la braise : cendre, ambre, braise, or.
3. **La flamme est belle mais seule.** Rien ne se passe au moment d'un nouveau record : pas de signal entre l'essai et la flamme.
4. **Pourcentage ambigu.** « 48 % » sous la flamme ne dit ni ce qu'il mesure ni par rapport à quoi ; le brief approuvé parle de température (°) et de rang.
5. **Architecture sombre partout.** Le brief approuvé demande la nuit en haut (titre, flamme, meilleure piste) et l'ivoire en bas (saisie, historique). Le site en ligne est entièrement sombre et sans titre « Devinez le mot secret du jour. ».
6. **Bouton Envoyer peu contrasté** (texte foncé sur terracotta) et deux pieds de page successifs (« À propos · Confidentialité » puis le bloc éditorial).

Captures : `avant-ordinateur.png`, `avant-mobile.png`.

## Direction retenue dans le prototype

- Nuit en haut : marque, contexte « Mot du jour n° 054 », nombre d'essais, titre approuvé, meilleure température en grand, meilleure piste, paliers Top 1000 / 100 / 10 / Trouvé.
- Flamme vivante, révélée du bas vers le haut selon la meilleure température acceptée ; elle ne redescend jamais. Étincelles rares au nouveau record, gerbe à la victoire. Boucle arrêtée hors écran, onglet masqué et en mouvement réduit.
- Ivoire en bas : saisie collante, carte « dernier essai » juste sous le champ (température qui monte, rang, verdict court), puis l'historique trié avec barres et échelle de chaleur légendée.
- Erreurs explicites (mot vide, doublon, indice avant 5 essais).

Le prototype (`prototype.html`, autonome) utilise des températures d'exemple fixes. Il ne lit pas le corpus et ne remplace pas l'illustration de flamme approuvée : au portage, garder la ressource locale validée et n'en reprendre que la révélation, le mouvement et la mise en page. Capture : `prototype-mobile.png`.

## Contrôles à faire au portage

Ceux de la section 7 de `docs/BRAIZ-APPROVED-DESIGN.md` : états de partie, 320 / 390 / 768 / 1440 px, clavier mobile, mouvement réduit, repli sans WebGL, puis vérification de l'URL publique.
