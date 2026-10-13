# Task7B2 — correction transport, round1

BASE01ed71d2b2237b6c7544d72626cbf1493a4ff6ee. Revue task-7b2-transport-review.md : une ImportantI1, annulation d’un flux R2 non coopératif attendue indéfiniment malgré abort. Périmètre de correction limité aux deux fichiers de transport et au test associé.

## Correction

`lib/semantic-v2-range-r2.ts` : métadonnées invalides et surplus rejettent immédiatement avec leur erreur précise ; cancel est déclenché comme nettoyage non bloquant, avec rejet de sa promesse absorbé. Le finally libère toujours le lecteur.

`lib/semantic-v2-bounded-r2.ts` : une primitive locale de nettoyage déclenche cancel et libère immédiatement le reader et son inscription au registre des annulations. Ni le chemin abort, ni le budget d’octets, ni une erreur de lecture, ni le cancel du consommateur n’attendent la coopération du flux sous-jacent. Un objet tardif après abort/close est également annulé sans attente. Aucune lecture ne continue après fermeture ; l’erreur de contrôle d’intégrité reste prioritaire.

Pins, auth, délais/budgets, SHA, cache, limites, constructeur et reader numérique inchangés. Aucun producteur, corpus, archive, calendrier, catalogue, interface ou configuration cloud modifié. Les preuves réelles du checkpoint01ed71d restent exactes pour leurs pins ; aucun benchmark/corpus recalculé.

## Tests

La suite33 précédente est conservée. Nouveau test avec6 sous-cas : adaptateur+wrapper réels, cancel qui retourne une promesse permanente, métadonnées invalides, surplus, budget réseau dépassé et lecture interrompue par abort ; vérification des erreurs précises, du nombre réel de cancel et de `raw.locked === false`. Deux sous-cas testent aussi l’adaptateur direct pour protéger ses propres nettoyages et la libération de capacité. Chaque promesse doit se terminer sous1s, abort injecté à20ms ; il ne s’agit pas d’une tolérance du runtime, seulement de la borne de détection d’un test bloqué.

Commande : esbuild des4suites transport vers work/tests-range puis node --test --test-concurrency=1 semantic-range-pack-v2/semantic-v2-range-r2/semantic-runtime-qualification/semantic-transfer. Résultat40/40,0échec,0skip,1266ms ; six sous-cas nouveaux terminés dans le parent34ms. Log work/task7b2-transport-fix-tests.log. Typecheck/lint/build finaux dans work/task7b2-transport-fix-{typecheck,lint,build}.log.

## Préservation éditoriale pendant l’interruption

Snapshotbatch4 exact106dossiers, SHA490e6f7762778cee61ce53309482883e9a136346f60cfcc2b8a4aa6c3109e8ee. Les60premiers ont été réellement lus (3840voisins) et leurs trios validés via loader officiel :57favorables,3rejets motivés2537bandeau/2721dragon/3418ivoire. Sortie immuable work/qualification/editorial-agent-review/batch4/recommendations-partial60.json, SHA2ab2f1d1381857d569e2feba608c4bb848ce0da73a5c49d0e7524e790aae490e. Les46restants n’ont pas encore été lus. Aucune décision canonique persistée. Reprise après nouvelle revue limitée, selon dispatchcontrôleur.

Task7 reste incomplète ; le présent correctif ne constitue ni une qualification hébergée ni400approbations.

Résultat final :40tests/40pass/0skip, typecheck0, lint0erreurs/4warnings préexistants, build vérifié0 (assetsV1 vérifiés, route incluse). Commit18f96e64cc9479409bb8425d05af2af32a138648, limité à3fichiers source/tests ; checkoutpropre. Auto-revue du diff confirme uniquement le nettoyage des flux R2 et sa couverture. Revue limitée fraîche demandée avant cloud/repriseproduction ; aucune actionhébergée effectuée.
