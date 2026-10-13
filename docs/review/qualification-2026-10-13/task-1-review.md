# Revue indépendante — lot 1

**Verdict : Spec ✅ ; qualité Approved.** Aucun constat critique, important ou mineur actionnable dans le diff `7b0148b..42d383a`. Cette approbation concerne le socle du lot 1 ; elle ne vaut pas activation des modes ni qualification de publication.

## Périmètre et méthode

Lecture du brief, de la spécification approuvée, du rapport d’implémentation et du paquet de diff fourni, y compris les rulings du contrôleur. Les lectures additionnelles ont été limitées aux risques nommés : ancien wrapper de construction/environnement pour la compatibilité Sites, `lib/release.ts` pour les imports clients et la fermeture des modes, `verifyCheckpoint` pour la reconstruction transactionnelle après interruption. Aucune modification de code, de l’index Git ou de HEAD. Aucun sous-agent. Pas de nouvelle suite de tests : aucun doute concret supplémentaire ne nécessitait un test ciblé.

## Spec ✅ / ❌ / ⚠️

| Exigence du lot | Verdict | Éléments examinés |
| --- | --- | --- |
| D01 — source, version publique et disponibilité explicites | ✅ | `docs/FULL-REVIEW-FOUNDATIONS.md` distingue public32, source canonique, surfaces fermées et bindings déclarés sans les présenter comme des preuves de production. |
| D02 — commandes Windows/Linux, échecs et bornes | ✅ | `package.json`, `scripts/run-site.mjs`, `scripts/build-verified.mjs` : appels Node directs, arguments sans interpolation shell, codes enfant conservés, timeout124, erreur de lancement69, arrêt de l’arbre ; voie Linux d’installation officielle conservée. |
| D02 — V1 vérifié sans mutation de production | ✅ | `scripts/build-semantic-shards.mjs --verify` épingle l’index, compare manifest/source publics, recalcule les payloads et vérifie les objets compressés. Le build appelle ce mode ; le diff ne contient aucun asset V1 ni pin modifié. |
| Ruling — gzip canonique | ✅ | Le helper change uniquement l’octet OS9 en3 avant empreinte/installation. Corpus, index, cible V2 et génération V1 explicite le consomment. Test golden sur un vrai objet V1 complet ; tests V2 avec vérificateurs indépendants. Aucun changement des configurations numériques ou pins. |
| Ruling — transactions des index jetables | ✅ | Ingestion et vérificateur regroupent4096 tentatives d’insertion ; déduplication inter-lots inchangée, rollback final, reconstruction sous verrou. La reconstruction des checkpoints conserve ses transactions existantes par segment. Les écritures durables, checkpoints et lock restent les autorités. |
| D10 / D26 — navigation partagée accessible | ✅ | Liens Jouer/Explorer/Profil, `aria-current`, navigation nommée, retour interne validé, callback sur clic ordinaire, focus visible et cibles44px. CSS partagé brun/orange ; flamme approuvée non modifiée. |
| D24 — variante embed et frontière exacte | ✅ | Deux origines contrôlées exactes ; version et clés du message fermées ; source de fenêtre obligatoire ; hauteur entière bornée. Réponse vers l’origine validée. CSP limitée à `/embed` et `/embed/`, aucune wildcard ; autres directives conservées. |
| D25 — publicité inactive et confidentialité | ✅ | `AdPlacement` retourne `null` sur `skip`. Script réel AdSense conservé ; documentation reconnaît sa requête tierce et ne fabrique ni régie ni consentement. |
| D27 — diagnostic local, borné et sans texte sensible | ✅ | Schéma fermé `type/context/occurredAt`, cap100, limite32Kio, refus des données enrichies/futures/corrompues sans écrasement. Export et effacement explicites, aucun envoi réseau. Limites multi-onglets et d’interprétation documentées. |
| D28 — français et valeurs inconnues | ✅ | Scores sans remise à l’échelle, virgule, dates Paris, dates civiles invalides refusées, vocabulaire partagé explicite. |
| Invariants V1 / restauration / clients | ✅ | Aucun changement des identités, graines, calendrier, oracle, stockage, objets V1 ou flamme. Nouveaux composants clients sans corpus serveur. Aucun branchement Game ni effet rejoué à la restauration dans ce lot. `EXTRA_MODES_ENABLED=false`. |
| Adoption Game/pages avancées | ⚠️ | Raccordement navigation, formatage et actions réelles du diagnostic explicitement transmis aux propriétaires des lots suivants ; Game appartient au lot2. Ce report est conforme au brief. |
| QA globale et publication | ⚠️ | Installation complète Windows/Linux,11 échecs préexistants Windows/chemins/symlinks, cross-origin réel et QA visuelle/accessibilité restent en lots7/8. Rien ici ne prouve leur réussite. |

Aucune non-conformité ❌ identifiée dans le périmètre approuvé du lot1.

## Strengths

- Vérification V1 de production sans régénération, avec empreinte figée et comparaison complète du payload ; les tests de corruption contrôlent aussi l’absence de mutation.
- Optimisation SQLite localisée aux index jetables, sans affaiblissement global de durabilité ni partage d’implémentation avec le vérificateur indépendant ; oracle scalaire et reprise à la frontière4096 ajoutés.
- Contrat embed fermé à la fois sur origine, fenêtre, version et champs ; suppression de XFO confinée à la réponse dont la CSP explicite autorise l’alias contrôlé.
- Diagnostic sans référence de puzzle ni texte libre, préservation des schémas inconnus, limites de mesure honnêtes ; aucune statistique d’audience inventée.
- Interfaces et responsabilités des prochains lots précisément documentées, sans présentation prématurée d’une disponibilité publique.

## Findings — Critical / Important / Minor

**Critical : aucun.**

**Important : aucun.**

**Minor : aucun constat actionnable.** Aucun couple `fichier:ligne` de défaut n’est donc émis.

## Validation et limites

Preuves déjà exécutées fournies avec le lot : runner ciblé37/37 vert, TypeScript exit0, construction complète exit0 avec vérification V1 non mutative, lint ciblé et diff-check exit0. Ces résultats n’ont pas été réexécutés pendant cette revue.

La suite générale rapportée est159/172, avec13 échecs : les2 collisions temporaires de régénération V1 ont été reprises avec succès après restauration et build non mutatif ; les11 échecs Windows restants sont explicitement à traiter/qualifier en lots7/8. La revue ne les transforme ni en réussite ni en régression du lot1. Les fixtures de compression V2 ne prouvent pas, à elles seules, la restauration complète des pins de production ou la qualification R2/Worker. Le navigateur cross-origin réel reste à vérifier en lot8.

**Décision qualité : Approved.** Le lot1 peut servir de base aux lots suivants ; fermeture des modes avancés et étapes de qualification finales restent obligatoires.
