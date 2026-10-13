# Task 5 — revue spécification et qualité

**Décision : Needs fixes.** Un défaut important de récupération de duplication ; aucun défaut critique identifié dans le périmètre examiné.

Base `70145326a4016eb4f7ea82814f35547f3522dde1`, HEAD examiné `aac0bdd61d439a181e99e6b23d7323871b6bc20f` (HEAD confirmé). Revue du paquet de diff une fois, brief/rapport et critères approuvés ; lectures ciblées des fonctions lorsque la sortie du diff était tronquée. Checkout, index et HEAD laissés intacts. Seul ce rapport est écrit.

## Spec gaps / evidence

- **D19 / A11 :** titre 1–80, description 0–320, validation serveur texte simple, trois préréglages fermés ; catalogue sans graines dans sa réponse, sélection bornée 1–12 références distinctes. Aperçu avec la même carte participant et progression ; liste ordonnée côté auteur. Publication conserve titre/description/visuel/étapes, audience et retrait clairement décrits. Duplication réservée au propriétaire et quota de 50 conservé, mais la récupération après réponse perdue n’est pas complète : voir Important I1.
- **D20 :** route dédiée authentifiée/propriétaire, `publicView` applique aussi le retrait ; projection construite par liste blanche numérique. Aucun spread d’objet métier, mot, graine, solution ou identité transmis. Horodatage réel, fraîcheur 45 s, panne distincte effaçant les scores, dernier succès conservé. Polling volontaire 15 s, arrêt sur visibilité et rejet des réponses annulées.
- **D21 :** choix / résultat expliqué / prochaine énigme non jouée / bilan fini des 20 premières réponses. Validation serveur des 20 indices distincts et de l’édition ; bilan calculé à partir des réponses, aucune note synthétique. Restauration du bilan sans écriture d’essai ni focus volontaire. Reprise et sortie accessibles. Petit défaut du bouton de reprise sur panne du bilan : M1.
- **D22 :** deux panneaux A/B textuels, meilleurs rangs/températures issus des réponses réelles, état trouvé cumulé indépendamment, victoire seulement pour les deux. Historique compact, labels A/B et format français. Gardes synchrones navigation/envoi et préservation de la saisie modifiée pendant requête.
- **D03/D10/D26 ciblés :** navigation commune présente dans les quatre composants ; Envoyer/Envoi, labels, annonces d’erreur et focus de résultats explicites. Recette navigateur responsive/clavier/lecteur d’écran et contraste final restent au lot 8 comme prévu, non qualifiés par cette revue de code.

## Quality — Critical

Aucun.

## Quality — Important

### I1 — [P2] La duplication reste bloquée après réponse perdue et évolution de la source

**Fichiers :** `lib/studio-store.ts:18–21`, `components/studio.tsx:32` (référence conservée à la ligne 14).

Scénario : la première duplication écrit la copie, mais sa réponse réseau est perdue. L’auteur reste sur le brouillon source ; il peut l’éditer et l’enregistrer, ou une autre fenêtre peut le modifier. Au prochain clic Dupliquer, le client réutilise le même identifiant puisqu’il ne compare que `source`. Le serveur relit maintenant le contenu courant de la source et appelle `save(..., revision=-1)` : l’INSERT IGNORE rencontre la copie existante, puis la comparaison à ce nouveau contenu renvoie null. L’API répond 409. La référence client reste conservée, donc les tentatives suivantes échouent encore sur la même copie ; il faut recharger/quitter ce brouillon pour retrouver un parcours utilisable.

**Preuve ponctuelle exécutée (sans fichier ni suite complète) :** bundle mémoire des vrais `StudioStore` et helper SQLite, création Original → duplication `copy` → source enregistrée Updated → même requête de duplication. Sortie : `{"firstCopyTitle":"Original","replay":null,"copyStillPresent":true}`, exit 0. L’assertion confirme le défaut ; la copie existe bien.

**Correction attendue :** définir et conserver le résultat de la requête de duplication indépendamment du contenu courant de la source, avec vérification propriétaire/source, ou gérer explicitement la récupération côté interface. Une nouvelle duplication volontaire d’une nouvelle révision doit disposer de sa propre identité. Éviter un simple renouvellement automatique après erreur réseau qui créerait une seconde copie lorsque la première a réussi. Ajouter une régression du parcours réponse perdue → source modifiée → récupération, plus rejeu ordinaire garantissant une seule copie.

## Quality — Minor

### M1 — [P3] « Réessayer » après panne du bilan charge une énigme

