# Registre d’amélioration BRAIZ

État du 29 octobre 2026. Le dernier dossier privé est `BRAIZ-Heartbeat-2026-10-29-2124`, situé deux niveaux au-dessus du dépôt. Le dossier `BRAIZ-Qualification-2026-10-29` conserve la qualification éditoriale et les vérifications Google/AdSense précédentes. Vérifier la version active du Site existant avant toute nouvelle modification.

## Dernier lot contrôlé

- Saisie rapide : le refus tardif d’un doublon canonique ne marque plus le mot suivant comme invalide. Le refus reste lisible si le champ est inchangé ; aucun essai ni indice consommé.
- Synchronisation : une branche distante ne peut plus ajouter de mots après une victoire locale. Refus avant mutation en cas de conflit, fusion des préfixes compatibles, dates et métadonnées de fin conservées.
- La sauvegarde complète et la synchronisation partagent désormais la même garde de fin de partie ; l’ordre des épingles et la priorité de la partie gagnée sont couverts par régression.
- Deux dialogues sans chemin d’ouverture, leurs imports/fonction exclusifs et dix règles CSS orphelines supprimés. Le mode de défi historique et ses liens restent disponibles.
- Contrôles ciblés : 37 tests du plateau et 43 tests de sauvegarde/synchronisation réussis. Suite complète : 539 réussites, aucun échec, 3 tests de liens symboliques ignorés faute de privilèges Windows. TypeScript et build réussis. Aucun changement visuel des écrans accessibles ; pas de nouvelle campagne de captures.
- Aucun changement de rang, score, corpus, partie existante ou publicité. Pas de nouvelle campagne Google/AdSense sans changement d’état observé.

## Lot précédent, qualification et nettoyage

- Qualification éditoriale complète des 475 cibles : 64 voisins relus par cible, 30 400 au total. 361 retenues, 112 réserves, 2 exclusions proposées pour une prochaine édition. Détails et mots dans le dossier privé uniquement. Aucun rang, score, calendrier ou mot d’une partie existante modifié.
- 57 fichiers UI inutilisés et 14 dépendances directes retirés. Inventaire reproductible : `node scripts/audit-code-usage.mjs`. Voir `CODE-CLEANUP.md` pour les limites du graphe et les lecteurs historiques conservés.
- README et architecture réécrits selon le fonctionnement actuel ; anciens contrats conservés dans leur documentation dédiée.
- Résumé du profil : absence de médiane affichée `n/d`, libellé accessible complet, colonnes alignées en haut sur mobile.
- Règles et confidentialité mises à jour pour distinguer sauvegarde complète, profil seul et accès aux duels.
- Écran hors connexion corrigé : référence obsolète à la température remplacée par la proximité, titre direct. Cache de cet écran versionné séparément ; packs téléchargés conservés.
- Suite complète : 531 réussites, aucun échec, 3 tests de liens symboliques ignorés faute de privilèges Windows. TypeScript et build réussis. Les captures du dossier documentent les vérifications visuelles réellement effectuées.

## Points ouverts qui ne justifient pas une nouvelle refonte

| Sujet | Fait ou limite | Suite utile |
| --- | --- | --- |
| Google | Propriété accessible ; sitemap de 9 URL traité avec succès, dernière lecture le 26 octobre. Rapport du 23 octobre : 8 indexées, 4 non indexées dont 2 en attente. | Consulter les confirmations d’inspection dans le dossier privé. Ne pas renvoyer répétitivement une demande déjà acceptée. |
| AdSense | BRAIZ en attention requise depuis septembre : contenu insuffisant et écrans sans contenu d’éditeur. ads.txt public correct ; son état dans la console reste « Introuvable ». | Lire `Google-AdSense.md`. Ne pas activer les annonces ni prétendre l’acceptation obtenue. |
| Consentement publicitaire | Le panneau Google n’a pas chargé ; état de ses messages non vérifié. Aucune intégration CMP active dans le produit. | Vérifier puis intégrer une CMP certifiée avec consentement réel, retrait et refus testés avant activation. |
| Éditeur | L’utilisateur a demandé de ne pas publier ses coordonnées pour l’instant. | Respecter ce choix ; ne pas déduire un contact public de son compte connecté. |
| Qualification | Revue par assistant, pas une étude de joueurs ; contrôle des colonnes figées, pas un recalcul complet depuis les vecteurs source. | Évaluer une prochaine édition séparée si les problèmes signalés le justifient. |

## Règle de boucle

Une observation concrète, une correction bornée, les contrôles nécessaires, une vérification visuelle si l’interface change, puis publication sur le même Site. Garder les parties et lecteurs historiques. Ne pas fabriquer de trafic, d’avis, de rangs ou de mesures. N’ajouter ni texte marketing ni animation sans besoin observé.

Ne pas répéter une campagne complète de tests sans changement ou doute nouveau. Ne pas supprimer des outils CLI, lecteurs historiques ou imports dynamiques sur la seule base d’un graphe TypeScript. Ne pas transformer une liste d’exports candidats en suppression automatique. Mettre à jour ce registre lorsqu’un nouveau problème confirmé est traité.
