# Nettoyage du code

Vérification du 29 octobre 2026, base `a481301`. Ce lot retire du code sans modifier les parcours ou les règles de jeu.

## Résultat mesuré

- 57 fichiers supprimés : 56 composants du kit UI non utilisés et le hook mobile exclusivement appelé par sa barre latérale non utilisée.
- 6 802 lignes de sources retirées dans ces fichiers.
- Ancienne fonction `proximityProgress` retirée de `lib/game-copy.ts` : aucun appel, import, test ou script. Son calcul sur les seuls 1 000 premiers mots n’est plus utilisé par le plateau actuel.
- 14 dépendances directes retirées du manifeste. Le lockfile npm perd 65 entrées de paquets ; aucune nouvelle entrée ni version restante modifiée.
- Installation locale réconciliée par `npm prune --ignore-scripts --offline` : 65 paquets retirés.

Ces nombres mesurent le dépôt et son installation. Ils ne constituent pas une mesure de gain de poids JavaScript téléchargé ou de vitesse en production.

## Preuves et méthode

`node scripts/audit-code-usage.mjs` produit un inventaire JSON sans supprimer ni modifier de fichier. Le script analyse les imports, réexports, imports de types, imports dynamiques littéraux, fichiers CSS et références littérales de ressources depuis les outils Python/Node. Les entrées framework App Router, configurations, fichiers publics, scripts CLI et tests sont des racines distinctes. Le rapport distingue les modules atteints depuis l’application de ceux utilisés uniquement par les outils ou les tests.

Les quatre imports non littéraux ont été relus : reconstruction de l’oracle Git dans `build-training-pack.mjs`, compilation du lecteur V2 dans `qualify-semantic-v2-reader.mjs`, chargement esbuild et du composant Game compilé dans `game-integration.test.ts`. Aucun chargeur dynamique ne sélectionne les fichiers UI supprimés.

La recherche textuelle intégrale a complété le graphe avant retrait des dépendances. Après suppression, il ne reste aucun candidat orphelin dans `components/`, `lib/` ou `hooks/` selon ces points d’entrée. Le rapport des exports sans import externe reste une liste à relire : une fonction peut être utilisée dans son propre module ou appartenir à un contrat conservé. Ce rapport n’est jamais une autorisation automatique de suppression.

## Dépendances retirées

`@base-ui/react`, `@hookform/resolvers`, `@shadcn/react`, `cmdk`, `date-fns`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-hook-form`, `react-resizable-panels`, `recharts`, `three`, `vaul`, `@types/three`.

Les dépendances du calendrier, formulaires, graphiques, carrousel, panneaux, menus de commandes et composants de saisie étaient exclusivement liées au kit supprimé, ou n’avaient aucun import dans le dépôt. `three` et `@types/three` n’étaient plus utilisés par la flamme actuelle ; l’étude Python utilise ModernGL et Pillow.

## Code conservé volontairement

- Composants UI encore consommés : `button.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `progress.tsx`, `sonner.tsx`.
- Toutes les routes et tous les écrans, y compris les modes actuellement masqués par la configuration de publication.
- Lecteurs et contrats V1, V2 et Word2Vec, migrations, sauvegardes et oracles historiques. Leur ancienneté ne démontre pas leur inutilité.
- `lib/flame-shaders.ts`, lu comme texte par `scripts/render-flame-study.py` ; le premier graphe d’imports TypeScript seul le signalait à tort.
- `lib/semantic-v2-r2.ts`, couvert par les tests de transport. Les outils de construction, vérification et preuve des corpus sont des entrées CLI autonomes.
- `lib/training-format-fr.ts` : format historique figé pour les fixtures de l’entraînement. Sa ressemblance avec le format courant ne justifie pas une fusion qui changerait l’oracle.
- Exports de types et constantes des contrats historiques, même lorsqu’ils n’ont pas de consommateur externe direct.

## Vérifications

TypeScript sans émission : réussi. 60 tests ciblés réussis, couvrant les fondations, la flamme, le composant de jeu, les duels et l’entraînement. Le build de production et la recette visuelle appartiennent au lot global de livraison. Aucun déploiement n’est effectué par ce nettoyage.

## Inventaire exact des fichiers supprimés

| Fichier | Lignes |
| --- | ---: |
| `components/ui/accordion.tsx` | 66 |
| `components/ui/alert-dialog.tsx` | 196 |
| `components/ui/alert.tsx` | 66 |
| `components/ui/aspect-ratio.tsx` | 11 |
| `components/ui/attachment.tsx` | 204 |
| `components/ui/avatar.tsx` | 109 |
| `components/ui/badge.tsx` | 48 |
| `components/ui/breadcrumb.tsx` | 109 |
| `components/ui/bubble.tsx` | 125 |
| `components/ui/button-group.tsx` | 83 |
| `components/ui/calendar.tsx` | 220 |
| `components/ui/card.tsx` | 92 |
| `components/ui/carousel.tsx` | 241 |
| `components/ui/chart.tsx` | 377 |
| `components/ui/checkbox.tsx` | 32 |
| `components/ui/collapsible.tsx` | 33 |
| `components/ui/combobox.tsx` | 310 |
| `components/ui/command.tsx` | 184 |
| `components/ui/context-menu.tsx` | 252 |
| `components/ui/direction.tsx` | 22 |
| `components/ui/drawer.tsx` | 135 |
| `components/ui/empty.tsx` | 104 |
| `components/ui/field.tsx` | 248 |
| `components/ui/form.tsx` | 167 |
| `components/ui/hover-card.tsx` | 44 |
| `components/ui/input-group.tsx` | 170 |
| `components/ui/input-otp.tsx` | 77 |
| `components/ui/input.tsx` | 21 |
| `components/ui/item.tsx` | 193 |
| `components/ui/kbd.tsx` | 28 |
| `components/ui/label.tsx` | 24 |
| `components/ui/marker.tsx` | 69 |
| `components/ui/menubar.tsx` | 276 |
| `components/ui/message-scroller.tsx` | 130 |
| `components/ui/message.tsx` | 92 |
| `components/ui/native-select.tsx` | 62 |
| `components/ui/navigation-menu.tsx` | 168 |
| `components/ui/pagination.tsx` | 127 |
| `components/ui/popover.tsx` | 89 |
| `components/ui/radio-group.tsx` | 45 |
| `components/ui/resizable.tsx` | 53 |
| `components/ui/scroll-area.tsx` | 58 |
| `components/ui/select.tsx` | 190 |
| `components/ui/separator.tsx` | 28 |
| `components/ui/sheet.tsx` | 143 |
| `components/ui/sidebar.tsx` | 723 |
| `components/ui/skeleton.tsx` | 13 |
| `components/ui/slider.tsx` | 63 |
| `components/ui/spinner.tsx` | 16 |
| `components/ui/switch.tsx` | 35 |
| `components/ui/table.tsx` | 116 |
| `components/ui/tabs.tsx` | 91 |
| `components/ui/textarea.tsx` | 18 |
| `components/ui/toggle-group.tsx` | 83 |
| `components/ui/toggle.tsx` | 47 |
| `components/ui/tooltip.tsx` | 57 |
| `hooks/use-mobile.ts` | 19 |
