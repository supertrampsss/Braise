# Braise / BRAIZ — Revue complète produit et design

Date : 12 octobre 2026 · Dépôt main : e5625362ce4780511920e777707f17cb6bbb55b2

## Décision proposée

Relier les fonctions existantes, clarifier les retours, puis ouvrir les nouveautés par lots vérifiés. Tutoriel facultatif, reprise commune et bilan du chemin sont les premiers ajouts recommandés.

## Périmètre et limites

Le dépôt main du 12 septembre et le Site public BRAIZ diffèrent. Accueil, aide, profil/réussites et ouverture d’une archive ont été observés en production ; Explorer, sélecteurs et entrées de modes ont été observés localement. Les réponses, indices, victoire/partage, fonctions sociales et distribution ont aussi été lus dans le code.

Les données de scores manquent au miroir. Les routes /cercles, /duels, /studio, /laboratoire, /espace, /embed et /integration retournent à https://braiz.io/. Collections, expéditions et défi par lien n’apparaissent pas dans le menu consulté. Deux braises et streamer n’ont pas été testés séparément en production.

Scores, victoire, transfert effectif, parcours multijoueurs, création publiée, installation réelle, réseau dégradé et lecteur d’écran ne sont pas certifiés par cette revue. Les tests historiques documentés n’ont pas été relancés. Aucun compte ou publication n’a été créé. Aucun chiffre d’usage ni gain de conversion n’a été inventé.

## Inventaire de l’existant

### Quotidien

- Existant : Un mot commun, température, rang, remise à zéro à minuit à Paris, reprise locale.

- Site public : Écran public observé ; métadonnées lues.

- Dépôt : Écran local observé ; logique lue.

- Orientation : Clarifier le feedback et rapprocher règle, saisie et résultat.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

### Partie libre

- Existant : Nouvelle partie sans limite de temps, sauvegarde par identité de partie.

- Site public : Accès visible dans le menu ; résolution non exercée.

- Dépôt : Mode présent dans le plateau et dans le code.

- Orientation : Rendre le changement de mot explicite et gérer les répétitions.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

### Archives

- Existant : Date passée depuis le lancement ; reprise du quotidien correspondant ; série non prolongée rétroactivement.

- Site public : Archive du 11 octobre ouverte avec confirmation de chargement.

- Dépôt : Sélecteur et règles présents.

- Orientation : Mieux repérer les parties commencées et terminées.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/lib/calendar.ts)

### Moteur et vocabulaire

- Existant : V1 : 30 000 entrées et 120 cibles ; température et rang calculés ; mots hors vocabulaire refusés.

- Site public : API publique : vocabularySize = 30 000 ; score non soumis.

- Dépôt : V1 documentée ; assets de score absents du miroir.

- Orientation : Finir la chaîne de contenu et documenter les refus.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/GITHUB-DATA-ASSETS.md)

### Indices

- Existant : Trois pistes gratuites après cinq essais ; usage signalé dans le partage.

- Site public : Bouton et condition de déblocage observés ; indice non utilisé.

- Dépôt : Condition et limite lues.

- Orientation : Afficher le motif du verrouillage sans survol.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

### Historique et carnet

- Existant : Tri chaud/récent, températures, dernier essai, meilleure piste, jusqu’à trois mots épinglés.

- Site public : Tri visible ; carnet après essais non vérifié.

- Dépôt : Rendu et logique du carnet lus.

- Orientation : Renforcer la différence entre dernier essai et meilleure piste.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

### Victoire et partage

- Existant : Bilan d’essais/indices ; partage sans réponse ; solution de copie de secours ; relance en libre.

- Site public : Victoire et partage non exercés.

- Dépôt : Logique et texte examinés.

- Orientation : Ajouter un bilan du chemin et une action de continuation contextuelle.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

### Profil, XP et succès

- Existant : Niveaux par XP, série, mots trouvés, quatre succès ; progression personnelle.

- Site public : Profil et fenêtre de réussites observés.

- Dépôt : Profil et fenêtre complète observés.

- Orientation : Rendre les succès accessibles en un seul niveau de navigation.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

### Objectifs et styles

- Existant : Trois objectifs hebdomadaires ; styles permanents débloqués ; aucun avantage de score.

- Site public : Non exposés dans le profil/réussites consultés.

- Dépôt : Objectifs, compteurs et styles observés dans la fenêtre.

- Orientation : Réintégrer un résumé compact après qualification, puis alléger le détail.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/weekly-ritual.tsx)

### Préférences et transfert

- Existant : Son ; mouvement réduit dans le code ; export/import du profil avec aperçu et fusion contrôlée.

- Site public : Son et Animations visibles ; boutons export/import observés, opérations non exécutées.

- Dépôt : Export exclut parties et épingles ; import avec confirmation lu.

- Orientation : Expliquer ce qui voyage entre appareils et ce qui reste local.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/profile-transfer.tsx)

### Collections

- Existant : Cinq univers de douze emplacements : Nature, Cuisine, Voyage, Émotions, Cinéma et scène ; compteur et continuation.

- Site public : Aucun accès dans la navigation consultée.

- Dépôt : Sélecteurs observés ; 60 emplacements avec recoupements, pas 60 réponses distinctes.

- Orientation : Remplacer les accordéons imbriqués par des cartes avec reprise.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/lib/collections.ts)

### Expéditions

- Existant : Six parcours de trois étapes ; étape suivante après preuve de victoire ; reprise et insigne local.

