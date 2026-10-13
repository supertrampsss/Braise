# Revue indépendante — tâche 2

Base : `42d383a` · HEAD : `a88feae` · 12 octobre 2026.

**Spec ❌ — Quality: Needs fixes.** Quatre corrections importantes ci-dessous ; aucune anomalie critique établie. Les parcours nominaux sont largement implémentés. La recette navigateur réelle reste au contrôleur : cette revue source et la sonde ciblée ne prouvent ni compréhension utilisateur, ni comportement du clavier mobile, ni contraste rendu, ni performance.

## Périmètre et méthode

Brief, spécification, critères exacts de `docs/superpowers/specs/backlog-approved.json`, rapport de réalisation et paquet de diff fournis consultés. Le gros affichage initial du paquet a été tronqué par l’outil ; les fichiers de production concernés ont ensuite été lus directement avec leurs lignes. Aucun second Git diff, crawl général, suite complète, build, changement de source/index/HEAD ou sous-agent. Lecture ciblée de la version de base de Game pour distinguer les raccordements nouveaux des acquis. Une sonde esbuild `write:false` exécutée en mémoire vérifie l’admission d’une sauvegarde future ; elle n’écrit aucun fichier.

Les résultats **50/50 ciblés**, TypeScript/build code 0 et **176/187 complets, 11 échecs Windows préexistants** sont les résultats rapportés par l’implémentation, non des exécutions refaites ici. Les tests nouveaux protègent utilement les fonctions pures et les identités mais plusieurs assertions d’interface sont des recherches de chaînes source : elles ne couvrent pas les interactions asynchrones décrites ci-dessous.

## Strengths

- Découverte réellement fondée sur les 120 cibles V1 : résolution serveur des anciennes références, déduplication par cible, identifiants opaques, exclusions bornées, épuisement explicite, nouveau seed de rejeu sans réassigner les mappings historiques. Le client ne reçoit ni réponse ni index de cible via cette fonctionnalité.
- La voie normale des propositions conserve la génération de requête, `samePuzzleRef`, la révision de saisie et les gardes de focus différé. Les refus lexicaux sont distingués des pannes ; téléchargement volontaire local sans transmission ni score inventé.
- Tutoriel utilisant le vrai GET/POST V1, séparé des sauvegardes, du profil et des récompenses. Bilan calculé sur les lignes réelles, avec indices et jalons ; partage sans mots proposés ni réponse.
- Hub limité aux sauvegardes V1 lisibles, dates civiles validées, zéros initiaux conservés, anciens parcours inconnus non reconstruits arbitrairement. Le mode archive conserve la date et l’identité quotidienne historique et n’allonge pas la série.
- Journal de diagnostic borné par le socle, fermé sur des types/contextes sans mot, score ou identifiant. Aucune reconstruction d’événements à partir des sauvegardes importées constatée dans les ajouts.
- `EXTRA_MODES_ENABLED=false` reste intentionnel jusqu’au lot 8 ; ce n’est pas un défaut de cette livraison. Les futures statistiques/préférences du lot 3 et reprises authentifiées du lot 4 ne sont pas exigées à tort ici.

## Critical

Aucun constat critique établi.

## Important

### I1 — Le verrou d’écriture accepte encore un format explicitement futur

**Emplacement : `components/game.tsx:295–298`, `components/game.tsx:414–416` ; dépendance ciblée `lib/legacy-storage.ts:10–13`.**

Le nouveau verrou `gameWriteAllowed` ne contrôle que `validLegacyGame(JSON.parse(raw))`. Ce validateur historique admet volontairement des propriétés supplémentaires et ne contrôle aucune version. Une sauvegarde `{version:99, guesses:[], pins:[], hints:0, startedAt:1, futureState:{pending:true}}` est donc admise. `restoreLegacyGame` la reprend et la prochaine proposition ou modification d’épingle passe par `writeLocal`, modifiant la même sauvegarde future. La présence du champ supplémentaire reste conservée par le spread, mais le contenu du document incompatible est bien réécrit.

**Preuve exécutée :** sonde en mémoire, résultat `{"futureVersion":99,"admittedForWriting":true}`. Les tests de conservation du contexte/discovery ne testent pas cette voie d’écriture du jeu.

**Impact :** violation de la contrainte explicite de conservation des sauvegardes futures/incompatibles ; risque de modifier des données dont la sémantique dépasse V1.

**Correction attendue :** ajouter au niveau de l’admission à l’écriture une détection de version explicite incompatible, en conservant la compatibilité des anciens objets V1 non versionnés et sans élargir inutilement la validation historique. Jeu en mémoire et avertissement restent possibles ; les octets du document incompatible doivent rester identiques après proposition/épingle.

### I2 — Le tutoriel rattache une erreur tardive à une saisie plus récente

