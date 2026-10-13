# Re-revue ciblée — tâche 2, correctif tour 1

Base : `a88feae` · HEAD vérifié : `14c989886f1037dc4a162ff833b87e7f43f63a2a` · 12 octobre 2026.

**Spec ❌ — Quality: Needs fixes.** Deux régressions importantes dans le raccordement de la navigation. Aucun constat critique. Les corrections I1, I2, I3 (conservation du descripteur) et M1 sont correctement raccordées ; I4 corrige les scénarios nominaux mais reste incomplet sur les échecs et les navigations pendant réessai.

## Méthode et limites

Lecture du rapport de revue précédent, de l’appendice de réalisation, du paquet `review-a88feae..14c9898.diff` et des seuls appels/dépendances nécessaires : Game, tutoriel, calendrier, helpers ajoutés, expédition/reprise et fermeture Radix installée. Comparaison des appels de production aux nouveaux tests de helpers. Aucun changement de production, aucun second diff Git, aucune suite lourde, aucun serveur ni sous-agent. Seul ce rapport a été écrit.

Les **64/64 ciblés, typecheck 0 et build 0** sont les résultats rapportés par l’implémentation, non réexécutés ici. Les constats ci-dessous suivent directement les branches de production ; les tests de helpers ne montent pas ce cycle d’interface. Le contrôleur a ensuite confirmé sur `14c9898` la sortie explicite anticipée : après animation Radix, dialogue disparu, focus sur `INPUT#guess`, quotidien toujours à 0 essai. Les autres variantes DOM/mobile demeurent au contrôleur.

## Critical

Aucun.

## Important

### F1 — Une réponse de réessai tardive reprend la main après navigation vers Profil

**`components/game.tsx:300`, `components/game.tsx:322–324`, appel `components/game.tsx:598`.**

Le bouton Réessayer introduit explicitement `destination='game'` dans le descripteur. Mais le prédicat d’admission réel est `request===requestRef.current && (!expedition || loadEpoch===navigationEpoch.current)` : un quotidien, une archive, une partie libre ou une collection sans expédition ignore entièrement l’époque de navigation. `navigate('profile')` incrémente cette époque, sans changer `requestRef`.

Scénario concret : GET quotidien en échec → Réessayer → ouvrir Profil pendant le GET différé → réponse réussie. Le prédicat reste vrai ; `admittedPuzzleUrl` efface `surface=profile` et le commit appelle `setSurface('game')`. L’utilisateur est ramené au plateau sans action et l’entrée d’historique Profil est remplacée. Le même scénario affecte une collection, malgré la conservation correcte de son identifiant. Cette régression vient de la nouvelle destination forcée du réessai ; elle ne nécessite pas l’activation des modes avancés.

Le test de navigation différée fourni passe artificiellement `()=>epoch===captured` à `admitPuzzleLoad` et utilise une expédition. Il prouve le helper mais ne couvre pas la condition réelle `!expedition` ni ce bouton.

**Attendu :** invalider la destination et le commit d’URL devenus obsolètes pour tous les chargements concernés, ou conserver une admission en arrière-plan sans restaurer une ancienne destination. Ajouter le scénario de production Réessayer quotidien/collection → Profil → résolution GET ; Profil et son URL doivent rester actifs.

### F2 — L’échec du GET d’étape est désormais invisible depuis Voyage

**`components/game.tsx:357–358`, `components/game.tsx:301,324,329–332` ; rendu `components/game.tsx:571,598,629–632`.**

Le déplacement vers Jouer se fait maintenant seulement dans le commit réussi de `loadPuzzle`. Depuis la surface Voyage, Continuer → POST `/api/expeditions` réussi → GET `/api/game` en 503 (ou panne réseau) laisse donc `surface='voyage'`. `loadPuzzle` intercepte l’erreur, renseigne `loadError`, puis renvoie `false`. `openJourney` n’exploite pas ce résultat pour afficher une erreur et son catch ne reçoit aucune exception ; `journeyError` reste vide.

Or le message `loadError` et le bouton Réessayer sont contenus dans la div `hidden={surface !== 'game'}`. Le sélecteur Voyage reçoit uniquement `journeyError`. Résultat visible : après « Chargement… », retour silencieux à « Continuer », sans explication de panne ni action Réessayer identifiée. On peut recliquer Continuer ou ouvrir Jouer manuellement, mais la récupération promise n’est pas présentée. Avant le correctif, `openJourney` affichait Jouer avant ce GET et l’erreur était visible. Fonction actuellement gated ; à corriger avant activation.

**Attendu :** rendre l’échec de l’étape visible sur la destination actuelle, avec une reprise contextualisée, ou admettre une surface d’erreur cohérente avec l’URL sans écraser une navigation plus récente. Couvrir séparément POST statut réussi → GET puzzle 503 depuis Voyage ; vérifier le message visible puis la reprise conservant expédition, sauvegarde et destination.

## Minor

Aucun nouveau constat mineur retenu dans ce périmètre.

## Vérification des demandes initiales

| Demande | Verdict de cette relecture | Raccordement vérifié |
|---|---|---|
| I1 — format futur / mutations | Corrigé | `canWriteGameDocument` refuse les marqueurs explicites incompatibles ; `saveGame` utilise `writeAdmittedGame` (416–419), qui relit le document au moment de la mutation. Le lecteur historique reste intact. |
| I1 — profil/récompenses indirects | Corrigé dans les voies ciblées | Relecture 317–320 et réponse acceptée 486–492 passent par `recordAdmittedGameProgress` avec admission. Le helper ne rejoint pas `recordLocalGameProgress` en cas de refus. Le rafraîchissement général du profil reste distinct et n’est pas présenté comme une absence absolue de toute écriture du profil. |
| I2 — refus/doublon après édition | Corrigé | `PlayTutorial` passe la révision soumise au doublon et au catch ; l’édition passe par le reducer qui efface l’erreur, et une réponse ancienne conserve la nouvelle saisie. |
| I3 — descripteur complet | Corrigé | Le descripteur réel comprend sauvegarde, expédition, collection et destination ; le bouton utilise le helper. La nouvelle destination explicite expose toutefois F1. |
| I4 — Voyage/historique/lien profond | Partiellement corrigé | `surface=voyage`, destination initiale explicite et URL d’étape cohérente sont raccordées ; admission différée d’expédition protégée. F1/F2 concernent les branches asynchrones ajoutées autour de ce correctif. |
| M1 — dates filtrées | Corrigé | `ArchiveDateLayout` est réellement utilisé ; la liste filtrée affiche les dates complètes sans jours de semaine, le calendrier complet conserve les décalages. |
| Retour explicite tutoriel | Cohérent à la lecture ; sortie anticipée confirmée par le contrôleur | Seul le bouton de sortie du tutoriel arme `tutorialReturnFocus`. `onCloseAutoFocus` consomme l’intention, empêche la restauration Radix par défaut, puis vérifie requête/navigation/surface/fermeture/propriété du focus (646–660). Escape ne crée pas d’intention et conserve la restauration du déclencheur ; l’effet de vue évite la concurrence. Les imports/chargements n’arment rien. Le test du prédicat ne valide pas le calendrier DOM complet de Radix. |

**Décision : Needs fixes sur F1 et F2**, puis re-revue de ces seules branches. La sortie anticipée du tutoriel a déjà été confirmée en navigateur par le contrôleur. Les 11 échecs Windows préexistants et les modes avancés désactivés restent les réserves déjà documentées ; ils ne sont pas de nouveaux constats de ce tour.

