# Task 4 — synchronisation facultative, social et coopération

**Terminé et commité**, branche `codex/full-review-implementation`.

- Base confiée : `b7d1560d255d5063e0a2ddad3a8ed7804eaae237`.
- HEAD livré : **`886b9472f80bab96c8bfb52542fa10e061dddf10`**.
- Commit : `feat: add optional device sync and truthful social cooperation`.
- Documentation versionnée exhaustive : `docs/FULL-REVIEW-SOCIAL-SYNC.md` (matrice IDs, portée des données, schéma, contrats, suppression/récupération, garde Game, tests et limites).
- Arbre Git propre après commit. Aucun push, déploiement, serveur de prévisualisation, compte/invitation de production, activation de mode avancé ou V2. `EXTRA_MODES_ENABLED=false` conservé.

## Matrice et réalisation

| IDs | Statut dans le lot | Fichiers principaux |
| --- | --- | --- |
| D16 | Implémenté : entrée sans invitation distincte ; état de lien avant identité ; ready/accepted/owner/expired/revoked/full/excluded/unknown ; retour après récupération gardé dans le même onglet, sans secret de récupération en URL ; visite neutre. | `components/invitation-status.tsx`, circles/duels/server-game, `app/api/invitations/route.ts` |
| D17 | Implémenté : défi courant en tête, résultats réels sélectionnés/datés, archive choisie, membres/invitations regroupés et gestion autorisée seulement ; défi appartenant à un autre cercle refusé. | circles, `app/api/circles/route.ts`, `lib/circle-store.ts` |
| D18 | Implémenté : participants réels, expiration/date Paris, listes avec cycle de vie calculé, manches/essais/restants, bilan/égalité/abandon/revanche. | duels, `lib/duel-store.ts` |
| A06 | Implémenté : copie personnelle facultative via identité existante, aperçu/confirmation, corps borné, format fermé, fusion non destructive, refus de versions/corruption/frontières incompatibles, contrôle optimiste, suppression propre et accès à révocation. | `lib/device-sync.ts`, `components/device-sync.tsx`, `app/api/sync/route.ts`, server-store, profile-panel |
| A08 | Implémenté : objectif propriétaire/semaine Paris 0–20, progression et contributions dérivées de vrais IDs de parties serveur terminées, déduplication, état accompli, aucune récompense/pression quotidienne. | circle-store, circles, nouvelle table goals |
| A02 serveur | Implémenté : reprise propriétaire par ID, reprise après récupération de la destination `?game=`, liste datée ; aucun crédit serveur depuis la copie personnelle. | server-game, stores/auth existants |
| D03/D10/D26 social | Implémenté : AppNavigation, Envoyer, formulaires/états/portée accessibles textuellement ; recette visuelle responsive restant au lot8. | composants sociaux |

## Contrats et décisions

**Format de synchronisation distinct** : `braiz-personal-device-sync`, version1, provenance personal-unverified, corpus/règles V1 explicites. Profil validé avec le moteur de transfert existant et ses mots/preuves réels + sauvegardes classiques en cours (mots, scores, ordre/date éventuelle, épingles/indices/contextes). Les graines avec zéros initiaux restent exactes. Maximum 1Mio UTF-8, 1000parties, 3000essais/partie ; limite cohérente avec une ligne D1, refus sans troncature. Aucun envoi automatique, aucun secret/clé inconnue, pas de chiffrement de bout en bout promis. Les états propres aux autres variantes et le parcours de voyage complet ne font pas partie du format ; portée visible et documentée.

Les clés des enveloppes/parties/essais/contextes sont fermées. Même l’ancienne copie brute V1 ne peut transporter de champs inconnus. Validation de toutes les données avant toute écriture, refus des dates futures, frontières V1 incompatibles, références/récompenses invalides. Les copies antérieures contenant des données inconnues restent préservées, pas écrasées.

