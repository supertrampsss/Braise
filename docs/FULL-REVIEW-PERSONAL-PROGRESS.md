# BRAIZ — progression personnelle

Le Profil (`/?surface=profile`) présente directement le résumé, les trois objectifs hebdomadaires et leurs récompenses. Les détails de réussites, styles, préférences et données ont des sections distinctes. Les modes avancés restent désactivés ; les objectifs et styles personnels existants sont accessibles sans activer ces modes.

| Revue | Réalisation | Vérification |
| --- | --- | --- |
| D11 | Résumé court, objectifs visibles, détails consultables sur place ; ancienne longue fenêtre retirée | Profil rendu côté serveur dans le test ciblé, raccordement Game, TypeScript et build |
| D12 | Progrès x/y, fin de semaine à Paris, nom du style récompensé ; styles permanents | Suites weekly-ritual et profile-storage, contrat de récompense inchangé |
| D13 | Tableau du transfert avant toute action, aperçu sans écriture, confirmation et annulation | Suite profile-storage : conflits, référence/identité, révision, fusion, refus avant mutation |
| A13 | Réussites par mode, médianes avec échantillons explicites, indices utilisés dans les réussites, évolution datée et historique | Suite personal-statistics ; archives exclues de la série quotidienne |
| A10 | Proposition facultative après trois jours d’actions acceptées observées ; fichier calendrier borné, arrêt local et fichier d’arrêt | Suite calendar-reminder : DST, fuseaux, encodage, UID, état incompatible conservé |
| D26 Profil | Titres, boutons et états écrits, tableaux avec captions/en-têtes, zones défilables au clavier, cibles 44 px | Rendu SSR et CSS ; recette clavier/mobile par le contrôleur |

## Portée des données

Les résultats de ce profil sont personnels et locaux. Aucun taux de victoire, classement, activité de joueurs ni résultat serveur n’en est déduit. Les médianes d’essais et d’indices utilisent uniquement les valeurs renseignées dans les réussites enregistrées ; chaque valeur indique son propre nombre d’observations. L’absence vaut « Non disponible », jamais zéro. Le nombre d’indices affiché concerne les réussites, pas toutes les parties commencées.

L’évolution utilise exclusivement `completedAt` valide et déjà passé. La date du quotidien ou de l’archive est la date de l’énigme ; elle ne date pas artificiellement sa réussite. Les anciens faits sans date de fin exploitable restent dans le total, avec une limite explicite, mais pas dans l’évolution. Le tableau montre les 12 derniers jours observés à Paris, sans combler les jours absents ; l’historique est consultable par pages de 50.

L’export JSON reste `braise-personal-profile`, `scope=profile-only` : progression, faits de récompense et son. Les activités et preuves de progression comprennent les mots associés, leur ordre, leur date et leur référence de partie. Ces faits ne constituent pas une sauvegarde complète reprenable : sauvegardes des parties en cours, scores détaillés, épingles, animations, diagnostic, rappel et données serveur ne sont pas transférés. Le fichier contient ces mots en clair. Aucun lecteur, migration, solde V1, événement de progression ou mécanisme de crédit n’a été changé. Un import conserve le contrat d’aperçu, confirmation, révision et fusion existant. Les seules nouvelles observations de support sont les actions volontaires export/import elles-mêmes ; les faits importés ne deviennent jamais des sessions de jeu.

## Rappel facultatif

La proposition nécessite trois jours civils distincts à Paris avec une proposition acceptée observée dans le journal de support local. Ouvertures, imports, succès restaurés, préférences et anciens totaux ne suffisent pas. Le journal est borné à 100 actions et peut être incomplet ; l’absence de proposition de rappel ne prouve donc pas l’absence de jeu. Aucun rappel, téléchargement, permission push ni envoi automatique n’est déclenché pendant un rendu ou une restauration.

