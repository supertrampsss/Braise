# BRAIZ — réalisation de la revue complète

Périmètre approuvé par l'utilisateur : « JE VEUx que tu fasses TOUT », après revue complète des fonctionnalités présentes et proposées. Les 44 éléments D01–D30 et A01–A14 de `backlog-approved.json`, avec leurs critères de validation, constituent la spécification. `review-approved.md` conserve les observations et références Mobbin. Les constats du miroir historique sont réconciliés avec la source canonique avant correction : ne pas dégrader les acquis déjà livrés.

Source canonique : Site `appgprj_6a9f1dfb001081918c9323599f7d8d6b`, BRAIZ, https://braiz.io, version publique 32, commit d'ouverture `264bf89ca3759dca406e606cdecb5cd2d0e6b9e9`. Réalisation dans le clone isolé `work/braiz-source`, branche `codex/full-review-implementation`. Le miroir GitHub ne sert pas de base de publication.

## Contraintes produit

- Français, accès immédiat au plateau, identité BRAIZ et flamme approuvée (`docs/BRAIZ-APPROVED-INTEGRATION.md`). Conserver les invariants de pause, restauration silencieuse et absence de variation de taille de la flamme.
- Aucun score, joueur, contribution, résultat, historique ni popularité inventé. Scores uniquement V1 exacts ou contenu entraînement réellement calculé et vérifié. Corpus V2 inactif jusqu'à toutes les qualifications requises.
- Préserver les identités, graines (y compris zéros initiaux), oracle, dates, segments et clés V1. Aucun import de données sémantiques serveur dans un composant client. Profil/imports personnels sans valeur compétitive.
- Les restaurations/imports ne rejouent jamais effets, son, annonces de récompenses ou focus. Préserver les données incompatibles/corrompues plutôt que les écraser.
- API partagée : authentification serveur et CSRF existants, origine vérifiée, validation et limites de taille. D1/R2 existants conservés ; migrations seulement ajoutées. Aucun secret dans Git, fichier, log ou livrable.
- Synchronisation, rappel et téléchargement hors ligne sont facultatifs, activés seulement par une action explicite du joueur. Les anciens faits sans dates restent signalés comme incomplets.
- Studio : publication stable, vocabulaire approuvé, champs bornés, préréglages visuels approuvés. Aucun catalogue public libre ni score synthétique.
- Aucun annonceur/configuration commerciale fictif. Conserver le script réel de vérification du domaine ; placements via la décision publicitaire existante.
- WCAG : navigation clavier, labels explicites, contraste, états non exprimés uniquement par couleur, erreurs réseau distinctes du lexique, réduction des animations.
- Publication sur le Site existant, audience publique conservée. L'autorisation de mise en œuvre et de publication est acquise ; les dépendances externes impossibles sont documentées précisément, jamais présentées comme réalisées.

## Acceptation finale

Chaque ID possède statut, fichiers/écrans et preuve de vérification dans une matrice. Tests du moteur et logique ajoutée, vérification TypeScript, construction, parcours navigateur sur petit et grand écran, contrôles d'autorisation pour fonctions partagées. Publication seulement d'une version cohérente ; vérifier URL et parcours après déploiement. Fournir un compte rendu court avec lien vers la version et le relevé exhaustif des réalisations/limites.