- Site public : Aucun accès dans la navigation consultée.

- Dépôt : Sélecteur observé ; parcours complet non exercé.

- Orientation : Conserver le contexte de parcours dans le plateau et après victoire.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/expedition-picker.tsx)

### Défi simple par lien

- Existant : Une seed commune, parties personnelles indépendantes, comparaison par partage de résultats.

- Site public : Non exposé dans le menu consulté ; comportement non confirmé.

- Dépôt : Mode Entre amis et création de lien présents.

- Orientation : Présenter clairement le lien, le même mot et la comparaison différée.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

### Identité invitée et espace

- Existant : Pseudonyme, parties serveur, reprise, code secret de récupération ; historique local distinct.

- Site public : /espace redirige vers l’accueil.

- Dépôt : Écran d’entrée observé ; accès, récupération et persistance étudiés dans le code.

- Orientation : Rassembler la création/récupération d’accès et garder la partie d’invitation.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/server-game.tsx)

### Cercles

- Existant : Groupes privés, vingt membres maximum, invitations, défi hebdomadaire, archives, résultats, révocation/exclusion.

- Site public : /cercles redirige vers l’accueil.

- Dépôt : Entrée observée ; parcours collectif lu, non exercé avec plusieurs identités.

- Orientation : Créer un tableau de groupe simple, des états d’invitation et un résumé de participation.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/circles.tsx)

### Duels

- Existant : Trois manches, 48 h après acceptation, 30 propositions distinctes par manche, sans indice ; abandon/revanche.

- Site public : /duels redirige vers l’accueil.

- Dépôt : Entrée observée ; règles et états lus, résolution non exercée.

- Orientation : Montrer état, échéance et progression de chaque manche avant l’historique.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/duels.tsx)

### Laboratoire · L’intrus

- Existant : Vingt quatuors, une réponse par énigme, explication et historique local séparé.

- Site public : /laboratoire redirige vers l’accueil.

- Dépôt : Première énigme et choix observés ; réponse non soumise.

- Orientation : Conserver l’explication, ajouter un bilan de session et une continuation lisible.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/intruder-game.tsx)

### Laboratoire · Deux braises

- Existant : Douze paires, deux températures indépendantes, découverte conservée, fin après les deux mots.

- Site public : Route non testée séparément ; laboratoire parent renvoie à l’accueil.

- Dépôt : Écran observé ; double score lu dans le code.

- Orientation : Utiliser deux panneaux de résultat identifiables et un état Trouvée par cible.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/two-braises-game.tsx)

### Studio

- Existant : Brouillons serveur, un à douze éléments, cinq titres approuvés, ordre modifiable, publication stable et retrait.

- Site public : /studio redirige vers l’accueil.

- Dépôt : Entrée observée ; éditeur et publication étudiés dans le code, non publiés pendant la revue.

- Orientation : Ajouter un aperçu participant et remplacer le vocabulaire technique.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/studio.tsx)

### Affichage streamer

- Existant : Vue autorisée sans mots ni solution, températures et nombre de propositions ; actualisation manuelle.

- Site public : Non exposé ; /streamer non vérifié en production.

- Dépôt : Code étudié, sans partie serveur affichée.

- Orientation : Afficher date de mise à jour et état de connexion ; garder la protection contre les spoilers.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/streamer.tsx)

### Installation et hors connexion

- Existant : Manifeste et service worker ; seul un écran neutre est mis en cache ; aucun jeu hors ligne.

- Site public : Installation réelle et coupure réseau non testées.

- Dépôt : Manifeste, cache et écran de secours lus.

- Orientation : Expliquer le besoin de réseau et la conservation des parties.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/public/sw.js)

### Intégration

- Existant : /embed et démonstrateur /integration ; protocole de redimensionnement ; origine autorisée contrôlée.

- Site public : Les deux routes redirigent vers l’accueil.

- Dépôt : Code et limite à la même origine étudiés ; intégration partenaire non qualifiée.

- Orientation : Préparer un vrai mode compact et une qualification des origines partenaires.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/embed-demo.tsx)

### Publicité

- Existant : Emplacement réservé après le jeu ; configuration commerciale inactive dans le dépôt.

- Site public : Aucune annonce réelle vue pendant la consultation.

- Dépôt : Bloc réservé observé ; décision skip sans configuration.

- Orientation : Masquer le bloc réservé dans le parcours public tant qu’il ne rend pas de service.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/lib/advertising.ts)

### Accessibilité et qualité

- Existant : Libellés, focus, annonces textuelles, clavier, mouvement réduit et sauvegardes prévus.

- Site public : Inspection visuelle et navigation ; aucune conformité globale certifiée.

- Dépôt : Code et simulation de petite largeur examinés ; lecteur d’écran/appareils réels non testés.

- Orientation : Faire une recette transverse sur tous les modes et états, pas uniquement l’accueil.

- [Preuve source](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/app/focused-interface.css)

## Comparaison Mobbin — trois produits, huit écrans

### Reddit · Hot and Cold — Plateau et accès à l’aide