**Emplacement : `components/game-parts/play-tutorial.tsx:20–23`, et gestion `onChange` ligne 26.**

`submittedRevision` protège l’effacement du champ après succès, mais ne protège ni le message de doublon ni `setError` dans le catch. Le champ reste modifiable pendant le POST. Envoyer un mot hors lexique, le remplacer par « maison » avant la réponse 422 : le message « Ce mot n’est pas dans le dictionnaire » arrive alors sur « maison », lié au champ par `aria-describedby`. Modifier encore le texte ne nettoie pas cette erreur puisque `onChange` ne fait qu’incrémenter la révision et affecter la saisie.

**Impact :** A01/A12 et règle des gardes de révision non complètement respectés ; un débutant reçoit un diagnostic lexical sur le mauvais mot. Le Game principal applique déjà une garde plus correcte dans son catch.

**Correction attendue :** conserver l’événement diagnostique réel de la requête, mais n’attacher une erreur au champ que si sa révision est celle envoyée ; nettoyer l’erreur à l’édition. Couvrir le refus 422 et la réponse doublon arrivant après édition, sans perdre le nouveau texte.

### I3 — Réessayer après panne fait sortir silencieusement de la collection

**Emplacement : `components/game.tsx:172`, `components/game.tsx:276–280`, `components/game.tsx:593`.**

Le contexte collection est un nouveau cinquième argument de `loadPuzzle`, mais `lastLoad` n’en conserve pas la valeur et le bouton Réessayer ne le transmet pas. Ouvrir une énigme depuis une carte collection, faire échouer le GET par une panne 503, puis Réessayer : le second appel reçoit `collection=undefined`. Il efface `collectionContext`, retire le paramètre de l’URL et enregistre `{mode:'challenge'}` sans collection. La cible est correcte mais le bandeau et la continuation de collection sont perdus ; après victoire, l’action peut partir vers une autre reprise/découverte.

**Impact :** D14/A02 et navigation contextuelle fragilisés précisément sur une reprise après panne. Fonction actuellement gated, à corriger avant activation.

**Correction attendue :** mémoriser et rejouer le descripteur complet du chargement, notamment la collection, puis contrôler GET échoué → Réessayer → bandeau/URL/contexte local conservés → prochaine énigme contextualisée.

### I4 — L’URL d’une étape Voyage reste marquée Explorer et casse le retour navigateur

**Emplacement : `components/game.tsx:83–86`, `components/game.tsx:175–183`, `components/game.tsx:315–324`, `components/game.tsx:355–362`.**

Depuis Explorer, `navigate('voyage')` écrit `surface=explore`. `openJourney` affiche ensuite le plateau via `setSurface('game')`, mais `loadPuzzle` ne retire pas ce paramètre. L’URL de l’étape demeure donc `?surface=explore&voyage=…&defi=…`. Ouvrir Profil puis revenir avec le navigateur : le restaurateur sélectionne `modes` à cause de `surface=explore` et, puisque `journey.id` est déjà le bon, il n’appelle pas `openJourney`. L’utilisateur revient au catalogue Explorer au lieu de l’étape qu’il vient de quitter. Autre manifestation : un lien direct avec `voyage` et `surface=profile` déclenche le chargement du voyage qui peut ensuite supplanter la surface explicitement demandée.

**Impact :** D10/D15/A02 ; sortie et retour ne correspondent pas à l’écran réellement placé dans l’historique. La génération protège les réponses dépassées mais ne résout pas cette incohérence d’URL.

**Correction attendue :** faire évoluer surface et URL par un chemin cohérent après admission asynchrone du voyage ; distinguer destination explicite et reprise du puzzle. Vérifier Voyage → étape → Profil → Retour/Avancer, rechargement, et lien profond vers une surface explicite avec contexte Voyage, y compris avec réponse lente.

## Minor

### M1 — Les filtres du calendrier décalent les dates sous de faux jours de semaine

**Emplacement : `components/game-parts/archive-calendar.tsx:13`, `components/game-parts/archive-calendar.tsx:22`.**

Les filtres compactent `days` mais la rangée Lun…Dim reste affichée, tandis que les cellules de décalage ne sont produites que pour `filter==='all'`. Avec une seule archive commencée le jeudi 1er octobre 2026, « À reprendre » l’affiche dans la première colonne sous Lun. L’étiquette accessible comporte encore la date réelle, mais l’organisation visuelle du calendrier la contredit. Garder les positions calendaires et masquer/désactiver les autres dates, ou passer explicitement à une liste filtrée sans en-têtes de semaine.

## Spec — matrice des IDs assignés

✅ = implémentation nominale cohérente à la lecture ; ⚠️ = qualification réelle ou correction contextuelle requise ; ❌ = écart identifié. Aucun ✅ ne remplace la recette navigateur du contrôleur.

