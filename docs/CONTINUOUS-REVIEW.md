# Registre d’amélioration BRAIZ

État du 31 octobre 2026. Le dernier dossier privé est `BRAIZ-Heartbeat-2026-10-31-0037`, situé deux niveaux au-dessus du dépôt. Les dossiers `BRAIZ-SEO-2026-10-30` et `BRAIZ-Qualification-2026-10-29` conservent les contrôles SEO et Google/AdSense précédents. Vérifier la version active du Site existant avant toute nouvelle modification.

## Dernier lot contrôlé

- Cercles : six blocages réseau reproduits, pendant la lecture initiale ou après une création déjà enregistrée sans réponse reçue. Le transport existant limite maintenant l'attente à 15 secondes par requête, corps compris.
- L'identité et la liste doivent être lues avant d'afficher leurs commandes. Une relance du chargement est disponible après erreur ; elle ne crée ni identité ni cercle et conserve l'invitation. Aucun POST automatique ; la création relancée manuellement conserve son identifiant pour éviter un doublon.
- 37 tests ciblés réussis, dont sept nouveaux ; TypeScript et construction réussis. Attente, erreur et relance confirmées dans un navigateur local isolé. Capture d'image indisponible, états accessibles conservés dans le dossier privé.
- Aucun changement de moteur, API serveur, sauvegarde ou lecteur historique. Lecture ciblée de l'enregistrement hors connexion et du transfert de profil sans autre défaut confirmé. Aucun nouveau nettoyage ni contrôle SEO/performance justifié ; annonces inactives et blocages externes inchangés.

## Lot précédent, synchronisation facultative

- Synchronisation facultative : six blocages réseau reproduits avant correction, pendant la lecture de l'identité ou de la copie, puis après un envoi ou une suppression déjà appliqués par le serveur mais sans réponse reçue.
- Le transport existant limite chaque requête à 15 secondes, corps JSON compris. La configuration attend les lectures confirmées avant d'annoncer une identité ou une copie absente. Les commandes redeviennent disponibles après échec ; aucune écriture n'est répétée automatiquement. Une relecture permet de vérifier l'état distant réel.
- 44 tests ciblés réussis ; TypeScript et construction réussis. Recette locale dans le navigateur : attente, erreur, bouton libéré, relance manuelle et identité vérifiée. La capture d'image est indisponible ; les états accessibles sont conservés dans le dossier privé. Aucun compte réel utilisé pour cette simulation.
- Aucun changement de style, moteur, score, rang, API serveur, sauvegarde ou lecteur historique. Aucun retrait de code supplémentaire justifié ; annonces inactives et blocages externes inchangés.

## Lot précédent, invitations

- Invitations : la vérification pouvait rester bloquée sans relance lorsqu'une réponse réseau ou son corps JSON n'arrivait pas. Quatre cas reproduits avant correction, sur duels et cercles.
- Le composant partagé utilise le transport existant avec un délai de 15 secondes. Le lien est conservé ; la relance est manuelle et ne rejoint jamais une partie. Les gardes de changement de lien/identité et les contrôles d'expiration restent appliqués.
- 24 tests ciblés réussis, dont quatre cas nouveaux ; TypeScript et construction réussis après correction du typage de la simulation réseau. Journaux et preuve de publication dans le dossier privé. Aucun changement de présentation, API, calendrier, moteur, sauvegarde ou publicité.
- Lecture du calendrier d'archives, de l'entraînement historique et de la synchronisation personnelle sans autre défaut confirmé. Aucun retrait de code ni nouvelle campagne SEO/performance justifiés.

## Lot précédent, partage des duels

- Partage des duels : cinq régressions reproduites avant correction. Une réponse tardive pouvait ouvrir le texte du duel précédent, afficher « Résultat copié » sur le suivant, survivre à un aller-retour entre duels, copier après fermeture de la page ou ouvrir un second dialogue au-dessus des règles.
- Une révision propre au partage invalide ces réponses au changement de duel et à l'ouverture des règles. La navigation existante protège la sortie de page. L'actualisation automatique du même duel conserve le partage courant ; une copie déjà demandée au système ne peut pas être annulée rétroactivement.
- 29 tests ciblés réussis, dont six cas nouveaux ; TypeScript et construction réussis. Journaux et preuve de publication dans le dossier privé. Aucun changement visuel, sémantique, de sauvegarde, d'API ou de publicité ; aucun nouveau contrôle SEO/performance sans nouveau signal.
- Lecture ciblée des transferts de profil/sauvegarde et de l'actualisation des duels sans autre défaut confirmé. Aucun nettoyage supplémentaire justifié dans ce lot.

