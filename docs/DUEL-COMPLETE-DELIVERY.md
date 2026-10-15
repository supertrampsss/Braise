# Duel et indices — livraison du 15 octobre 2026

## Fonctionnement livré

- Progression des deux joueurs, nombre d’essais et score partiel actualisés automatiquement. La saisie reste intacte.
- Solution et essais adverses accessibles dès que les deux recherches d’une manche sont closes, ou que le duel est terminé. Aucun mot adverse divulgué pendant une manche encore jouable.
- Bilan des trois manches avec solution, résultat, motif et essais de chacun ; comparaison côte à côte sur ordinateur, choix du joueur sur téléphone.
- Historique consultable, partage sans les solutions, revanche adressée au même adversaire avec acceptation explicite et trois nouveaux mots.
- Nouveaux duels sur Word2Vec (155 562 mots). Les anciens duels conservent leur moteur et leurs résultats.
- Trois indices maximum dans les modes qui les proposent. Chaque indice vise un rang égal à 75 % du meilleur rang actuel ; aucun indice sous 60 % de ce rang. Jamais la solution ni un mot déjà essayé. Aucun candidat dans la plage : aucun indice consommé.

## Vérifications avant publication

- TypeScript et construction réussis ; oracle historique et pack immuable conservés.
- Suite complète : 477 tests, 474 réussis, aucun échec, 3 ignorés pour la création de liens symboliques sous Windows (EPERM).
- Tests du vrai parcours HTTP, autorisations, révélations par manche, expiration, abandon, moteurs ancien/nouveau et revanche ciblée.
- Tests d’actualisation, réponses obsolètes, saisie préservée et absence de révélation par le partage.
- Cas d’indice initial au rang 100 000 : 75 000 → 56 250 → 42 187 ; lexique trop clairsemé : aucun saut excessif.
- Revue indépendante terminée. Un défaut de réessai après conflit entre onglets a été reproduit, corrigé et testé : un rejet HTTP 409 libère la requête périmée, les erreurs réseau conservent l’identité du réessai.
- Navigateur local avec deux identités fictives et classements calculés par le vrai moteur : manche active sans mots adverses, solution et deux historiques après clôture, bilan 2–1. Largeurs 480 et 320 pixels sans débordement horizontal ; comparaison accessible au clavier.

## Preuves

Les captures et résultats de qualification sont enregistrés dans le dossier de livraison `Braise-Duel-2026-10-15`, à côté du dossier `work`. Les captures utilisent des parties locales de contrôle, pas les données de joueurs réels.

La qualification du site publié est enregistrée séparément après déploiement. Aucun identifiant de session ni lien privé d’invitation n’est écrit dans ces preuves.
