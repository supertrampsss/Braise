# B1g : restauration réelle du corpus complet

## Résultat

La commande de restauration contrôlée B1f a été exécutée avec le téléchargement réel. Elle a installé puis vérifié la source fastText française complète de 3 027 096 151 octets, reconstruit le corpus BRV2 de 1 013 881 mots admis et l'index BPI2 complet.

La sortie finale de la commande est `passed`. Les identités, tailles et empreintes correspondent exactement aux pins B1e et B1f. Une relecture indépendante a recalculé le SHA-256 du fichier source et contrôlé les manifestes restaurés.

## Contrôles réels

- Source `wiki.fr.vec` : 3 027 096 151 octets, SHA-256 `bc68b0703375da9e81c3c11d0c28f3f8375dd944c209e697c4075e579455ac2a`.
- BRV2 : 1 152 449 lignes lues, 1 013 881 entrées admises et 248 segments.
- Manifeste BRV2 : `e1c07accdc55196c180968d710030e938b861bd7b6c7bf2c0f764e030f365cf7`.
- Empreinte sémantique : `8440d4e963ae309c5761818a58bcf752d1aa5750b6b6876d94a055ca177f732d`.
- BPI2 : 1 013 881 entrées, 65 536 feuilles et manifeste `77178f6fc85de9d5523db3f13141b751abdeb1c6b2d3ad6a4d020346a795c426`.
- Le catalogue existant a été vérifié sur le corpus restauré avant toute nouvelle décision éditoriale.

## Limites réelles

Les fichiers source et de travail sont locaux et ignorés par Git. Ils ne constituent pas encore un hébergement de production durable. Le binding R2 n'est pas provisionné et la mémoire réelle du Worker n'est pas qualifiée. Le corpus V2 reste donc inactif et V1 demeure le moteur publié.

Aucune nouvelle version du Site n'est publiée par cette tranche. Aucun test navigateur n'a été demandé ou effectué.

## Suite

Poursuivre les rotations de mots secrets sur ce corpus restauré, atteindre 365 approbations pour le calendrier puis 400 pour le catalogue principal. Provisionner et qualifier R2 et le Worker avant toute activation V2.
