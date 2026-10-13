# Re-revue ciblée — tâche 2, correctif tour 2

**Spec ✅ — Quality: Approved.** F1 et F2 sont corrigés dans le périmètre demandé. Aucun nouveau constat bloquant.

Base : `14c9898` · HEAD vérifié : `a713d49b7070bee32232fd2ff5b20794565f94a1` · 12 octobre 2026.

## Périmètre et méthode

Lecture du paquet fourni `review-14c9898..a713d49.diff`, de F1/F2 dans `task-2-fix-review.md`, du dernier appendice de `task-2-report.md`, des appels réels de Game et des seuls helpers/tests concernés. Aucun second diff, changement de production, sous-agent, serveur, push ou déploiement. Seul ce rapport a été écrit. Les points antérieurement acquittés et la fermeture du tutoriel ne sont pas réexaminés.

## F1 — navigation pendant un réessai quotidien ou collection

**Corrigé.** `components/game.tsx:300` fournit à `admitPuzzleLoad` les valeurs capturées `request`/`loadEpoch` et les compteurs courants `requestRef.current`/`navigationEpoch.current`. `lib/game-navigation.ts` impose lui-même l'égalité des deux compteurs : aucune exception selon l'expédition ou le mode, aucun prédicat d'admission configurable.

`navigate('profile')` et la restauration de route incrémentent effectivement `navigationEpoch`. Après un clic Réessayer (`components/game.tsx:605`, destination explicite `game`), une réponse quotidienne ou collection devenue obsolète ne peut donc modifier le puzzle, la surface ni l'URL. La même garde est appliquée avant le callback d'échec ; un rejet réseau tardif ne restaure pas non plus une ancienne destination. Le catch extérieur vérifie également les deux compteurs.

Les deux nouveaux tests F1 utilisent `retryPuzzleLoad`, les compteurs et la même garde imposée par le helper de production. Ils couvrent quotidien et collection, puis Profil avant résolution différée, avec zéro commit et conservation de la surface/URL. Les tests F2 couvrent séparément HTTP 503 tardif et rejet réseau tardif. Ils ne renforcent pas artificiellement la garde par un prédicat de test.

La branche existante `components/game.tsx:334` conserve un message générique d'interruption pour une requête courante annulée par navigation ; elle ne reprend ni la surface ni l'URL Profil et n'affiche pas l'erreur réseau ancienne sur cette surface. Ce comportement n'est pas assimilé à un commit d'erreur admis.

## F2 — POST Voyage réussi puis GET d'étape en 503

**Corrigé.** `openJourney` transmet toujours seed, sauvegarde reprise, statut d'expédition et destination `game` à `loadPuzzle`. Un HTTP 503 admis fixe la possibilité de réessayer puis déclenche le callback d'échec (`components/game.tsx:326–332`). Ce callback conserve le message, applique `failedPuzzleUrl`, puis rejoint la surface Jouer et sa vue `play`. Le bloc `load-error` avec `role="alert"` et Réessayer est rendu sur cette surface (`components/game.tsx:578,605`). Le résultat `false` n'est plus remplacé par le message d'interruption réservé à `null`.

L'URL d'échec reprend le locator demandé et l'expédition, retire l'ancienne surface Voyage et reste cohérente avec Jouer. Le bouton rejoue `lastLoad` via `retryPuzzleLoad`, en conservant statut, sauvegarde, locator et destination. Il n'effectue pas un nouveau POST de statut. Une navigation plus récente vers Profil invalide aussi la transition d'échec avant toute réécriture de route.

Le nouveau test traverse `resumeExpedition`, simule le GET 503, vérifie message/surface/URL et descripteur, puis réessaie avec le même statut et la même sauvegarde. Les deux tests d'obsolescence contrôlent séparément HTTP et exception réseau. Le raccordement réel de ces callbacks dans Game correspond à celui des tests.

## Preuves et limites

Le dernier appendice rapporte **69/69 tests ciblés, TypeScript code 0 et construction code 0**. Lecture des journaux correspondants : `work/task2-fix2-targeted-tests.log` confirme 69 réussites et zéro échec ; le journal TypeScript ne présente aucune erreur ; le journal de construction se termine par `Build complete`. Ces commandes n'ont pas été réexécutées dans cette revue en lecture seule.

Les tests exercent les helpers de production et les transitions différées, sans monter le cycle DOM complet de Game ; la présence visuelle/clavier reste une recette navigateur distincte. Les 11 échecs Windows préexistants et les modes avancés désactivés restent les réserves déjà documentées, sans nouveau constat dans ce paquet. Le retour explicite du tutoriel, déjà confirmé par le contrôleur, est hors périmètre.

**Décision : Approved sur F1/F2 pour `a713d49`.** Aucun correctif supplémentaire demandé dans ce tour.