L’aperçu stage sans écriture. Révision locale = octets des clés pertinentes + activités/profil en mémoire. Révision distante = entier CAS par propriétaire. Union essais par mot, scores cohérents, épingles sans dépassement ; indices consommés conservés, dépassement de trois indices/épingles refusé. Le serveur refuse un remplacement supprimant des faits/preuves (variantes incluses), parties, essais, indices, épingles/contextes distants. Une ancienne copie dont une partie a été terminée ailleurs peut nécessiter suppression distante explicite puis nouvel envoi ; aucune suppression locale automatique.

**Suppression** : payload NULL, révision incrémentée, tombstone guest/version/revision/date gardée pour empêcher un ancien envoi de ressusciter la copie. Ni données locales, ni autres utilisateurs, ni parties serveur effacés. Arrêt local du panneau distinct de révocation de la session ; lien explicite vers la révocation existante. Récupération existante par code en corps HTTPS, identité identique et anciennes sessions révoquées, aucun OAuth nouveau.

**A08** : objectif owner-only, semaine dérivée serveur, contribution COUNT DISTINCT circle_game_id, état won et completed_at dans [lundi00:00Paris,lundi suivant00:00Paris[, challenge de la même semaine, membre actif. Contrainte unique participation existante et unique objectif cercle/semaine. Bornes exactes à la milliseconde, y compris semaine du passage à l’heure d’hiver. Pas de mots dans la projection collective.

## Extension d’ownership Game approuvée par le contrôleur

Modification minimale de `components/game.tsx` et `lib/device-sync-admission.ts` pour empêcher une partie pré-fusion gardée en mémoire de réécrire la copie fusionnée.

- `ProfilePanel.onDeviceSync` séparé de l’import de profil seul.
- Révision de plateau = requête/navigation/identité ; null si chargement/jeu/voyage occupé. Derniers callbacks mis à jour en layout effect.
- Confirmation visuellement désactivée si occupé et **garde à l’instant du commit**, après attente réseau et staging ; une ancienne prop capturée ne suffit pas.
- Fusion admise invalide l’ancien requestRef, annule timers/focus différés et feedback, puis relit seulement la sauvegarde compatible du plateau courant ; la liste de reprises est actualisée.
- Aucun changement de saisie/vue/navigation/focus, aucun son/toast/activité profil/récompense/diagnostic reconstruit depuis l’import.
- Les événements storage pour le jeu courant réconcilient aussi les autres onglets silencieusement et invalident leur ancienne réponse. Versions futures/corrompues préservées et écriture bloquée.
- Test de transition réel sur les bibliothèques : applyDeviceMerge → vieux POST retardé neutralisé → restoreLegacyGame → writeAdmittedGame du prochain essai conserve mots et épingles de l’union. Occupation/changement de navigation bloque le commit sans écriture.

## Migration append-only

`npm run db:generate` a généré `0005_sudden_toro.sql`, `meta/0005_snapshot.json` et ajouté l’entrée au journal Drizzle. Nouvelles tables `braise_device_snapshots` (propriétaire/revision/version/payload/date) et `braise_circle_goals` (cercle/semaine/cible/date). **Aucune modification des migrations0000–0004**. Triggers de révision/victoire historiques conservés. Aucune modification du corpus, moteur, oracle, flamme, segments, R2 ou active.json.

## Preuves finales

1. **117/117 tests ciblés**, `node scripts/test-social-sync.mjs`, exit0 : device-sync, social-sync, server-store/auth/récupération, profile-storage, game, game-core-review, game-review-fixes, compatibility, profile-panel, weekly-ritual et foundations. Log `work/task4-tests-final.log`.
2. **D1 local réel qualifié au HEAD livré**, `node scripts/qualify-social-local.mjs`, exit0. Runtime Miniflare isolé sous `work/d4-*`, migrations0000→0005, session/CSRF/origine, PUT/GET/DELETE sync, stale409, révocation403, inspection neutre d’invitation, jeu gagné via trigger/objectif/déduplication. Scénarios à identités et scores de test strictement locaux, aucune publication. Runtime disposé à la fin. Log `work/task4-d1-final.log`.
3. **TypeScript**, `npm run typecheck`, exit0. Log `work/task4-typecheck-final.log`.
4. **Build final terminé avec exit0**, `npm run build`, après derniers changements applicatifs. Log `work/task4-build-final.log`, ligne `Build complete`. Source figée vérifiée : SHA256 `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`, 120cibles, raw21607680, compressed20039248, manifest380041. Aucun processus de build du lot laissé en attente.
5. **Lint** : tous fichiers nouveaux/modifiés hors Game sans erreur ni avertissement ; derniers ajustements lib/tests aussi relus. Game conserve exactement **9erreurs/5avertissements préexistants**, mêmes règles et quantités que `git show HEAD-avant-lot:components/game.tsx` : états/refs/immutabilité/pureté React, lien natif et warnings existants. Comparaison `work/task4-lint-game-baseline.json` / `work/task4-lint-game-final.json`. Suppression locale documentée du faux positif sur l’epoch requestRef désormais partagé avec la garde. **Ne pas présenter le lint global comme vert.**
6. `git diff --check` et contrôle staged réussis ; arbre propre après commit.

Auto-revue : corrections de la borne Paris à+1seconde du helper historique (nouvelle borne dédiée, V1 inchangée), protection des variantes de faits cloud, indices fusionnés, retour d’invitation, garde de rendu asynchrone et état mémoire du plateau. Le premier essai D1 à chemin long a rencontré SQLITE_CANTOPEN Windows ; le script reproductible crée un chemin court isolé `work/d4-*` et passe.

## Limites restantes / passage au lot8

Pas de suite exhaustive ni pipelines V2 lourds relancés : cadrage contrôleur respecté, les 11échecs Windows V2 connus du lot7 ne sont pas revendiqués corrigés. Pas de recette navigateur responsive/clavier/multi-onglets, de déploiement ou de comptes de production dans ce lot. Le contrôleur doit effectuer ces parcours dans la qualification finale, notamment récupération→invitation/reprise, upload→récupération→fusion→proposition suivante, refus au changement de vue/chargement/stockage, suppressions/révocations.

localStorage ne fournit pas une transaction atomique entre processus : staging/révision et restitution sur erreur réduisent les risques, mais une panne persistante peut empêcher une restauration intégrale. Dans ce cas l’UI annonce l’échec, jamais un succès. La portée classique1Mio et la conservation de tombstones sont documentées.


## Revue lot 4 — corrections du premier passage (12 octobre 2026)

Les trois P2 de la revue de `886b947` sont corrigés.

- **I1 / A06** : le bouton de préparation utilise le dernier snapshot mémoire après la lecture distante. `prepareDeviceUpload` rapproche son export (activités et préférences en attente incluses) avec une copie privée du stockage courant, via les validations du profil existantes. Aucune écriture locale, projection de récompense, son, toast ni focus. Un profil incohérent bloque l’envoi. Le test du vrai composant retarde le GET, fait échouer les écritures d’une préférence et d’un essai accepté, ajoute une préférence depuis un autre onglet puis vérifie les trois faits dans le PUT, avec les octets locaux inchangés.
- **I2 / A06** : fusion locale et remplacement cloud partagent la comparaison des faits d’essai : mot, score, rang, trouvé, indice/proposition et date connue. Une date absente est enrichie lors de l’union ; deux dates connues incompatibles ou une nature d’essai différente bloquent. Le remplacement cloud ne peut perdre une date connue ; il répond 409 avant écriture. L’ordre reste local : préfixe local conservé, nouveaux mots ajoutés, superset réordonné accepté. Les tests vérifient les deux directions d’enrichissement, les conflits et les octets/révision cloud inchangés après refus.
- **I3 / D16** : l’inspection est détenue par le parent des actions. Token, identité et tentative de relecture déterminent l’état courant ; les réponses retardées/annulées et le retour A→B→A ne peuvent réactiver une ancienne disponibilité. Création d’identité et acceptation d’une invitation exigent une disponibilité inspectée ; expiration vérifiée aussi au submit. Les états indisponibles offrent une sortie et la consigne de demander un nouveau lien. Les états accepté/propriétaire offrent la reprise de l’ID renvoyé uniquement à un membre/participant authentifié ; les GET de reprise contrôlent toujours la propriété. Les destinations sont typées et limitées à un identifiant, sans URL arbitraire. Les tokens valides restent dans la session de l’onglet pendant récupération, y compris après saisie manuelle. Les mutations serveur conservent leur contrôle d’autorisation et d’état.

Preuves finales de ce passage : **129/129 tests ciblés**, qualification **D1 local réel PASS** (migrations 0000–0005, perte de métadonnées refusée 409 avec copie intacte, destination de cercle propriétaire), **TypeScript et lint des fichiers modifiés hors Game exit 0**, **build V1 vérifié terminé exit 0 / Build complete**. SHA256 V1 inchangé `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`, 120 cibles. `git diff --check` passe. Aucune modification des migrations, du moteur ou du corpus dans cette correction. Game transmet seulement une lecture de son dernier état à la garde de préparation ; les protections asynchrones existantes restent conservées. Comparaison du lint Game avec 886b947 : mêmes 9 erreurs / 5 avertissements préexistants, mêmes règles (logs task4-fix1-lint-game-*).

Preuve de régression supplémentaire : les nouvelles assertions ont été compilées contre les fichiers immuables de `886b947`, sans remplacer le checkout : 9 échecs attendus sur 24 tests des trois suites concernées, notamment profil envoyé 1 fait au lieu de 3, métadonnées acceptées avec 200 au lieu de 409, création encore proposée et destination absente. Les mêmes suites et les suites affectées passent dans le code corrigé. Logs locaux : `work/task4-fix1-{tests,typecheck,lint,d1,build,red-proof}.log`.

Les tests d’interaction utilisent `react-test-renderer` 19.2.6 (dépendance de développement versionnée, avertissement de dépréciation conservé dans le log). Ils exercent les vrais hooks, clics et formulaires avec réseau contrôlé ; ils ne remplacent pas la recette navigateur responsive/clavier du lot 8. Les limites précédentes de localStorage et de qualification finale demeurent. Aucun serveur de prévisualisation, compte de production, push ou déploiement. Le drapeau des modes supplémentaires reste désactivé.


### Frontière I1 : profil en mémoire et sauvegarde jouable

Le libellé du composant précise désormais « parties classiques en cours enregistrées localement ». À la préparation, après l’attente réseau, une occupation du plateau bloque l’envoi. La garde fournie par Game relit son dernier état via un layout effect ; le préparateur compare ses essais, indices, épingles et dates connus à la sauvegarde persistée. Une partie absente ou appauvrie provoque un refus explicite dans l’interface : « La partie en mémoire n’est pas entièrement enregistrée. Envoi refusé pour éviter une copie incomplète. Réessayez après une sauvegarde réussie. » Aucun état en mémoire ne se substitue silencieusement à une sauvegarde inconnue/future/corrompue. Sans plateau monté, un essai classique en attente du profil doit lui aussi exister dans une sauvegarde jouable ; les parties déjà terminées et les variantes hors périmètre restent hors de cette copie.

Le nouveau test du vrai bouton couvre les quatre cas partie absente/périmée × profil en attente/profil persisté avec plateau en mémoire. Aucun n’offre la confirmation ni ne modifie les octets locaux. Le cas positif conserve les faits de profil en attente lorsque la partie jouable est correctement enregistrée. Après cette extension : 129 tests réussis, TypeScript exit 0, lint ciblé hors Game exit 0, comparaison Game inchangée, build final terminé `Build complete` / exit 0. Les changements ultérieurs à ce build sont uniquement documentaires ; aucun serveur ni build laissé actif.


HEAD livré après corrections : `ac02ea2599d956b2ce8ce78643726ef762e47d11` (commits `36497bf` puis `ac02ea2`, base relue `886b947`). Arbre Git propre et diff depuis 886b947 sans erreur de whitespace. Build final complètement terminé et processus collecté avec exit 0 avant remise ; aucun changement applicatif ultérieur.


## Revue lot 4 — correction 2, I1 résiduel uniquement

Base relue : `ac02ea2599d956b2ce8ce78643726ef762e47d11`. Le rapport ciblé `task-4-fix-review.md` approuve I2/I3 et relève uniquement une ancienne confirmation encore disponible après refus d’une nouvelle préparation.

Correction limitée à `DeviceSync`, une empreinte locale dans `lib/device-sync.ts`, deux tests du vrai composant et cette documentation. Au démarrage d’une préparation, l’ancien envoi est retiré immédiatement, avant le GET. Un refus de sauvegarde ou un échec réseau le laisse absent. Une référence synchrone à l’objet préparé interdit également l’exécution d’un ancien gestionnaire de confirmation après invalidation, annulation ou remplacement. L’aperçu distant retire aussi l’envoi précédent dès son démarrage.

Une confirmation consomme sa préparation avant toute vérification et n’utilise que sa révision distante enregistrée. Avant PUT, elle recontrôle la disponibilité et la révision du plateau, l’empreinte des données locales et des faits mémoire (profil, preuves, partie courante), puis l’admission de la sauvegarde jouable. L’empreinte est contrôlée à nouveau après ce staging synchrone. Une évolution détectée exige une nouvelle préparation ; aucun ancien payload n’est envoyé par ce chemin.

Preuve rouge avant correction : **131 tests, 129 pass, 2 fail**, les deux nouveaux scénarios constatent respectivement la confirmation encore présente et un PUT indu (`work/task4-fix2-red.log`). Preuve verte finale : **131/131 tests ciblés, exit 0**, `node scripts/test-social-sync.mjs` (`work/task4-fix2-tests.log`). Les vrais clics couvrent préparation réussie → nouvelle partie absente/périmée → préparation refusée, et préparation réussie → nouveau GET en attente puis échec réseau ; aucun bouton de confirmation ni PUT, même en rappelant l’ancien gestionnaire. La confirmation directe est aussi refusée après changement du stockage, des faits mémoire du profil, du plateau en mémoire, de son occupation ou de sa navigation. Le succès d’un envoi inchangé reste couvert par le test antérieur de rapprochement mémoire/stockage.

**Vérifications finales collectées :** TypeScript exit 0 (`work/task4-fix2-typecheck.log`), lint des trois fichiers source/test modifiés exit 0 sans diagnostic (`work/task4-fix2-lint.log`), build final **exit 0 / Build complete** (`work/task4-fix2-build.log`). Qualification immuable V1 inchangée : `verified-frozen`, SHA256 `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`, 120 cibles, raw 21607680, compressed 20039248, manifest 380041. Aucun changement applicatif après ce build ; aucun processus de build laissé en attente. Diff et index sans erreur de whitespace avant commit.

I2/I3, Game, les API, les migrations et le serveur ne sont pas modifiés dans cette correction ; D1 n’est donc pas relancé. Les preuves D1 et les limites de la livraison précédente restent applicables : recette navigateur au lot 8, localStorage sans transaction interprocessus, lint Game préexistant inchangé, avertissement de dépréciation du renderer de test. Aucun audit large, pipeline V2 lourd, serveur de prévisualisation, push ou déploiement.


HEAD livré correction 2 : `0886549b3231ee0026764d0ac2c9fd67f822bf85`. Arbre propre après commit ; diff depuis ac02ea2 sans erreur. Build final complètement terminé, exit 0 collecté avant remise.
