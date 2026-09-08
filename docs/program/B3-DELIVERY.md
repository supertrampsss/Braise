# B3 : braise vivante et socle publicitaire

Statut : implémentation et contrôles locaux terminés. Aucune régie, annonce, impression, mesure tierce ou publication n'a été activée. La validation navigateur n'a pas été demandée et n'a pas été réalisée.

## Livraison

- Chaque proposition acceptée produit un seul événement transitoire identifié : `guessAccepted`, `bestImproved` ou `puzzleWon`. La victoire prime sur le record, le record sur l'impulsion ordinaire.
- Les effets sont séparés des sauvegardes `braise.v1.*`, consommés par leur propre identifiant et annulés au changement de partie. Une ancienne minuterie ne peut pas interrompre un effet plus récent.
- Une victoire restaurée affiche son résultat permanent sans relancer confettis, son, toast ou focus. Les lignes restaurées restent immobiles.
- Le meilleur score réel continue de piloter la jauge. Une proposition moins chaude ne refroidit pas visuellement la progression.
- La saisie reste modifiable pendant l'analyse. Une révision saisie entre l'envoi et la réponse est conservée, même si son texte redevient identique.
- Le focus différé respecte la fenêtre active et les déplacements de focus. Les réponses acceptées sont annoncées textuellement ; la victoire soumise focalise son titre.
- Les couleurs, surfaces et durées principales sont regroupées dans des tokens. Les cibles tactiles essentielles atteignent 44 px sur mobile et le cadran est resserré pour garder le formulaire proche.
- `prefers-reduced-motion` supprime les entrées, impulsions et confettis tout en conservant textes, contours et résultat.
- La décision publicitaire est centralisée. Sans configuration commerciale réelle, les trois emplacements possibles renvoient `skip/not-configured`. Le bloc réservé est statique et ne contient ni script, iframe, pixel, lien, cookie ni contrôle.

## Vérifications

| Contrôle | Résultat |
|---|---|
| Événements et priorités | Premier essai, baisse, amélioration et victoire couverts |
| Consommation | Une minuterie ne consomme que son propre événement |
| Saisie concurrente | Saisie inchangée effacée, saisie éditée et indice préservés |
| Publicité inactive | Trois emplacements à `skip/not-configured`, rendu statique sans intégration distante |
| Compatibilité V1 | Suite moteur, calendrier, API, sauvegardes et 3,6 millions de valeurs conservée |
| Tests | 28 passés, aucun échec |
| TypeScript | Passé |
| Construction Sites | Passée |
| Relecture indépendante | ASTRA max, aucun défaut bloquant local restant |
| Navigateur | Non demandé, non testé |
| Publication | Non réalisée |

La construction ne constitue pas une validation visuelle. Mobile, contraste perçu et confort des mouvements restent à observer lors d'une validation navigateur explicitement demandée ou d'un futur jalon d'usage.

## Suite et retour

B3 débloque la progression locale de B4. Le prochain lot doit introduire un profil versionné et une migration idempotente avec copie de secours, sans transformer l'historique personnel en résultat compétitif.

Retour : rétablir les fichiers d'interface antérieurs à B3 dans un nouveau commit. Conserver les sauvegardes `braise.v1.*`, les données sémantiques et les références de partie. Aucun fournisseur publicitaire, stockage distant ou déploiement n'a été créé par B3.
