# Registre d’amélioration BRAIZ

État du 6 novembre 2026. Le dernier dossier privé est `BRAIZ-Review-2026-11-06-7bfec5a`, situé deux niveaux au-dessus du dépôt. Il documente la revue de la PR 8 intégrée dans main et le retrait de ses styles devenus inutilisés. La dernière publication vérifiée reste la version 64, documentée dans `BRAIZ-Correction-Pourcentage-2026-11-02`. Les livraisons précédentes restent conservées. Appliquer [SOURCE-OF-TRUTH.md](SOURCE-OF-TRUTH.md) et [HOSTING-MIGRATION.md](HOSTING-MIGRATION.md).

## PR 8 intégrée dans GitHub, en attente de déploiement

- Fusion GitHub `7bfec5a4878df9855594e3fe615c78c7aaffcb0d`, récupérée sans réécriture d’historique. La contribution ajoute une consigne de saisie, réaffiche le meilleur mot et son rang près de la jauge, et propose le partage natif ou la copie du lien d’invitation. L’état d’une invitation créée indique l’attente d’un adversaire.
- Deux règles `.duel-link-row` sont devenues inutilisées après le remplacement du formulaire d’invitation. Leur retrait repose sur la suppression du dernier élément correspondant dans la PR et sur la recherche de toutes les références suivies par Git.
- 80 tests ciblés réussis, aucun échec ni cas ignoré, TypeScript et construction réussis. Le build final après retrait des styles est conservé dans le dossier privé avec la vérification GitHub. Les contrôles visuels et la suite complète décrits dans la PR proviennent de son auteur. Aucune nouvelle recette visuelle indépendante n’a été effectuée pendant cette revue.
- Ce lot est conservé dans GitHub en attendant la chaîne de déploiement du propriétaire. Les accès Cloudflare/DNS et le transfert cohérent D1/R2 restent à préparer. AdSense reste inactif.

## Pourcentage tronqué : correction

- Défaut signalé par l'utilisateur après publication 63 et reproduit avec le composant réel : la hauteur de ligne de 0,8 limitait la zone du dégradé et coupait le bas des glyphes. Elle passe à 1,1, sans changer la taille de police ni les calculs de proximité.
- Contrôle local isolé avec le composant et les feuilles construites : chiffres et pourcentage complets sur ordinateur, à 390 et à 320 pixels CSS ; 16 % et 94 % restent sur une ligne et séparés de la flamme à 320 pixels. Captures et mesures dans le dossier privé. Ces valeurs sont des fixtures locales, aucune partie réelle n'a été modifiée.
- TypeScript et construction réussis. Aucune suite de jeu répétée pour ce changement CSS, aucun score, rang, lecteur ou stockage modifié. La correction s'applique au composant partagé des plateaux et des duels.
- Version 64 publiée sur braiz.io depuis `27a04d34fb44565cde89f67ae2cc08945273b9d5`, sur demande de l’utilisateur. Déploiement réussi et affichage vérifié ; preuves dans le dossier privé.

## Publication 63

- Commit exact `4ee9a905b3130e761301abdb290f9a475abb07f7`, version 63 publiée avec succès sur le Site existant et braiz.io à la demande explicite de l'utilisateur.
- PR 7 observée en production : pourcentage à gauche, flamme dessinée à droite, ligne Meilleur absente. Favicon SVG, PNG 48, Apple Touch et manifeste servis en HTTP 200 avec des octets identiques aux fichiers vérifiés. Aucune partie ni donnée privée modifiée.
- Le contrôle initial n'avait pas identifié la coupure du bas des chiffres, signalée ensuite par l'utilisateur et traitée dans le lot ci-dessus.

## Préparation de l'icône, publiée ensuite en version 63

- Demande utilisateur clarifiée : repousser la PR 7 et actualiser le favicon. La PR 7 est déjà dans main ; sa branche contient le même code applicatif. Aucune contribution n'a été écrasée ni fusion artificielle créée.
- Le favicon reprend désormais les trois aplats et les courbes de la flamme dessinée du jeu. Versions SVG, PNG 48/192/512, Apple Touch et maskable régénérées. Les liens du manifeste et des métadonnées portent une nouvelle version de cache ; l'identité de l'application installée est conservée.
- Dimensions et rendu de l'icône vérifiés, TypeScript et construction réussis. Les 78 tests de la PR 7 avaient déjà réussi lors du contrôle précédent ; aucune suite de jeu répétée pour ce seul changement d'icônes.
- Source poussée et garde GitHub exécutée, identifiant final dans le dossier privé. La publication séparée a ensuite livré cette icône et la PR 7 en version 63. Aucun changement des parties, scores, données privées ou publicités.

