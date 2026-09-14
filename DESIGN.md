# BRAIZ · Le Foyer

Version de test public : marque **BRAIZ**, domaine **braiz.io**. Voyage, Entre amis, Studio, Laboratoire, intégration et espace serveur restent masqués par `lib/release.ts`. Le jeu principal, ses archives, son aide et le profil local sont les seuls parcours proposés.

Consulter ce contrat pour une modification visuelle. Les corrections explicites d’Antoine et ses maquettes choisies priment. Ce document décrit la direction actuelle ; il ne vaut pas validation visuelle du navigateur.

## Identité et hiérarchie

Un fond encre, une vraie flamme large, une action principale. La flamme reste le centre expressif. Le texte, les réglages et les commandes restent sobres. Garder la famille Foyer choisie, avec une flamme plutôt qu’une pierre. Les autres concepts des planches ne sont pas des thèmes à mélanger.

Accueil : titre court, flamme, Jouer. Jeu : flamme, température réelle, champ et Envoyer, essais. Le burger en haut à droite contient les destinations et le profil. Voyage conserve son chapitre, son étape et sa progression pendant la partie, puis propose l’épreuve suivante. Entre amis affiche uniquement de vraies invitations. Profil affiche uniquement les faits sauvegardés.

## Valeurs implémentées

Source CSS : `app/foyer.css`.

| Rôle | Valeur |
| --- | --- |
| Fond | `#0c0d0e` |
| Surface | `#141617` |
| Surface de saisie/menu | `#17191a` |
| Texte | `#f3f1ec` |
| Secondaire | `#a3a59f` |
| Action | `--braise-action: #f3ecdf` |
| Accent / focus | `#dfbd89` |
| Filets | blanc à environ 9 % |
| Colonne principale et en-tête | 480 px maximum |
| Marges latérales | 28 px, 24 px sur téléphone |
| Police | système, corps 400, titres 450 à 500 |
| Bouton principal | hauteur minimale 56 px, rayon 16 px |
| Champ et bouton Envoyer | rayons 18 et 13 px, bouton 48 px |
| Zones tactiles secondaires | au moins 44 px |

Aligner texte, champs et listes. Une liste emploie des filets, pas une accumulation de cartes. Utiliser des chiffres tabulaires pour les températures. Conserver les couleurs sémantiques froid/chaud. Éviter les flèches décoratives, les statistiques de démonstration et les slogans ajoutés.

## Mouvement et premier affichage

La flamme est une jauge : silhouette entière sombre à 0°, remplissage lumineux de bas en haut selon la meilleure température réelle, embrasement complet à 100°. Sa hauteur reste fixe pour rendre la destination visible. Une proposition plus froide ne diminue pas le niveau acquis. Ne pas ajouter la phrase « 100° = le mot trouvé ». Le composant initialise la chaleur avant sa première image. Les deux posters `public/art/flame-gauge-empty.webp` et `flame-gauge-full.webp` viennent du même shader via `scripts/render-flame-study.py --posters` (idle et hot), avec un masque de remplissage pour toute température. Les modes pause et réduction des animations conservent le niveau. Ne pas réintroduire l’ancien dessin pendant le chargement.

Retour d’interaction : 160 ms, courbe `cubic-bezier(.2,.8,.2,1)`. Le menu apparaît depuis son bouton, avec un déplacement de 4 px et une échelle de .98 à 1. La flamme est l’animation continue ; les commandes restent stables et immédiatement utilisables. Respecter le réglage Animations, la visibilité et `prefers-reduced-motion`. Les effets ne créent jamais de progression.

## Références consultées le 14 septembre 2026

- [TypeUI, animations](https://www.typeui.sh/ui-animations) : feedback de champ et ouverture ancrée des menus. Application locale sobre, aucun pack installé.
- [Refero, fiche Linear](https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1) : hiérarchie des surfaces sombres, filets et espacement cohérent. La palette chaude de Braise est conservée.
- [DesignMD](https://designmd.me/), [Designmd Supply](https://www.designmd.supply/) et [DesignMD Store](https://designmd-store.com/) : spécification explicite des couleurs, composants et états. Ce contrat est propre à Braise ; aucun guide tiers n’est importé comme instruction.
- [CollectUI](https://collectui.com/) : accueil de la galerie consulté ; les exemples de la galerie n’étaient pas exposés dans la lecture disponible. Aucun exemple précis n’est revendiqué.

## Livraison et limites

Vérifier les routes, les états chargement/erreur/réussite et les données réelles. TypeScript et build doivent passer. Inspecter les rendus du shader quand sa géométrie change. Un rendu logiciel EGL ne prouve ni le rendu Safari ni la fluidité d’un iPhone. Garder les tests navigateur au statut non effectué tant qu’ils ne sont pas exécutés dans les conditions autorisées.
