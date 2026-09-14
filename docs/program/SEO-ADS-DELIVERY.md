# SEO et publicité

## État livré

- Origine canonique : `https://braiz.io/`.
- Métadonnées de page, Open Graph et carte X centralisées dans `app/layout.tsx`.
- `public/robots.txt` autorise l'exploration et déclare le sitemap.
- `public/sitemap.xml` publie uniquement la page d'accueil, qui est la seule page éditoriale stable.
- Aucune route de jeu, réponse API, cible ou donnée personnelle n'est proposée à l'indexation.

## Vérifications

- `npm run typecheck` : réussi.
- `npm test` : 169 tests réussis.
- `npm run build` : réussi.
- Le sitemap et `robots.txt` sont présents dans `dist/client`.
- Aucune publicité réelle n'est activée.

## Activation commerciale restante

L'adaptateur publicitaire conserve la décision `skip / not-configured` tant qu'un compte éditeur approuvé, un identifiant AdSense, des emplacements, `ads.txt` et un consentement conforme ne sont pas disponibles. Aucun identifiant fictif ne doit être ajouté au dépôt ou au Site.

## Prochaine action externe

Vérifier `braiz.io` dans Google Search Console, soumettre `https://braiz.io/sitemap.xml`, puis demander l'exploration de la page d'accueil. Pour AdSense, faire valider le domaine et fournir la configuration commerciale réelle avant toute activation.