## Préparation de la PR 7, publiée ensuite en version 63

- PR 7 déjà fusionnée dans GitHub main : `c84025218fe812693e175f769025b486f1d846c3`. Les deux copies locales ont été avancées sans réécriture d'historique. Pourcentage à gauche, flamme à droite et retrait du meilleur mot répété dans l'en-tête, sur le plateau et les duels.
- 78 tests ciblés réussis, aucun échec ni cas ignoré ; TypeScript, construction et garde GitHub réussis. Les modifications portent sur cinq fichiers de présentation ; aucun moteur, score, rang ou lecteur historique modifié.
- Aucun défaut confirmé nécessitant une correction supplémentaire pendant cette revue. Pas de nouvelle recette visuelle ou mobile indépendante, ni de mesure de performance terrain. Les captures mentionnées dans la PR ne sont pas des preuves produites pendant ce contrôle.
- La demande « push merge » n'avait pas publié cette contribution. La demande explicite suivante a conduit à la version 63. Les accès et le transfert D1/R2 nécessaires à la migration restent à préparer ; annonces inactives.

## Publication 62 et transition

- Version 62 publiée sur demande explicite depuis le commit exact `8fa556f80bf820a01b5883ec198d10738c3c0302`, avec les PR 5 et 6 : présentation plus discrète, flamme dessinée et haut de plateau compact. Aucun changement supplémentaire de source pendant la publication.
- 78 tests ciblés réussis, aucun échec ni cas ignoré ; TypeScript, construction et garde GitHub réussis. Corpus V1 et 120 segments figés vérifiés par le build. Même source pour l'archive, la version enregistrée et le déploiement.
- Contrôle en production : rendu drawn et canvas 2D présents, anciens canvas WebGL et braises absents, mot du jour chargé et saisie disponible. Capture et identifiants réels dans le dernier dossier privé. Aucun nouvel essai ajouté lors de ce contrôle ; pas de nouvelle mesure terrain ni de recette mobile exhaustive.
- Le Site reste disponible en version 62. Cette demande explicite n'a pas réactivé les publications automatiques Sites. Migration d'hébergement, accès et transfert D1/R2 restent à préparer ; annonces inactives.

## Publication précédente et décision d'hébergement

- Version 61 publiée sur demande explicite depuis GitHub `c280af6a197197d668a5336e96d6ae22c25f8601`, avec les PR 3 et 4 : flamme WebGL, braises et présentation Le Brasier. Aucune modification applicative ajoutée lors de la publication.
- 578 tests réussis, aucun échec, trois cas de liens symboliques ignorés faute de privilèges Windows ; TypeScript et construction réussis. Garde GitHub réussie, archive et version enregistrées depuis le même commit.
- Contrôle en production : rendu WebGL, nouveau menu, navigation en partie libre et acceptation d'un mot. Prévisualisation locale non validée en raison du runtime Cloudflare. Pas de nouvelle mesure de performance terrain ni de recette exhaustive mobile revendiquée.
- L'utilisateur veut sortir de Sites. L'automatisation conserve les corrections dans GitHub et ne publie plus automatiquement via Sites. Compte Cloudflare du propriétaire à connecter, accès DNS et transfert cohérent D1/R2 à préparer. Cette décision n'a déplacé aucune base, session, donnée de jeu ou configuration publicitaire.
- Les consignes du dépôt sont alignées sur cette décision. Cette mise à jour documentaire n'est pas un nouveau déploiement ; les contrôles applicatifs précédents ne sont pas rejoués sans modification du produit.

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

Pour chaque défaut constaté, vérifier la correction, y compris à l’écran si l’interface change. Pousser le commit dans GitHub `main`, puis exécuter `node scripts/verify-github-source.mjs`. Tant que la chaîne de déploiement du propriétaire n’est pas prête, consigner le lot comme non déployé. Publier sur Sites uniquement sur demande explicite de l’utilisateur, selon la [procédure de publication](SOURCE-OF-TRUTH.md).

Garder les parties et lecteurs historiques. Ne pas fabriquer de trafic, d’avis, de rangs ou de mesures. N’ajouter ni texte marketing ni animation sans besoin observé.

Ne pas répéter une campagne complète de tests sans changement ou doute nouveau. Ne pas supprimer des outils CLI, lecteurs historiques ou imports dynamiques sur la seule base d’un graphe TypeScript. Ne pas transformer une liste d’exports candidats en suppression automatique. Mettre à jour ce registre lorsqu’un nouveau problème confirmé est traité.
