# Architecture

## Séparation

- `components/game.tsx` : interface et sauvegarde locale versionnée.
- `lib/game-types.ts` : contrat partagé et calcul de série.
- `lib/semantic.ts` : dictionnaire, cosinus quantifiés et calendrier, uniquement côté serveur.
- `app/api/game/route.ts` : découverte du puzzle, validation et évaluation.
- `data/semantic-fr.json` : artefact de calcul reproductible, licence conservée.

GET `/api/game?mode=daily` renvoie une identité publique sans réponse. Les modes `free` et `challenge` exigent une seed numérique. POST évalue un mot ou donne une piste. Une identité quotidienne expirée donne un statut 409. Le client renouvelle le quotidien à minuit à Paris.

Une proposition inconnue donne 422, jamais un score de hasard. Les doubles propositions normalisées ne sont pas ajoutées aux essais. Les indices doivent être distincts des mots déjà proposés et du mot cible. Toute victoire est comptée une seule fois par identité locale de puzzle.

Le coût sémantique ne dépend pas d'un fournisseur d'IA payant : les scores sont déjà calculés. Le serveur décode et trie au plus cinq cibles en cache par isolate. La matrice complète reste sous forme compacte tant qu'elle n'est pas utilisée. Une limitation par IP et fenêtre d'une minute protège contre les rafales simples ; elle est locale à l'isolate et ne remplace pas un dispositif global pour un gros lancement.

## UX

La requête de chargement la plus récente est la seule autorisée à remplacer la partie. Une réponse devenue obsolète ne modifie pas une autre partie. Les modifications d'épingles et de son sont désactivées pendant un POST pour éviter de perdre un changement. Une nouvelle saisie préparée pendant l'analyse n'est pas effacée par le résultat précédent.

Le son est désactivé par défaut. `prefers-reduced-motion` réduit les animations. Aucune dépendance externe de police, vidéo ou image n'est nécessaire au premier écran.

## Limites de cette version

Le profil local est modifiable par l'utilisateur, les onglets simultanés ne se synchronisent pas et la suppression des données du navigateur efface la progression. Ne pas en faire un classement officiel. Le dictionnaire Wikipédia comprend parfois des noms propres ou emprunts. La matrice de 120 cibles est un corpus initial à élargir pour une exploitation pérenne.

La marque, le domaine commercial, l'audience publique, la régie et le consentement publicitaire n'ont pas été provisionnés. Les contrats d'API actuels n'ont pas besoin de D1, R2 ou d'identité utilisateur.
