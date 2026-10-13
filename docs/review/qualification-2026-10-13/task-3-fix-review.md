# Task 3 — re-revue indépendante du correctif 1

Verdict : **Approved — 0 Critical, 0 Important, aucun défaut résiduel ou nouvelle régression identifié dans le périmètre**.

HEAD vérifié : `b7d1560d255d5063e0a2ddad3a8ed7804eaae237`. Base : `fbcf6d652578754a0f580d34ad30745fce5782a1`. Revue limitée au paquet `review-fbcf6d6..b7d1560.diff`, aux remarques I1/I2 de `task-3-review.md` et à l’appendice « Correctifs après revue — tour 1 » du rapport. Le diff Git correspond aux cinq fichiers annoncés, 37 insertions et 11 suppressions. Aucun élément précédemment approuvé n’est rouvert.

## I1 — corrigé

Le tableau de `ProfileTransfer` distingue maintenant les faits de progression et mots associés inclus, avec ordre, date et référence de partie, des sauvegardes complètes des parties en cours, scores détaillés et épingles exclus. Le paragraphe avant transfert, le message après téléchargement et la documentation sont cohérents avec cette portée ; les mots en clair sont explicitement signalés. Aucune suppression de preuve ni modification du format, de la version ou du scope n’apparaît dans le diff ; `lib/profile-storage.ts` reste inchangé.

Le nouveau test a été relu : il utilise le vrai chemin `loadLocalProfile` → `recordLocalGameProgress` → `createLocalProfileExport`, avec une proposition acceptée `maison` dans `free-1`. Il vérifie `word`, `order=1`, `occurredAt=2026-10-12T10:00:00.000Z`, `puzzleRef.id=free-1`, l’absence de température/rang et de sauvegardes/épingles, puis rend le composant réel en SSR et contrôle les deux lignes inclus/exclus et leur description. Le journal final contient son résultat **ok 82**. Il traite donc directement la contradiction signalée, sans simuler l’export.

## I2 — corrigé

Le générateur commun retire seulement `METHOD:PUBLISH` de la liste des propriétés, pour les fichiers actif et d’arrêt. Aucun organisateur ou destinataire n’est ajouté. Les assertions interdisent METHOD/ORGANIZER/ATTENDEE sur les deux fichiers ; les tests conservent UID commun, séquences 0/1, état CANCELLED, récurrence identique et absence d’alarme à l’arrêt. Les résultats correspondants sont **ok 10** et **ok 13** dans le journal final.

La documentation et le ruling du rapport décrivent correctement des instantanés autonomes sans transaction de planification. Vérification directe des sources primaires : [RFC5545 §3.7.2](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.7.2) autorise cette portée sans METHOD ; [RFC5546 §3.2.1](https://www.rfc-editor.org/rfc/rfc5546.html#section-3.2.1) impose l’organisateur pour PUBLISH. Le changement résout précisément la non-conformité relevée. Conversion DST, dates, stockage et gardes n’ont pas de modification ; `components/calendar-reminder.tsx` et la guidance de suppression manuelle restent inchangés.

## Preuves et limites

Journaux finaux consultés : **119/119 tests réussis, 0 échec, 0 ignoré** (`work/task3-fix1-targeted-tests.log`) ; TypeScript sans diagnostic ; construction « Build complete » ; lint ciblé vide. L’appendice rapporte leurs codes 0 et le SHA V1 inchangé. Contrôle indépendant `git diff --check` sur les deux commits : code 0. Aucun soupçon concret ne justifiait de répéter les tests, le typecheck, le build ou le lint déjà produits.

La compatibilité réelle et la suppression dans Apple/Google Calendar restent non qualifiées ; cette limite demeure explicitement documentée et ne bloque pas les deux corrections. Revue sans serveur, sous-agent, push, déploiement, modification de production ou données utilisateur ; seul ce rapport est écrit.