Le joueur choisit l’heure locale, le fuseau IANA reconnu par son appareil, la date de début et la durée : 30 jours par défaut, 1 à 90 explicitement. Le début doit être à venir. Chaque date civile est convertie en UTC depuis les règles réelles du fuseau (`Intl`). `DTSTART` et `RDATE` constituent une série finie ; aucun `RRULE` UTC fixe ne prétend conserver l’heure locale. Une heure doublée utilise sa première occurrence ; une heure inexistante refuse le fichier avec une explication. Aucun `TZID` sans `VTIMEZONE` n’est émis.

Le fichier utilise CRLF, texte échappé et repli des lignes à 75 octets UTF-8 sans couper un caractère. La série porte un UID aléatoire stable, un rappel `VALARM` au début et une durée de cinq minutes. Le dernier fichier préparé est conservé sous `braiz.calendar-reminder.v1`, séparément du profil ; les schémas futurs, données illisibles ou horaires altérés restent intacts et bloquent la création. La restauration et les mises à jour inter-onglets sont silencieuses. Le garde d’écriture refuse le remplacement connu d’un rappel préparé par un autre UID ; le stockage local n’est pas un protocole atomique entre processus.

« Arrêter dans BRAIZ » marque immédiatement l’arrêt local. Le fichier d’arrêt reprend UID et dates, incrémente `SEQUENCE` de 0 à 1, utilise `STATUS:CANCELLED` et retire l’alarme. Les fichiers actif et d’arrêt sont des objets iCalendar autonomes RFC5545 **sans propriété `METHOD`**, organisateur, destinataire ni invitation : aucune transaction de planification n’est revendiquée. **BRAIZ ne commande pas le calendrier externe : pour arrêter ses alertes, supprimer la série « Votre mot du jour — BRAIZ » dans ce calendrier.** Le fichier d’arrêt peut être ignoré par un client ; son téléchargement ne prouve ni ajout ni suppression. Cette portée est affichée près de chaque action. Un même rappel peut être retéléchargé, avec une indication sur les clients qui dupliquent les imports.

Références primaires : [RFC 5545, iCalendar](https://www.rfc-editor.org/info/rfc5545/) (lignes, TEXT, UID, recurrence, UTC et alarmes), [RFC 5545 §3.7.2](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.7.2) (absence de METHOD : instantané de calendrier sans transaction de planification), [RFC 5546 §3.2.1](https://www.rfc-editor.org/rfc/rfc5546.html#section-3.2.1) (PUBLISH impose un organisateur, raison de ne pas utiliser cette méthode ici).

## Qualification

`node scripts/test-personal-review.mjs` couvre les nouvelles fonctions, le rendu du Profil, profile-storage, weekly-ritual et tous les tests du runner core-review : **119 tests verts**, dont un export réel avec proposition acceptée vérifiant les mots présents et la description affichée. `npm run typecheck` et `npm run build` réussissent ; la construction vérifie les objets V1 figés sans les régénérer. Le runner général garde les mêmes suites, avec `react-dom` externe pour permettre le rendu SSR des composants Base UI.

La recette initiale du contrôleur a vérifié dans le navigateur le profil vide : 0 réussite, 0 jour de série, objectifs 0/15, 0/3, 0/2 et médianes « Non disponible ». La formulation du seuil de trois quotidiens a été corrigée en « Atteindre une série de 3 quotidiens de suite », sans confondre objectif et série réelle ; un test SSR reproduit la formulation ambiguë puis vérifie le correctif.

La suite lourde V2 inchangée n’a pas été répétée ici : les 11 échecs Windows préexistants restent suivis dans le lot de qualification. L’import dans Apple/Google Calendar, les alertes réelles, les réglages OS, la demande des joueurs, la compréhension et la recette navigateur/lecteur d’écran ne sont pas prouvés par ces tests unitaires ; le calendrier reste une option expérimentale explicite, sans promesse de compatibilité universelle.
