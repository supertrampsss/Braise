# Correctifs de la revue globale finale

BASE `43f2ed6f9dbed64c47d473aeb3927da03fffb7b5`, vague I1/M1/M2,13octobre2026. Ce document qualifie les corrections de source et les tests locaux ; publication, recette HTTPS/416/pin et contrôles natifs restent au contrôleur.

**I1 — découverte et profil importé.** `collectDiscoveryHistory` réunit sans écriture les identités classiques des clés locales, réussites V1 du profil courant, activités, faits en mémoire et preuves transférées. Contrats corpus/rules/variant/calendar et dates admissibles filtrés ; les zéros initiaux restent exacts, les références V2 restent distinctes et passent par la correspondance canonique serveur existante. Union dédupliquée avant limite3000 ; la3001e identité distincte produit un refus explicite, sans troncature. Aucune victoire, score ou crédit ajouté. Le calcul des témoins est linéaire, sans recherche répétée de toutes les activités par victoire.

**M1 — mêmes valeurs, rendu français.** Duels et Votre espace rendent12.25 en12,25° et1234 en1 234 via les deux helpers communs, sans mutation des valeurs API/sauvegardes. Les deux composants réels sont montés/repris dans les tests.

**M2 — fiche locale exacte.** Un véritable refus lexical conserve le mot et la référence du puzzle soumis ; texte et JSON identifient son corpus réel. Fiche `braiz-lexicon-feedback` version2,reason`absent-from-lexicon`,corpusVersion,puzzleRef. Téléchargement volontaire seulement ; aucune requête réseau supplémentaire.503 reste une erreur de service sans fiche. Un422 d’indice vide ne devient pas un mot refusé. Les types diagnostiques existants et leur enveloppe fermée sans mot/ref/corpus sont inchangés.

| Vérification réellement exécutée | Résultat | Journal de travail |
| --- | --- | --- |
| `node work/test-final-fixes.mjs --red` avant production | six reproductions,0pass/6fail,exit1 | `work/final-fix-red.log` |
| Même sélection après correction | 6/6,exit0 | `work/final-fix-six-green.log` |
| `node --test --test-name-pattern=hint422 work/tests-final-fixes/game-integration.test.mjs` avant garde | 1fail attendu,exit1 | `work/final-fix-hint-red.log` |
| `node work/test-final-fixes.mjs` final | **114/114**,0fail/0skip,exit0,6836.1604ms | `work/final-fix-focused.log` |
| `node scripts/run-site.mjs typecheck` final | exit0,log vide,13.154s | `work/final-fix-typecheck.log` |
| `node scripts/run-site.mjs lint` final | exit0,0erreur/0warning,log vide,33.364s | `work/final-fix-lint.log` |
| `node scripts/build-verified.mjs` final | exit0,Build complete,53.744s | `work/final-fix-build.log` |
| Baseline160/public/training/autorités/pins après build | **160/160 inchangés** | `work/final-fix-frozen-identity.json` |

Les tests I1 suivent réellement fichier choisi→prévisualisation→confirmation d’import→snapshot Game→corps discover→résultat du serveur existant. Couverture :120 anciennes réussites sans parties transférées⇒épuisement explicite ; une connue⇒cible différente ; import non terminal +preuve révisée,free-00042,dailyV1 ; action admise sans aucune écriture réussie⇒fait pending conservé et transmis, sans le persister ; imports mixtes à horloge locale future simulée,V2 commun/non commun⇒119/120 candidats, sans conversion de targetId en seed. Cette horloge de fixture ne certifie aucune activation distante. Tests purs complémentaires : les trois familles de faits dépassent3000 occurrences mais restent3000 identités ;3001distinctes refuse ; variantes/refs erronées/futures exclues, aucune écriture ni mutation.

Le lot114 est ciblé (Game/intégration, deux rendus, découverte, profil/import, sauvegarde V2, sync/components, feedback/navigation), distinct de l’unique full387 historique et de sa qualification composée384/3non exécutés. Aucun nouveau fullsuite,oracle432,producteur365,trainingregen,transfert,preview,agent,cloud/push ou déploiement. Build verified-frozen120,sourceSHA `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`. Notices react-test-renderer/SQLite/MockTimers et Vinextclassification/PLUGIN_TIMINGS conservées, pas masquées.

Auto-revue : changements confinés à Game,lib/free-discovery et formatage Duels/ServerGame,tests et cette note ; aucun serveur,contrat de jeu/profil/synchronisation,migration/data/calendrier/runtime/V2/device-sync/pin ni art de flamme changé. Les98 preuves historiques gardent exactement leurs SHA+tailles,les manifestes/cutoffs ne changent pas. Aucune entrée de production modifiée après le build ; seuls rapport/note sont écrits ensuite. Les journaux frais restent au travail pour la copie finale du contrôleur dans outputs après gate ; aucune troisième archive de prépublication créée. Les preuves full/624 restent datées et réutilisées à leur SHA d’origine.