## Lot précédent, partage du plateau

- Partage de résultat : un refus tardif du presse-papiers pouvait ouvrir le dialogue de copie manuelle après une navigation vers le profil. Un refus tardif du partage natif pouvait aussi lancer une copie automatique de l’ancien résultat après cette navigation. Les deux comportements ont été reproduits avant correction.
- Les suites asynchrones du partage vérifient désormais la partie et la navigation qui les ont déclenchées. Une réponse obsolète n’ouvre plus de dialogue, ne déclenche plus de copie de secours ni de notification. Un dialogue de règles ouvert entre-temps n’est pas remplacé par le refus tardif de copie.
- Le partage courant, sa copie manuelle de secours et l’annulation native restent disponibles. La copie déjà demandée au navigateur ne peut pas être annulée rétroactivement ; seuls ses effets tardifs dans l’interface sont ignorés.
- Aucun changement de contenu partagé, score, rang, sauvegarde, lecteur historique, moteur ou publicité. Contrôles et identifiants de publication dans le dossier privé.
- 41 tests du plateau réussis, dont les quatre nouveaux cas de partage ; TypeScript et construction réussis. Aucun changement visuel ni nouvelle mesure de performance revendiquée.

## Lot précédent, SEO et flamme

- SEO : les neuf pages du sitemap étaient déjà rendues côté serveur, indexables, avec une H1, des titres/descriptions distincts et des canoniques. Aucun lien cassé parmi leurs liens HTML internes et les quatre sources externes contrôlées. Pas de migration SSR nécessaire.
- Les FAQ visibles alimentent désormais un balisage FAQPage identique ; les trois guides éditoriaux reçoivent Article sans auteur ni dates inventés. Les fils d’Ariane deviennent une navigation accessible, également visible dans le guide Duel. Un exemple de polysémie complète le guide de proximité.
- Performance : premier test mobile simulé (390 × 844, 1,6 Mbit/s, 150 ms, CPU ×4, cache et service worker contournés) : LCP 3,092 s, chargement 4,554 s, CLS 0,0054. Ce test ponctuel ne constitue pas une mesure terrain au 75e percentile.
- La flamme affichée utilise une variante WebP de 768 × 960, 72 006 octets contre 137 010, avec préchargement prioritaire. Son gabarit, sa transparence et son remplissage restent conservés. L’ancienne URL demeure disponible pour les clients historiques.
- Neuf tests ciblés SEO/flamme réussis. TypeScript réussi. Construction, publication et mesures finales consignées dans le dossier privé pour conserver l’identifiant réel de la version publiée.
- Blocages nouveaux : le connecteur Search Console renvoie un abonnement expiré ; la session navigateur Google est utilisée par la personne, aucune nouvelle soumission effectuée. Le sitemap était déjà traité avec succès au dernier contrôle. `www.braiz.io` ne résout pas en DNS ; l’apex fonctionne, un accès à la zone est nécessaire pour raccorder l’alias. Les coordonnées de l’auteur restent à fournir explicitement. Aucun backlink acquis ni annonce activée.

## Lot précédent, duel et clavier

- Duel : le changement de manche efface l’erreur de la manche quittée. Une nouvelle erreur reste visible, les mots refusés ne consomment aucun essai.
- Clavier : activer le logo avec le burger fermé ne bloque plus le retour du focus au bouton après ouverture puis fermeture du menu avec Échap. Le transfert du focus vers une destination ou l’aide reste préservé.
- Lot limité à ces deux défauts reproduits. Le serveur, les sauvegardes, les lecteurs historiques et les calculs ne changent pas. Aucun code retiré sans preuve d’inutilité ; aucun achat ni changement publicitaire.
- 49 tests ciblés de plateau, duel et navigation réussis ; les 4 tests de navigation ont été rejoués après correction du typage de leur harness. TypeScript et build réussis. Recette navigateur réelle : retour du focus après Échap, destination Profil et ouverture/fermeture de l’aide confirmés. Preuves et publication dans le dernier dossier privé. Les contrôles Google/AdSense n’ont pas été rejoués sans nouveau signal.

## Lot précédent, saisie et synchronisation

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
