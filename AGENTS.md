# Braise

- Langue produit : français. Garder le jeu immédiatement accessible, sans page marketing préalable.
- Lire README.md et docs/ARCHITECTURE.md avant une modification du moteur.
- Ne jamais inventer un score sémantique, un classement ou des joueurs actifs.
- Ne jamais importer lib/semantic.ts ou data/semantic-fr.json dans un composant client.
- Ne jamais importer lib/legacy-puzzles.ts ou data/legacy-v1.json dans un composant client.
- Ne pas réécrire le corpus, les identités ou l'oracle V1 pour une extension. Créer une nouvelle version et conserver le lecteur historique. Les fixtures V1 se reconstruisent uniquement depuis leur commit source figé.
- Conserver l'attribution et la licence CC BY-SA des données.
- Vérifier les modifications de calendrier, normalisation et API avec npm test.
- Vérifier TypeScript et la construction après une modification du code.
- Respecter prefers-reduced-motion, le clavier et la sauvegarde des parties.
- Les annonces sont réservées, aucune régie ne doit être activée avec des identifiants fictifs.
- Réutiliser l'identité Sites existante. Ne pas créer de Site de remplacement pour publier une correction.