[Plateau et accès à l’aide](https://mobbin.com/screens/6ad24dd7-e411-479c-9281-a663502516f5)

Observé : Champ, bouton Guess, aide How to Play et repère de progression dans le même module.

Adaptation : Retenir le regroupement des actions. Braise explique déjà mieux le principe sémantique ; ne pas reprendre le chrome Reddit ni ses compteurs d’audience.

Liens de backlog : D03, D04, D06, D29

### Duolingo — Pratique et quêtes quotidiennes

[Pratique et quêtes quotidiennes](https://mobbin.com/screens/781f3022-614e-4eab-96ae-d9f305925ff5)

Observé : Une activité principale et une carte de quêtes avec libellés, fractions et barres de progression.

Adaptation : Rendre l’objectif suivant visible près de la fin de partie. Adapter le motif à un jeu ponctuel, sans imposer une page de tableaux de bord au démarrage.

Liens de backlog : D11, D12, A09

### Brilliant — Réponse correcte et explication

[Réponse correcte et explication](https://mobbin.com/screens/333e9f8a-ac0b-47d3-8887-82f6f13e71db)

Observé : Statut Correct, sélection cochée, bouton Why? et action Continue.

Adaptation : Séparer résultat, explication et action suivante. Une proximité sémantique n’est pas une réponse scolaire binaire ; garder la nuance du score.

Liens de backlog : D05, A01, A03

### Brilliant — Réponse incorrecte et nouvel essai

[Réponse incorrecte et nouvel essai](https://mobbin.com/screens/53d96faf-91a1-4af0-a917-53dc15960836)

Observé : Sélection signalée et panneau Incorrect avec Try again et See answer.

Adaptation : Donner un retour concret et une prochaine action. La révélation de solution doit rester volontaire et propre au mode, jamais automatique sur le quotidien.

Liens de backlog : D05, D21, A07

### Duolingo — Quête entre amis en cours

[Quête entre amis en cours](https://mobbin.com/screens/db515e34-0a3a-4369-93ba-d2224676d4cf)

Observé : Objectif commun, avancement 16/25, contributions nommées et actions sociales.

Adaptation : Inspirer un objectif coopératif de cercle à partir de faits serveur. Les relances ou cadeaux ne sont pas nécessaires au périmètre minimal.

Liens de backlog : D17, A08

### Duolingo — Quête entre amis accomplie

[Quête entre amis accomplie](https://mobbin.com/screens/30e202bf-259b-4d41-83de-4adebaaa892a)

Observé : Défi accompli, barre remplie 25/25, contributions et reconnaissance.

Adaptation : Rendre visible la réussite du groupe sans ajouter de classement global. Distinguer contribution et simple présence.

Liens de backlog : D17, A08

### Brilliant — Choix d’un parcours et recommandation

[Choix d’un parcours et recommandation](https://mobbin.com/screens/4e5b6242-d0d1-49f2-9733-0e405b455bc7)

Observé : Plusieurs parcours, un Top pick, nombre de cours, description et bouton Continue.

Adaptation : Transformer les sélecteurs de collections/expéditions en choix compréhensibles avec une seule suggestion et une reprise. Les cartes ne doivent pas révéler les réponses.

Liens de backlog : D14, D15, A02, A09

### Brilliant — Détail du parcours sélectionné

[Détail du parcours sélectionné](https://mobbin.com/screens/bab72415-3fc7-4194-a2cb-34eee2da2a49)

Observé : Le parcours sélectionné se développe pour montrer une explication, tandis que les autres restent compacts.

Adaptation : Adopter une divulgation progressive du contenu et un état de sélection clair ; éviter les accordéons imbriqués sans résumé.

Liens de backlog : D14, D19, A11

## 30 améliorations de l’existant

P0 : préalable de livraison ; P1 : cœur d’usage ; P2 : profondeur/confort ; P3 : après demande. Efforts qualitatifs, non engagements calendaires.

### D01 · P0 · Livraison

Public + dépôt · Observé · effort Moyen

**Constat.** Le dépôt affiche Braise, le Site public BRAIZ. Les fonctions avancées du miroir ne correspondent pas à la navigation publique ; sept routes connues renvoient à l’accueil.

**Amélioration.** Figer le périmètre officiel et comparer la source canonique publiée au miroir avant tout développement. Tenir une matrice de disponibilité par version.

**Validation attendue.** Chaque fonction annoncée possède une entrée accessible et une version source identifiée ; les redirections sont intentionnelles et documentées.

[Source : GITHUB-DATA-ASSETS.md](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/GITHUB-DATA-ASSETS.md)

### D02 · P0 · Livraison

Dépôt · Code + documents · effort Moyen à grand

**Constat.** Le miroir ne contient pas les données nécessaires aux scores. Les validations historiques de la documentation ne prouvent pas le fonctionnement actuel de tous les parcours.

**Amélioration.** Rendre la version de revue reproductible avec les assets V1 exacts par une voie autorisée ; qualifier ensuite les états de jeu et les parcours serveur.

**Validation attendue.** Un environnement complet permet première réponse, indice, victoire, reprise et parcours social ; la recette consigne version et preuves.

[Source : GITHUB-DATA-ASSETS.md](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/GITHUB-DATA-ASSETS.md)

### D03 · P1 · Jeu

Dépôt ; conserver l’acquis public · Observé · effort Petit

**Constat.** Braise utilise une flèche seule ; BRAIZ possède déjà un bouton Envoyer.

**Amélioration.** Conserver un verbe visible sur tous les plateaux : Proposer ou Envoyer. Uniformiser chargement, erreur et état désactivé.

**Validation attendue.** Un débutant identifie l’action sans lire une aide ; le même mot d’action figure sur classique, serveur, duel et Deux braises.

[Source : components/game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

### D04 · P1 · Jeu

Public + dépôt · Observé + code · effort Petit

**Constat.** Le déblocage de l’indice est porté par un titre de survol ; le bouton reste désactivé avant cinq essais.

**Amélioration.** Afficher Indice après 5 essais, puis un compteur de progression et le nombre restant. Expliquer la règle de chaque mode.

**Validation attendue.** À la souris, au tactile et au clavier, la raison du verrouillage reste lisible ; le cinquième essai déverrouille l’action sans rechargement.

[Source : components/game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

### D05 · P1 · Jeu

Dépôt ; à vérifier sur les réponses publiques · Code · effort Moyen

**Constat.** La réponse récente et la meilleure piste ont deux emplacements ; la jauge conserve le record même après un essai moins proche.

**Amélioration.** Nommer les deux valeurs Dernier essai et Meilleure piste. Expliquer le rang et la proximité ; ne pas suggérer une probabilité de victoire.

**Validation attendue.** Un essai moins proche est correctement interprété et le record reste identifiable ; couleur et texte donnent le même sens.

[Source : components/game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

### D06 · P1 · Jeu

Public + dépôt · Observé · effort Petit

**Constat.** Les règles sont accessibles mais le démarrage public demande seulement de deviner le mot. L’explication sémantique est plus proche du champ dans le miroir.

**Amélioration.** Afficher une phrase courte près de la saisie : Le sens compte, pas les lettres. Garder les détails dans l’aide.

**Validation attendue.** Le premier écran explique le principe sans ouverture obligatoire d’une fenêtre ; aide et retour au champ préservent le contexte.

[Source : components/game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

### D07 · P1 · Jeu

Dépôt · Code · effort Petit à moyen

**Constat.** L’historique trié par chaleur peut éloigner le dernier essai du haut de liste ; l’épingle est une icône et le carnet apparaît après utilisation.

**Amélioration.** Marquer le dernier essai, annoncer clairement le tri actif et expliquer Épingler une piste lors du premier usage.

**Validation attendue.** Le dernier essai et le meilleur restent repérables dans les deux tris ; une épingle se pose et se retire au clavier avec son nom de mot.

[Source : components/game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

### D08 · P2 · Jeu

Public + dépôt · Observé + code · effort Petit

**Constat.** L’archive s’ouvre par une date native et revient au plateau quotidien ; le changement d’édition est réel mais mérite un repère permanent.

**Amélioration.** Conserver date, badge Archive et retour au mot du jour près du plateau, avec la règle de série dans l’aide contextuelle.

**Validation attendue.** Une archive, un quotidien et leurs sauvegardes restent distinguables après reprise ou partage.

[Source : components/game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

### D09 · P2 · Jeu

Dépôt · Code · effort Petit

**Constat.** Le bouton Encore un mot et le tirage libre ne décrivent pas la possibilité de répétitions sur la collection V1.

**Amélioration.** Expliquer le libre à son ouverture et garder un changement de mot clair. Éviter de remplacer une partie commencée sans repère.

**Validation attendue.** Le joueur sait quelle partie est active et retrouve son historique ; les répétitions sont présentées honnêtement.

[Source : components/game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

### D10 · P1 · Navigation

Dépôt à réintégrer · Observé + code · effort Moyen

**Constat.** Explorer regroupe les modes, mais les pages avancées quittent la navigation principale et offrent surtout un retour à Braise.

**Amélioration.** Partager un en-tête cohérent Jouer / Explorer / Profil, avec nom du mode et retour au contexte. Garder l’accès invité après une action sociale choisie.

**Validation attendue.** Chaque mode possède une sortie et une reprise prévisibles ; retour, rechargement et liens directs gardent le contexte.

[Source : components/server-game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/server-game.tsx)

### D11 · P1 · Progression

Public + dépôt · Observé · effort Moyen

**Constat.** Le public demande Profil → Progression détaillée → Voir mes réussites. Le miroir regroupe objectifs, XP, statistiques, export, succès et styles dans une longue fenêtre.

**Amélioration.** Faire une page de progression courte : résumé, objectifs, réussites ; placer sauvegarde et préférences dans des sections dédiées.

**Validation attendue.** Les prochaines actions et récompenses se trouvent sans chercher dans une longue fenêtre ; le détail reste consultable.

[Source : components/game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

### D12 · P2 · Progression

Dépôt à réintégrer · Observé + code · effort Moyen

**Constat.** Les objectifs hebdomadaires et styles existent dans la source, mais ne sont pas exposés dans le profil public consulté.

**Amélioration.** Réintégrer un objectif visible et sa récompense après la première activité ; conserver l’acquisition réelle et les styles permanents.

**Validation attendue.** Chaque objectif affiche progrès, échéance Paris et récompense ; reprise/import n’attribuent rien en double.

[Source : components/weekly-ritual.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/weekly-ritual.tsx)

### D13 · P1 · Sauvegarde

Public + dépôt · Observé + code · effort Petit à moyen

**Constat.** L’export transporte le profil et les préférences, mais laisse les parties et épingles sur l’appareil. L’accès serveur suit un autre mécanisme.

**Amélioration.** Afficher un tableau simple Ce qui sera transféré avant export/import ; distinguer progression locale et parties partagées.

**Validation attendue.** Un transfert ne promet pas une reprise absente ; aperçu, annulation et confirmation conservent toutes les données valides.

[Source : components/profile-transfer.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/profile-transfer.tsx)

### D14 · P2 · Parcours

Dépôt à réintégrer · Observé · effort Moyen

**Constat.** Les collections utilisent des accordéons imbriqués ; cinq thèmes ont douze emplacements, avec des réponses communes.

**Amélioration.** Présenter cinq cartes : thème, compteur, état et Continuer. Mentionner les recoupements dans l’aide de collection.

**Validation attendue.** Le joueur reprend une énigme en cours sans ouvrir plusieurs niveaux ; un recoupement ne se présente pas comme un nouveau mot unique.

[Source : components/collection-picker.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/collection-picker.tsx)

### D15 · P1 · Parcours

Dépôt à réintégrer · Code + sélecteur observé · effort Moyen

**Constat.** Une expédition charge un défi classique. Après victoire, le texte demande de revenir à Explorer pour poursuivre ; le plateau perd le nom et l’étape du parcours.

**Amélioration.** Conserver un bandeau de parcours, une progression sur trois étapes et une action Étape suivante dans la victoire.

**Validation attendue.** Une expédition se termine sans détour par le catalogue ; la prochaine référence est obtenue après preuve réelle de réussite.

[Source : components/expedition-picker.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/expedition-picker.tsx)

### D16 · P1 · Social

Dépôt à réintégrer · Observé + code · effort Moyen

**Constat.** Créer mon identité et conserver cette invitation apparaît aussi sur l’entrée sans invitation. Les règles sont détaillées avant le bénéfice.

**Amélioration.** Adapter le texte à Créer un cercle / Rejoindre le cercle / Accepter le duel. Présenter l’invitation et son état avant le pseudonyme.

**Validation attendue.** Les états nouveau, existant, expiré, révoqué et déjà accepté possèdent un message et une action propres ; la destination est conservée.

[Source : components/circles.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/circles.tsx)

### D17 · P2 · Social

Dépôt à réintégrer · Code · effort Moyen

**Constat.** Membres, invitations, archives et résultats du cercle se succèdent dans une page utilitaire.

**Amélioration.** Mettre le défi courant et la participation en tête ; séparer Défi / Résultats / Membres. Réserver la gestion aux personnes autorisées.

**Validation attendue.** Le participant rejoint le bon défi et comprend le classement ; aucun mot adverse ne figure dans une vue de groupe.

[Source : components/circles.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/circles.tsx)

### D18 · P2 · Social

Dépôt à réintégrer · Code · effort Moyen

**Constat.** Le duel possède de vrais états et règles, mais une liste technique, une date et trois boutons de manche portent l’expérience.

**Amélioration.** Ajouter une carte d’état, trois indicateurs de manche, essais restants et échéance clairement affichée. Structurer bilan et revanche.

**Validation attendue.** Attente, actif, terminé, expiré, annulé et abandonné restent distincts ; les règles d’égalité sont compréhensibles.

[Source : components/duels.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/duels.tsx)

### D19 · P2 · Créateurs

Dépôt à réintégrer · Code · effort Moyen

**Constat.** Le studio propose un aperçu structurel textuel et le bouton Publier une édition immuable ; les cinq titres sont imposés.

**Amélioration.** Ajouter un aperçu participant et une liste ordonnée lisible. Renommer Publier cette version et expliquer la stabilité des liens en une phrase.

**Validation attendue.** L’auteur comprend ce que verra le participant ; modifier un brouillon ne change pas une édition existante ; retrait et retour sont explicites.

[Source : components/studio.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/studio.tsx)

### D20 · P2 · Créateurs

Dépôt · Code · effort Petit à moyen

**Constat.** La vue streamer annonce une actualisation manuelle mais ne montre pas d’horodatage de fraîcheur.

**Amélioration.** Afficher Dernière mise à jour, état de connexion et bouton clair ; envisager ensuite une actualisation réelle contrôlée.

**Validation attendue.** Une panne n’affiche pas des données anciennes comme fraîches ; capture et annonces ne révèlent aucun mot.

[Source : components/streamer.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/streamer.tsx)

### D21 · P2 · Variantes

Dépôt à réintégrer · Observé + code · effort Petit à moyen

**Constat.** L’intrus explique les réponses et garde un historique, mais la fin de la série n’a pas de synthèse de session dédiée.

**Amélioration.** Structurer choix → explication → suivante, puis un bilan réel des vingt énigmes et une reprise.

**Validation attendue.** La sélection reste explicite, une réponse conservée se restitue sans nouvel effet et la dernière énigme offre une sortie.

[Source : components/intruder-game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/intruder-game.tsx)

### D22 · P2 · Variantes

Dépôt à réintégrer · Observé + code · effort Moyen

**Constat.** Deux braises utilise deux colonnes et des états textuels au-dessus du formulaire.

**Amélioration.** Créer deux panneaux identifiables, chaque température et rang avec un état trouvé ; garder l’historique compact sur mobile.

**Validation attendue.** Les deux cibles sont distinguables sans couleur seule ; une cible trouvée reste acquise et la fin attend les deux.

[Source : components/two-braises-game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/two-braises-game.tsx)

### D23 · P2 · Distribution

Dépôt · Code · effort Moyen

**Constat.** Le service worker conserve uniquement un écran de secours ; cela ne rend pas les puzzles jouables hors ligne.

**Amélioration.** Présenter Connexion nécessaire pour calculer les mots, une action Réessayer et une explication de conservation des parties. Qualifier l’installation réelle.

**Validation attendue.** Coupure, retour réseau, mise à jour et fermeture/reprise conservent le profil sans promettre de calcul hors ligne.

[Source : public/sw.js](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/public/sw.js)

### D24 · P3 · Distribution

Dépôt · Code + redirections publiques · effort Grand

**Constat.** Le démonstrateur et le contrat embed sont limités à la même origine ; ce n’est pas une intégration partenaire prête.

**Amélioration.** Créer un mode compact, un aperçu et une aide d’intégration après choix d’une origine réelle. Revoir les métadonnées restées au domaine historique.

**Validation attendue.** La qualification contrôle accès, dimensions, clavier, origine exacte et absence de transmission de mots ; une erreur possède un repli.

[Source : components/embed-demo.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/embed-demo.tsx)

### D25 · P2 · Monétisation

Dépôt · Observé · effort Petit

**Constat.** Un bloc Emplacement publicitaire réservé prend de la place alors qu’aucune annonce n’est active dans le dépôt.

**Amélioration.** Rendre cet emplacement invisible dans l’expérience de jeu jusqu’à une configuration commerciale réelle ; conserver un emplacement discret après contenu.

**Validation attendue.** Le plateau garde sa stabilité et aucune annonce ne sépare deux essais ; aucun revenu ou remplissage fictif n’est affiché.

[Source : components/ad-placement.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/ad-placement.tsx)

### D26 · P1 · Accessibilité

Public + dépôt · Inspection partielle · effort Moyen

**Constat.** Le socle contient de bons libellés, focus et mouvements réduits ; la conformité de tous les états n’est pas établie.

**Amélioration.** Vérifier contraste, états de focus, dialogue, zoom, annonces et zones tactiles dans tous les modes. Maintenir la couleur accompagnée de texte.

**Validation attendue.** Recette clavier et lecteur d’écran ; contraste normal ≥ 4,5:1 et grand texte ≥ 3:1 ; minimum WCAG 2.2 de cible appliqué avec ses exceptions, confort produit visé à 44 px.

[Source : app/globals.css](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/app/globals.css)

### D27 · P1 · Qualité produit

Public + dépôt · Besoin de mesure · effort Moyen

**Constat.** Aucune donnée d’audience, de rétention ou de taux de victoire n’a été fournie. Les arbitrages sont qualitatifs.

**Amélioration.** Mesurer première proposition acceptée, rejets, abandons, victoire, partage et retour ; recueillir des retours volontaires sur les mots refusés.

**Validation attendue.** Les indicateurs ont une définition stable, un périmètre et une source réels ; aucun classement personnel importé n’est traité comme résultat compétitif.

[Source : docs/PRODUCT.md](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/docs/PRODUCT.md)

### D28 · P2 · Cohérence

Dépôt · Observé + code · effort Petit à moyen

**Constat.** La fenêtre locale garde un bouton Close ; le classique emploie la virgule décimale, certaines variantes le point ; plusieurs écrans utilisent identité, révision, immuable et serveur.

**Amélioration.** Uniformiser langue, nombres, surfaces et termes visibles : accès, version publiée, mes parties. Garder les détails dans une aide dédiée.

**Validation attendue.** Tous les messages et libellés d’action sont français ; les mêmes valeurs et états ont la même présentation.

[Source : components/server-game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/server-game.tsx)

### D29 · P2 · Hiérarchie

Public ; dépôt · Observé, performance non mesurée · effort Moyen

**Constat.** La flamme occupe une grande zone au centre de BRAIZ ; le dépôt répète Le mot du jour et empile deux niveaux de navigation.

**Amélioration.** Garder la flamme comme signature tout en rapprochant explication, saisie et feedback. Réduire les répétitions et la densité d’accès avant le premier essai.

**Validation attendue.** À petite largeur et avec clavier ouvert, le joueur voit la saisie et le retour ; les effets respectent les préférences et la performance est mesurée.

[Source : app/focused-interface.css](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/app/focused-interface.css)

### D30 · P1 · Contenu

Dépôt ; métadonnées publiques V1 · Code + documents · effort Grand

**Constat.** La V1 prévoit 120 cibles. Le corpus complet préparé localement et les 62 approbations sur 65 dossiers du dernier jalon ne constituent pas une V2 activée.

**Amélioration.** Terminer les validations éditoriales, le calendrier et la qualification de stockage/exécution avant d’élargir le quotidien. Garder les éditions et parties historiques.

**Validation attendue.** Chaque cible publiée a des scores et indices vérifiés ; le calendrier requis est complet ; l’extension ne change aucune réponse historique.

[Source : docs/program/B2J-DELIVERY.md](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/docs/program/B2J-DELIVERY.md)

## 14 fonctions à ajouter

### A01 · P1 · Tutoriel jouable facultatif

**Périmètre minimal.** Un mini-parcours séparé du quotidien : proposer, lire le résultat, changer d’association. Deux ou trois étapes, sortie immédiate. Scores pédagogiques issus d’un jeu d’exemple réel et identifié.

**Dépendances.** D05, D06 et environnement de score complet

**Validation attendue.** Aucun mot quotidien ni progression compétitive n’est modifié ; le tutoriel peut être interrompu et relancé.

**Mesure.** Première proposition valide ; besoin d’aide ; compréhension en test utilisateur.

Effort qualitatif : Moyen. Proposition de revue, pas une fonctionnalité déjà réalisée.

### A02 · P1 · Centre de reprise commun

**Périmètre minimal.** Une carte Reprendre ma partie et une liste de parcours commencés avec mode, progression et date. Séparer stockage local et parties partagées.

**Dépendances.** D10, D13 et identités de partie stables

**Validation attendue.** Reprise après fermeture vers le bon mode et la bonne étape, avec essais et épingles disponibles selon leur portée réelle.

**Mesure.** Parties effectivement reprises ; parcours abandonnés entre deux étapes.

Effort qualitatif : Moyen. Proposition de revue, pas une fonctionnalité déjà réalisée.

### A03 · P1 · Bilan du chemin après victoire

**Périmètre minimal.** Nombre d’essais/indices, meilleures pistes, jalons de température et action adaptée : partager, étape suivante ou autre partie. Une vue sans réponse pour le partage.

**Dépendances.** D05, D15 ; historique accepté

**Validation attendue.** Toutes les valeurs dérivent des essais réels ; le partage ne contient ni solution ni pistes révélatrices.

**Mesure.** Consultation du bilan ; partage réel ; poursuite de parcours.

Effort qualitatif : Moyen. Proposition de revue, pas une fonctionnalité déjà réalisée.

### A04 · P2 · Calendrier d’archives filtrable

**Périmètre minimal.** Mois passé, états commencé/terminé/non joué, filtre À reprendre et accès clavier ; conserver l’entrée par date.

**Dépendances.** D08 ; index de parties personnelles

**Validation attendue.** Les dates futures et antérieures au lancement restent refusées ; une victoire d’archive ne prolonge pas la série.

**Mesure.** Reprise d’archives et difficulté de trouver une date.

Effort qualitatif : Moyen. Proposition de revue, pas une fonctionnalité déjà réalisée.

### A05 · P2 · Libre avec préférence de nouveauté

**Périmètre minimal.** Éviter les cibles déjà rencontrées tant que la collection le permet, puis expliquer l’épuisement ; un choix Rejouer reste possible.

**Dépendances.** D09, D30 ; suivi réel des identités rencontrées

**Validation attendue.** Pas de fausse nouveauté ; le calendrier quotidien et les seeds existantes restent inchangés.

**Mesure.** Répétitions rencontrées ; poursuite d’une session libre.

Effort qualitatif : Moyen. Proposition de revue, pas une fonctionnalité déjà réalisée.

### A06 · P2 · Synchronisation facultative entre appareils

**Périmètre minimal.** Un accès optionnel après engagement ; consentement de transfert, portée claire et fusion conservant les parties locales. Distinguer faits personnels et résultats serveur vérifiés.

**Dépendances.** D13, accès/récupération serveur qualifiés

**Validation attendue.** Le joueur reprend réellement une partie en cours sur un autre appareil ; conflits, révocation et suppression d’accès sont explicites.

**Mesure.** Reprises inter-appareils ; erreurs de fusion ; adoption volontaire.

Effort qualitatif : Grand. Proposition de revue, pas une fonctionnalité déjà réalisée.

### A07 · P2 · Entraînement avec difficulté éditoriale

**Périmètre minimal.** En libre/entraînement, catégories Facile/Standard/Exploration issues de cibles relues et de retours réels ; indices progressifs prévalidés.

**Dépendances.** D30 ; preuves éditoriales et tests de compréhension

**Validation attendue.** Aucune difficulté annoncée sans définition ; le quotidien conserve les mêmes règles pour tous.

**Mesure.** Achèvement par niveau ; usage d’indices ; satisfaction.

Effort qualitatif : Grand. Proposition de revue, pas une fonctionnalité déjà réalisée.

### A08 · P2 · Objectif coopératif de cercle

**Périmètre minimal.** Un objectif hebdomadaire facultatif, progression commune et contribution réelle par membre ; aucune obligation quotidienne ni pression.

**Dépendances.** D16, D17 ; événements serveur vérifiés

**Validation attendue.** Une réussite est comptée une seule fois ; état accompli et contributions sont explicites sans exposer les mots.

**Mesure.** Cercles actifs ; objectifs réellement accomplis ; retour volontaire.

Effort qualitatif : Moyen à grand. Proposition de revue, pas une fonctionnalité déjà réalisée.

### A09 · P2 · Suggestion de prochaine activité

**Périmètre minimal.** Une seule suggestion : poursuivre un parcours commencé, découvrir un thème ou jouer un autre mode, fondée sur les faits personnels disponibles.

**Dépendances.** A02 ; bibliothèque de contenus qualifiée

**Validation attendue.** La suggestion explique son motif et laisse un choix direct ; aucune difficulté, affinité ou popularité n’est inventée.

**Mesure.** Ouverture et continuation effective de la suggestion.

Effort qualitatif : Moyen. Proposition de revue, pas une fonctionnalité déjà réalisée.

### A10 · P3 · Rappel choisi par le joueur

**Périmètre minimal.** Après plusieurs sessions, proposition facultative d’un rappel, horaire configurable et arrêt simple. Commencer par un ajout au calendrier si pertinent.

**Dépendances.** Preuve de demande ; installation et préférences qualifiées

**Validation attendue.** Aucun rappel activé par défaut ; désactivation immédiate ; le fuseau choisi est respecté.

**Mesure.** Choix volontaire ; désactivation ; retour attribuable avec prudence.

Effort qualitatif : Moyen. Proposition de revue, pas une fonctionnalité déjà réalisée.

### A11 · P3 · Studio enrichi et diffusion contrôlée

**Périmètre minimal.** Description, visuel et titre sous limites explicites ; aperçu participant ; duplication de création ; partage par lien avec réglage d’accès lisible.

**Dépendances.** D19 ; validation/modération et publication qualifiées

**Validation attendue.** Une version publiée reste stable ; le créateur prévisualise et comprend qui peut accéder au lien.

**Mesure.** Créations terminées, publiées et effectivement jouées.

Effort qualitatif : Grand. Proposition de revue, pas une fonctionnalité déjà réalisée.

### A12 · P1 · Retour sur un mot refusé

**Périmètre minimal.** Après un refus hors vocabulaire, expliquer la limite et proposer un signalement volontaire ; suggestions orthographiques seulement depuis le lexique connu.

**Dépendances.** D27 ; normalisation et liste de présence exactes

**Validation attendue.** Aucun score de secours inventé ; un problème réseau n’est pas présenté comme un mot absent ; le joueur garde sa saisie.

**Mesure.** Refus par type ; vocabulaire corrigé après revue ; erreurs réseau.

Effort qualitatif : Moyen. Proposition de revue, pas une fonctionnalité déjà réalisée.

### A13 · P2 · Statistiques personnelles utiles

**Périmètre minimal.** Historique de réussites par mode, médiane d’essais, indices utilisés, progression dans le temps. Séries quotidiennes et archives distinctes.

**Dépendances.** D11, D13 ; faits horodatés interprétables

**Validation attendue.** Les anciens faits incomplets restent identifiés ; aucune moyenne ou tendance n’est calculée sur des données absentes.

**Mesure.** Consultation des statistiques ; compréhension ; retours qualitatifs.

Effort qualitatif : Moyen. Proposition de revue, pas une fonctionnalité déjà réalisée.

### A14 · P3 · Petit pack d’entraînement hors ligne

**Périmètre minimal.** Contenu dédié, fini, validé et téléchargé explicitement ; calculs locaux bornés ; séparation du quotidien en ligne.

**Dépendances.** D23, D30 ; stockage et règles de cache qualifiés

**Validation attendue.** Coupure réelle : pack jouable, scores vérifiés, reprise locale ; les résultats personnels ne deviennent pas compétitifs.

**Mesure.** Usage réel hors ligne ; taille du pack ; erreurs de reprise.

Effort qualitatif : Grand. Proposition de revue, pas une fonctionnalité déjà réalisée.

## Feuille de route

0. Source canonique, disponibilité et données exactes (D01/D02/D30).

1. Cœur compréhensible et complet : D03–D07, D11, D13, D26–D29 ; A01/A03/A12.

2. Offre solo reliée : D10/D12/D14/D15/D21/D22 ; A02 puis A04/A05/A09/A13.

3. Jeux entre amis : D16–D18 et récupération ; A06 puis A08 après usage.

4. Créateurs et distribution : D19/D20/D23–D25 ; A07/A10/A11/A14 selon demande.

Aucune date engagée ni capacité d’équipe supposée. Reporter classement mondial, temps réel et catalogue libre jusqu’à preuve de besoin et qualification.

## Expérience cible

Jouer : quotidien d’abord, dernier essai, meilleure piste, historique, puis bilan et action contextuelle.

Explorer : reprise d’abord, collections/expéditions/variantes, puis groupe Entre amis et studio distinct.

Profil : série/réussites, objectif suivant, statistiques ; préférences et transfert séparés.

## Recette à réaliser

Premier usage, hors vocabulaire et réseau ; essai moins proche/record/indice/victoire ; calendrier Paris et archives ; sauvegarde/import/conflit ; collections/expéditions ; invité/invitation/groupe ; trois manches/échéance/abandon ; studio et streamer ; variantes ; appareils/zoom/clavier/lecteur d’écran ; installation/cache/origines partenaires.

Mesurer première proposition valide, rejets par cause, achèvement, médiane d’essais, reprise et retour ; définir chaque dénominateur avant collecte.

[W3C : contraste minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) : 4,5:1 pour texte courant, 3:1 pour grand texte, exceptions prévues.

[W3C : cible minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) : 24 × 24 CSS px avec exceptions ; 44 px est une cible produit de confort. Aucun verdict global de conformité.

## Sources du dépôt

- [components/game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/game.tsx)

- [app/focused-interface.css](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/app/focused-interface.css)

- [components/profile-transfer.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/profile-transfer.tsx)

- [components/weekly-ritual.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/weekly-ritual.tsx)

- [lib/collections.ts](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/lib/collections.ts)

- [components/expedition-picker.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/expedition-picker.tsx)

- [components/server-game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/server-game.tsx)

- [components/circles.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/circles.tsx)

- [components/duels.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/duels.tsx)

- [components/intruder-game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/intruder-game.tsx)

- [components/two-braises-game.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/two-braises-game.tsx)

- [components/studio.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/studio.tsx)

- [components/streamer.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/streamer.tsx)

- [public/sw.js](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/public/sw.js)

- [components/embed-demo.tsx](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/components/embed-demo.tsx)

- [lib/advertising.ts](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/lib/advertising.ts)

- [GITHUB-DATA-ASSETS.md](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/GITHUB-DATA-ASSETS.md)

- [docs/program/B2J-DELIVERY.md](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/docs/program/B2J-DELIVERY.md)

- [docs/program/B5B-DELIVERY.md](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/docs/program/B5B-DELIVERY.md)

- [docs/program/B6D-DELIVERY.md](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/docs/program/B6D-DELIVERY.md)

- [docs/program/B7-DELIVERY.md](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/docs/program/B7-DELIVERY.md)

- [docs/program/B9-DELIVERY.md](https://github.com/supertrampsss/Braise/blob/e5625362ce4780511920e777707f17cb6bbb55b2/docs/program/B9-DELIVERY.md)