| ID | Verdict | Éléments examinés / limite |
|---|---|---|
| D03 | ✅ | Envoyer/Analyse visibles dans Game et tutoriel ; autres plateaux des lots suivants. Compréhension débutant non mesurée. |
| D04 | ✅ | Explication permanente, progression 0–5, trois indices ; verrou serveur historique conservé. Déverrouillage clavier/tactile à vérifier en navigateur. |
| D05 | ✅ | Dernier essai, meilleure piste, rang et sens de la température explicités ; réponse moins proche ne remplace pas le record. |
| D06 | ✅ | Principe sémantique près de l’entrée et tutoriel facultatif ; entrée Game reste montée entre surfaces. |
| D07 | ✅ | DERNIER, meilleur, tri explicite, noms d’action des épingles ; recette clavier réelle encore nécessaire. |
| D08 | ✅ | Badge/date/retour et partage archive distincts ; identité et série inchangées. |
| D09 | ✅ | Libre annonce le pool limité et l’accès aux anciennes parties ; garde d’historique dégradé expliquée. |
| D14 | ⚠️ | Cinq cartes, reprise directe d’une énigme commencée, recoupements explicites ; I3 perd le contexte après panne. |
| D15 | ⚠️ | Bandeau, vraie preuve de victoire et continuation serveur conservés ; I4 rend le retour navigateur imprévisible. |
| D29 | ⚠️ | Réduction des répétitions/marges, flamme approuvée intacte et correction de hauteur au focus ; petit écran/clavier ouvert/performance non qualifiés par revue source. |
| A01 | ❌ | Vrais résultats V1 hors quotidien/profil/récompenses ; I2 manque la garde de révision pour les erreurs. |
| A02 | ❌ | Hub et contextes explicites présents, zéros/dates et anciennes données inconnues traités ; I1, I3, I4 empêchent une validation complète des sauvegardes/reprises. |
| A03 | ✅ | Bilan dérivé des propositions et indices réels, meilleurs mots hors réponse, jalons ; partage uniquement compteurs/couleurs/liens. |
| A04 | ⚠️ | Date native, calendrier, états et filtre, navigation clavier ; validation des dates invalides/futures/avant lancement conservée. M1 déforme le calendrier filtré. |
| A05 | ✅ | Nouveauté au niveau cible et épuisement serveur ; seeds explicites et zéros inchangés. Historique absent non présenté comme récupéré. |
| A09 | ✅ | Une suggestion principale motivée par une partie réelle, aucune popularité/difficulté inventée ; continuité collection/voyage soumise à I3/I4. |
| A12 | ⚠️ | Game conserve la saisie, distinction 422/réseau, téléchargement opt-in borné ; I2 concerne l’application de ces principes au tutoriel. |
| D10 Game | ❌ | Shell Jouer/Explorer/Profil, URL et popstate raccordés ; I4 empêche la correspondance écran/historique Voyage. |
| D26 Game | ⚠️ | Labels, focus visible, annonces et états textuels renforcés ; calendrier filtré à corriger et vraie recette clavier/lecteur d’écran/mobile encore requise. |

## Invariants et réserves contrôlés

- Moteur V1, calendrier, graines existantes et zéros, règles de score et segments ne sont pas redéfinis par les nouveaux modules. Découverte strictement importée par l’API ; aucune importation des données sémantiques serveur dans les composants ajoutés constatée.
- Cas archive `''`, chaîne invalide, mois/jour impossibles, avant lancement ou futur : normalisation de l’affichage du calendrier vers `max`, refus API conservé et retour au quotidien accessible. Le test SSR prouve un rendu non plantant pour ces entrées, pas un parcours utilisateur réussi.
- Le module contexte et le ledger discovery préservent les JSON corrompus/futurs et refusent leurs écritures. La sauvegarde de jeu ordinaire ne possède pas encore cette protection complète pour un format futur compatible en surface : I1.
- `resumeExpedition` continue de demander la prochaine référence après les vraies preuves enregistrées et reste silencieux ; aucune déduction d’une ancienne identité Voyage à partir d’une seed quelconque constatée.
- Aucun effet sonore ou événement de victoire nouvellement déclenché à la restauration/import dans les ajouts examinés. Les annonces/accessibilité réelles restent à qualifier en navigateur ; elles ne sont pas déduites des tests SSR.
- Les quatre constats importants nécessitent des tests ciblés comportementaux. Relancer toutes les suites lourdes inchangées n’apporterait pas une couverture spécifique de ces scénarios.

**Décision : Needs fixes avant approbation de la tâche 2.** Puis recette navigateur ciblée, en conservant explicitement la réserve des 11 échecs Windows du lot 7 et de l’activation avancée du lot 8.