**Fichier :** `components/intruder-game.tsx:80`.

Après échec de `/api/intruder/summary`, le bouton d’erreur appelle toujours `load(retryIndex.current)` au lieu de `loadSummary()`. Le joueur demandant de réessayer le bilan retrouve donc une énigme (souvent la première après restauration). Le bouton dédié « Voir le bilan » reste disponible, ce qui limite l’impact. Faire dépendre la reprise de l’opération échouée.

## Named cross-cutting checks

| Contrôle | Conclusion / preuve |
|---|---|
| OWNERSHIP / AUTH / CSRF / QUOTA | Authentification mutante conservée avant branche duplicate ; origine/CSRF réels vérifiés par D1 ; source lue avec guest_id ; insertion via save garde ACTIVE et quota 50. Pas d’affirmation de test dédié saturant ce quota Studio dans les nouvelles preuves. |
| IMMUTABLE-PUBLISHED / WITHDRAWAL | SQL de publication copie les métadonnées ; aucune mise à jour de celles-ci sur l’édition. Tests store vérifient étapes et champs figés ; D1 teste propriétés metadata et accès bloqué après retrait, plus invariant ancien des routes de jeu. |
| DUPLICATE-IDEMPOTENCY | Rejeu inchangé compatible avec save ; évolution de source après réponse perdue échoue : I1. Aucun test livré n’exerce cette combinaison. |
| PROJECTION-PRIVACY / FRESHNESS | Liste blanche exacte testée en fonction et via vraie route sur D1 ; test composant appelle uniquement /api/projection, vérifie arrêt de timer, signal aborted et rejet de réponse tardive ; fonction couvre les frontières temporelles. |
| FINITE-20 / SILENT-RESTORE | Test du vrai composant joue 20 choix, compare le bon décompte, ouvre le bilan, remonte le composant et confirme aucun choix enregistré à nouveau. Les tests React ne prouvent pas les annonces/focus d’un lecteur d’écran réel. |
| A-B-REAL-SCORES / ASYNC | Vrais composants reçoivent scores fixture différents et conservent A trouvée après B ; saisie en vol préservée ; tests synchrones refusent ancienne paire / ancien choix pendant navigation. Moteur réel couvert par suites affectées, fixtures des composants explicitement locales. |
| APPEND-ONLY-0006 | Quatre ALTER ADD sur drafts/editions, défauts vides/ember ; snapshot 0006 et journal ajoutés. Aucun SQL/snapshot antérieur dans la liste des fichiers modifiés. Helper et Miniflare appliquent 0000–0006. |
| V1 / PIPELINES / RELEASE | Aucun changement moteur, asset canonique, pipeline corpus ou drapeau de release dans le diff. Log build vérifie V1 frozen SHA256 `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`, 120 cibles. Aucune interaction avec le job contrôleur. |

## Vérification des preuves livrées

- `work/task5-tests.log` : TAP final **88 tests, 88 pass, 0 fail, 0 skip**, cohérent avec les 10 suites du runner. Assertions inspectées dans les nouveaux tests React/store/summary et qualification ; pas de simples tests de présence textuelle utilisés à la place des comportements annoncés.
- `work/task5-d1.log` : PASS Miniflare. Script inspecté : migrations SQL réelles, vraie API Studio/projection, mauvais origin/CSRF, autre propriétaire, copie, version publiée puis édition du brouillon, conflit de révision, projection à clés exactes, retrait et session révoquée. Les assertions D1 de publication concernent surtout les métadonnées ; les étapes immuables sont directement vérifiées dans le test store inclus. Scores fixture annoncés, aucune prétention de qualification éditoriale.
- `work/task5-typecheck.log` et `work/task5-lint.log` : fichiers vides cohérents avec un passage silencieux ; **exit 0 attesté dans le rapport producteur**, non reconstructible à partir de ces logs seuls. Aucune erreur visible, sans nouvelle exécution redondante.
- `work/task5-build.log` : vérification frozen et **Build complete** ; avertissements de classification Vinext présents, conformes au rapport. Exit 0 attesté par le producteur.
- Aucune relance exhaustive/pipeline/corpus, aucun navigateur ou preview démarré. Un seul test ciblé supplémentaire, motivé par I1, exécuté en mémoire. La qualification globale de branche reste au lot 8.

**Retour attendu :** correction I1 et preuve ciblée ; M1 facile à corriger dans le même passage. Revue de la correction limitée à ces changements avant approbation.
