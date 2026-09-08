# Braise : plan directeur des dix évolutions

Version 1 du plan. Objectifs de réalisation, pas fonctionnalités déjà livrées.

## Priorité actualisée par Antoine

Les fonctionnalités sont réalisées avant l'ingestion du dictionnaire complet. Commencer par B5 sur les cibles V1 vérifiées : collection jouable, progression et reprise, puis expéditions. B8 peut également utiliser V1 sans attendre le catalogue complet B2. Les éditions référencent explicitement leur corpus et restent immuables lors de son extension ultérieure. Les quotas éditoriaux restent des objectifs à vérifier, jamais des contenus fictifs.

B1 et B2 restent partiels ou non terminés jusqu'à ingestion complète et qualification réelle. Les dépendances de sécurité, identité serveur et persistance D1 des fonctions sociales ne sont pas levées par ce changement de priorité. Continuer les fonctions indépendantes lorsqu'une capacité manque.

Préférence de délégation actualisée : GPT-5.6 Luna pour l'ingestion, gpt-6-astra effort low pour le reste. Ces réglages concernent les délégations disponibles et ne prétendent pas modifier le modèle du propriétaire. Les paramètres historiques ci-dessous décrivent la planification initiale.

## 1. Mandat et décision

Construire les dix évolutions acceptées par Antoine dans un seul programme : moteur sémantique, identité vivante, rituel, expéditions, cercles d'amis, duels, collections, laboratoire, studio créateurs et distribution web. Le produit reste un site français immédiatement jouable, financé par une publicité discrète.

La recommandation est de partager un moteur, un vocabulaire visuel, une progression et une identité de partie, puis d'ouvrir les nouveautés par étapes vérifiées. Les dix chemins sont planifiés ensemble. Ils ne seront pas intégrés par douze agents modifiant simultanément les mêmes fichiers.

### Critères de fin du programme principal

- Chacun des dix chemins dispose d'au moins son périmètre complet défini ci-dessous ; une carte de présentation ou un bouton inactif ne constitue pas une livraison.
- Les parties V1 restent lisibles et reprenables, avec leurs règles et leurs réponses d'origine.
- Tous les scores proviennent des données réelles. Aucun joueur, classement, revenu ou engagement n'est simulé dans le produit.
- Les fonctions sociales conservent résultats et droits côté serveur. L'historique local importé garde son statut personnel non vérifié.
- Les vérifications pertinentes, la construction, les migrations, le retour arrière et le commit de chaque jalon sont documentés.
- Les dix chemins peuvent être réalisés dans une version privée. L'ouverture publique, les impressions publicitaires réelles et l'intégration chez un partenaire restent distinctes et exigent leurs configurations effectives.

L'implémentation, les contrôles automatisés, la validation navigateur, la publication privée et l'activation commerciale auront des statuts séparés. Une fonctionnalité implémentée dont un contrôle d'usage n'a pas été effectué reste marquée non testée pour ce contrôle. Une dépendance manquante ne sera pas présentée comme terminée.

## 2. État de départ vérifié

| Élément | Référence V1 |
|---|---|
| Site | https://braise-mots.yellow-drake-7186.chatgpt.site |
| Identité Sites | `appgprj_6a9f1dfb001081918c9323599f7d8d6b` |
| Commit de référence | `85b05a71cba67b3283e1a19a1745d2d90570bcd2` |
| Moteur | 30 000 entrées, 120 cibles, scores fastText pré-calculés |
| Infrastructure | React, TypeScript, Vinext, Worker ; aucun binding D1/R2 actif |
| Progression | Locale au navigateur, non compétitive |
| Amis | Liens partageant une seed ; pas de cercle ni classement serveur |
| Publicité | Emplacement réservé ; aucune régie active |
| Vérifications précédentes | 8 tests moteur/API, TypeScript et build passés ; routes `/` et `/api/game` répondant 200 dans le test du Worker compilé |
| Vérification navigateur | Non réalisée ; ne pas la déclarer acquise |

Risques immédiats : le gros JSON est importé dans le Worker ; augmenter directement sa taille n'est pas une stratégie viable. La réponse quotidienne dépend de la longueur du tableau de cibles, donc l'agrandir changerait l'historique. Les exports et seeds de V1 ne conviennent pas à une compétition dotée. Enfin, état persistant et célébrations transitoires doivent être séparés pour éviter de rejouer une victoire au rechargement.

## 3. Organisation et modèles

Les libellés demandés sont ASTRA MAXIMUM pour l'orchestration et ASTRA MINIMAL pour douze sous-agents. Les réglages effectivement exposés et utilisés sont `gpt-6-astra` avec `reasoning_effort=max` pour le sous-agent orchestrateur et relecteur, et `reasoning_effort=low` pour les douze spécialistes. Le propriétaire principal conserve la configuration réelle de sa session. Il ne s'agit pas de modèles distincts nommés « MAXIMUM » et « MINIMAL ».

Le propriétaire principal de la conversation reste responsable des outils Sites, du checkout, des modifications, des intégrations et des publications. L'orchestrateur en max arbitre les dépendances et revoit les plans. Les spécialistes produisent des recherches, spécifications et revues bornées. Ils ne modifient pas le Site, ne publient pas et ne créent pas d'autres agents. Au maximum six sous-agents sont actifs à la fois, avec moins de spécialistes simultanés si l'orchestrateur occupe un créneau.

| Mission | Responsabilité | Livrable attendu |
|---|---|---|
| 01 | Moteur et données | Catalogue versionné, scores segmentés, calibration et compatibilité |
| 02 | Design et mouvement | Tokens, états, événements visuels et interaction mobile |
| 03 | Rituel et progression | Archives, objectifs, récompenses et migration |
| 04 | Expéditions | Parcours, transitions, reprise et fin de session |
| 05 | Cercles d'amis | Identités invitées, invitations, membres et résultats |
| 06 | Duels | Règles, manches, autorité serveur et comparaisons |
| 07 | Collections | Manifestes éditoriaux, univers et complétion |
| 08 | Laboratoire | Variantes, contrats et qualification du contenu |
| 09 | Studio créateurs | Brouillons, droits, validation, publication et retrait |
| 10 | Distribution | Partage, PWA, intégration et contrôle des origines |
| 11 | Publicité et mesure | Emplacements, configuration, consentement et données observées |
| 12 | Qualité, DX et AX | Architecture, non-régression, preuves et reprise autonome |

AX signifie Agent Experience : facilité pour un agent de comprendre, modifier et vérifier le projet. L'accessibilité est une exigence UX transversale.

Les douze rôles couvrent le programme ; ils ne doivent pas être recréés tous les douze à chaque reprise. Seules les missions nécessaires au prochain lot sont sollicitées.

## 4. Architecture commune

Conserver la stack existante et l'absence d'appel payant d'IA par proposition. Séparer progressivement domaine de jeu, vues, persistance, données, contenus, social, distribution et publicité. Éviter de remplacer toute l'application par une nouvelle architecture avant de livrer un bénéfice.

### Contrats à figer avant les extensions

- `PuzzleRef` : identifiant opaque, version de corpus, version de règles, contexte et référence de calendrier immuable.
- `GameContext` : quotidien, archive, libre, collection, expédition, cercle, duel ou création.
- `Variant` : classique, deux braises, intrus ou chaîne. Une variante est distincte du contexte.
- `GuessResult` : mot canonique, score réel, rang, découverte, numéro d'essai et version.
- `GameState` : chargement, prêt, soumission, erreur ou victoire ; état de reprise indépendant des effets visuels.
- `ProgressEvent` : identifiant unique, type, date serveur ou date locale qualifiée, références de partie et provenance vérifiée/personnelle.
- `ContentManifest` : identité et édition, langue, difficulté éditoriale, états de publication, ressources et attributions. Les références secrètes restent côté serveur.
- `AdDecision` : emplacement, consentement applicable, disponibilité, fréquence, résultat et motif de non-affichage. Aucun mode ne charge une régie directement.

### Stockage

R2 est la cible pour les artefacts immuables de scores, segmentés par cible et version. Le Worker conserve un index compact et un cache borné en octets. Produire les rangs hors ligne. Garder le lecteur V1 tant que des parties de référence en dépendent.

D1 est la cible pour sessions invitées, cercles, invitations, parties vérifiées, duels et brouillons. Les premières collections éditoriales peuvent rester dans des manifestes versionnés. Ne pas stocker dans SQL toutes les paires mot/cible.

Les bindings et migrations doivent être validés avec les capacités Sites réelles avant utilisation. Le temps réel n'est pas inclus dans le minimum des duels : des objets de coordination ne seront ajoutés que si l'hébergement les prend effectivement en charge et si l'usage le justifie.

La licence et l'attribution du corpus restent respectées. Séparer les données redistribuables du calendrier des parties actives sans prétendre rendre un corpus public impossible à exploiter pour tricher.

## 5. Chemin 1 : un moteur durable

**Livraison principale :** au moins 400 cibles courantes validées et un nouveau calendrier couvrant 365 quotidiens sans répétition, sans modifier les dates V1 ni les seeds historiques. Objectif d'extension : 1 000 cibles et 60 000 propositions validées, uniquement si la qualité est conservée. Ces volumes sont des objectifs proposés, pas des résultats actuels.

1. Figer les 120 cibles, le calendrier et les seeds historiques V1.
2. Séparer mots acceptés, cibles jouables et indices ; définir les collisions d'accents, ligatures, apostrophes et formes fléchies.
3. Rendre le pipeline reproductible : source, empreinte, filtrage, contrôles numériques et manifeste.
4. Segmenter les scores dans R2 et supprimer le chargement systématique de toute la matrice.
5. Calibrer fréquence, ambiguïté et voisinages ; produire un rapport éditorial par cible.
6. Tester ancien et nouveau lecteur sur les mêmes données avant d'activer un nouveau corpus.

**Validation éditoriale :** pour chaque cible, enregistrer critères de français courant, ambiguïté, voisinages et indices, ainsi que la décision et son auteur dans le manifeste. Une revue éditoriale par agent est identifiée comme telle ; une passe indépendante peut rejeter la cible. Les contrôles numériques seuls ne valent pas validation éditoriale, et aucun avis humain n'est inventé.

**Acceptation :** réponses V1 inchangées ; aucune valeur non finie ; cible exacte à 100 ; erreurs inconnues explicites ; indices distincts et pertinents ; reconstruction reproductible ; versions figées dans chaque partie. La limite mémoire de 128 Mo impose une marge mesurée ; objectif de qualification proposé : pic inférieur à 100 Mo sur le scénario de référence. Le programme doit mesurer cette marge, pas seulement vérifier la taille du fichier.

## 6. Chemin 2 : une braise vivante

**Livraison principale :** une matière et une lumière cohérentes, qui réagissent à des événements réels, en conservant le champ directement accessible.

1. Centraliser les tokens de couleur, surfaces, type, espace et mouvement ; conserver charbon, ivoire et orange comme base.
2. Définir `guessAccepted`, `bestImproved`, `puzzleWon`, identifiés et consommés une seule fois.
3. Lier la jauge au meilleur score réel ; ne pas récompenser visuellement une proposition moins proche.
4. Différencier record bref et victoire, annuler les temporisations à la navigation.
5. Adapter le plateau aux petits écrans et au clavier, avec cibles tactiles confortables et saisie de 16 px minimum.
6. Maintenir un équivalent sans mouvement et sans son pour chaque information.

**Acceptation :** aucune fête à la restauration d'une ancienne victoire ; aucune perte de saisie pendant une requête ; aucune animation ne bloque la prochaine proposition ; progression compréhensible sans couleur ; focus et annonces explicites. Les durées et intensités seront des paramètres de design, pas des règles éparpillées.

## 7. Chemin 3 : un rituel qui se développe

**Livraison principale :** archives, calendrier, trois objectifs hebdomadaires variés et cosmétiques permanents, sans perdre la progression V1.

1. Introduire un profil versionné et une migration idempotente avec copie de secours.
2. Ouvrir explicitement les dates passées côté serveur et interdire les dates futures.
3. Séparer la date du mot et la date réelle de réalisation ; une archive ne prolonge pas rétroactivement la série.
4. Dédupliquer les récompenses, y compris après import, requête répétée ou deuxième onglet.
5. Ajouter des objectifs configurés et des cosmétiques accessibles, sans retrait après une absence.
6. Prévoir export/import et, après le socle social, récupération facultative d'un profil.

**Acceptation :** mêmes gains après migration répétée ; aucun historique manquant inventé ; semaine du lundi à Paris ; tests aux deux changements d'heure ; objectifs indépendants du visionnage publicitaire. Les historiques locaux importés ne créent pas de résultats compétitifs vérifiés.

## 8. Chemin 4 : les Expéditions

**Livraison principale :** six parcours éditoriaux, comportant trois à cinq mots, avec reprise et bilan. Ce quota est une cible de contenu du plan.

1. Utiliser le catalogue validé et des éditions immuables, avec trois étapes par défaut.
2. Faire progresser l'étape uniquement après découverte réelle ; protéger les cibles futures.
3. Préserver essais, indices et étape lors d'une fermeture ou d'une coupure.
4. Afficher clairement longueur, progression et action suivante, avec possibilité de reprendre plus tard.
5. Attribuer une seule récompense finale par édition.
6. Préparer une pause publicitaire indépendante de la transition de jeu.

**Acceptation :** parcours réalisable de bout en bout, rechargement fidèle à chaque étape, double clic sans saut d'étape ni double récompense. Publicité refusée, absente ou échouée : poursuite immédiate. Le thème peut être révélé progressivement ; la longueur est connue avant de commencer.

## 9. Chemin 5 : de vrais cercles d'amis

**Livraison principale :** créer un groupe privé, inviter, rejoindre avec un pseudonyme, jouer un défi commun et comparer des résultats réellement conservés.

1. Créer une identité invitée côté serveur et une session opaque ; le premier jeu reste sans compte obligatoire.
2. Définir propriétaire et membre, récupération facultative et révocation.
3. Créer des invitations à jeton aléatoire, haché, limité et révocable. Ouvrir le lien seul ne consomme pas l'invitation.
4. Conserver essais, indices et victoires avec idempotence et contrôle de concurrence.
5. Afficher uniquement les résultats des membres autorisés, avec règles et égalités annoncées.
6. Ajouter un défi hebdomadaire par cercle et ses archives.

**Acceptation :** rejoindre directement une partie ; reprise fidèle ; impossibilité d'agir pour autrui ; adhésion répétée neutre ; aucun accès après exclusion ; jeton absent des journaux. Une session anonyme prouve la continuité du membre, pas son identité civile.

## 10. Chemin 6 : les Duels

**Livraison principale :** duel asynchrone privé en trois manches, avec mêmes cibles distinctes, mêmes règles et même version pour les deux personnes. Le direct est une extension conditionnelle, pas une condition artificielle empêchant de livrer l'asynchrone.

Règles de départ proposées : 48 heures après acceptation, 30 propositions valides distinctes par manche, aucun indice. Trouver prime sur ne pas trouver ; entre réussites, moins d'essais ; entre échecs, meilleur rang. Égalités conservées, aucun départage chronométrique. Ces paramètres sont configurables et doivent être évalués avant activation large.

1. Versionner les règles et états : invitation, acceptation, jeu, terminé, annulé, expiré.
2. Réutiliser les sessions et invitations, avec acceptation atomique d'un adversaire.
3. Enregistrer essais et décisions de manche côté serveur ; aucun résultat local déclaré ne fait foi.
4. Masquer les essais et réponses adverses avant clôture.
5. Permettre reprise, abandon explicite, bilan et revanche.
6. Vérifier événements rejoués, requêtes simultanées et échéances.

**Acceptation :** bilan reconstructible depuis les faits enregistrés ; impossibilité de soumettre après clôture ; mêmes conditions ; absence d'inscription automatique d'une invitation ignorée comme défaite. Pub uniquement après le duel. Aucune promesse de détecter toutes les aides externes.

## 11. Chemin 7 : les univers et collections

**Livraison principale :** cinq collections de douze énigmes : cuisine, cinéma, nature, voyage et émotions, sous réserve de validation des 60 entrées.

1. Sélectionner des cibles et indices cohérents, sans personnages, images ou marques repris sans droit.
2. Versionner catalogue, édition, ordre et état éditorial indépendamment du moteur.
3. Réutiliser exactement la même évaluation que le classique.
4. Proposer choisir, reprendre et compléter, avec compteurs provenant de la sauvegarde.
5. Créer des variations de la direction visuelle commune, préservant contraste et lisibilité.
6. Prévoir le sponsoring clairement identifié comme une configuration séparée, désactivée sans partenaire réel.

**Acceptation :** une même cible, avec les mêmes versions de corpus et de règles, conserve son score dans tous les contextes ; éditions commencées stables ; victoire dédupliquée ; aucune collection fictivement complète. AX : manifestes inspectables, schémas et exemples de validation pour ajouter du contenu sans réécrire les écrans.

## 12. Chemin 8 : le laboratoire

**Livraison principale :** deux variantes complètes, Deux braises et L'intrus. La chaîne d'associations est préparée comme extension dépendant d'un graphe validé.

- Deux braises : douze paires éditoriales ; deux températures distinctes par proposition, une cible découverte reste acquise, victoire lorsque les deux sont trouvées. Aucun score combiné inventé.
- L'intrus : vingt quatuors relus, réponse unique justifiée et explication après la manche. Une proximité vectorielle ne suffit pas à prouver un intrus.
- Chaîne : trois parcours témoins pour valider le principe, puis extension éventuelle. La matrice actuelle ne calcule pas les liens entre n'importe quels deux mots ; produire un graphe autorisé et vérifier sa solvabilité.

**Acceptation :** règles comprises dans l'interface, historiques séparés, scores de Deux braises identiques aux évaluations individuelles, aucune cible exposée avant découverte, reprise fidèle. Les tests auprès de vrais joueurs sont une validation produit à obtenir ; un agent ne doit pas inventer leurs réponses ni conditionner les tâches techniques restantes à un panel inexistant.

## 13. Chemin 9 : le studio créateurs

**Livraison principale :** composer depuis un catalogue approuvé, sauvegarder un brouillon, valider, publier un lien vers une édition immuable et retirer. Les créations ne modifient pas le quotidien.

1. Réutiliser identité et droits ; distinguer manifeste créateur privé et manifeste participant.
2. Utiliser choix et textes approuvés pour la première version ; aucun import libre non validé.
3. Proposer sélection, ordre, suppression et aperçu, y compris au clavier.
4. Valider les mutations côté serveur, gérer concurrence et taille de collection.
5. Publier une édition immuable ; une modification crée un brouillon distinct. Retrait effectif malgré les caches.
6. Créer une vue streamer distincte, sans solution, proposition gagnante ou annonce vocale révélatrice.

**Acceptation :** un créateur ne peut pas lire un autre brouillon ; les participants ne reçoivent aucune cible future ; publication impossible d'une entrée retirée ; reprise de brouillon sans perte. Le circuit de revue humaine reste requis pour ajouter de nouveaux éléments éditoriaux, sans être simulé.

## 14. Chemin 10 : distribution web

**Livraison principale :** métadonnées et partage sans spoiler, PWA progressive, route d'intégration et démonstrateur d'iframe sur une origine de test maîtrisée. Aucun partenaire commercial fictif.

1. Centraliser l'origine canonique réelle et les métadonnées présentes dans le HTML initial.
2. Ajouter manifeste, icônes et service worker versionné, sans mettre en cache des réponses secrètes ou des données sociales.
3. Permettre un démarrage hors connexion de l'interface et une explication honnête des fonctions nécessitant le réseau. Ne jamais produire de scores de remplacement.
4. Tester la mise à jour de cache sans effacer le profil ni couper une partie active.
5. Préparer l'iframe, l'attribution, le contrôle d'origine et un contrat `postMessage` versionné.
6. Documenter accès public, intégration partenaire, limites des cookies tiers et statut des vérifications.

**Acceptation :** origine non autorisée rejetée, messages étrangers ignorés, aucun accès privé présenté comme public ; mode hors ligne explicite ; mise à jour sans perte. L'accès anonyme réel et l'intégration chez un partenaire sont validés uniquement après leurs configurations effectives.

## 15. Publicité et mesure, transversales aux dix chemins

Le revenu doit être lié à une vraie audience et à des impressions réellement servies. Aucun CPM, revenu ou taux de retour n'est présenté comme acquis.

Un module central décide de l'affichage. V1 commerciale proposée : un emplacement display séparé du jeu. Les transitions d'expédition et les bilans de duel constituent des possibilités ultérieures. Aucune annonce au milieu d'une saisie ni aucun objectif imposant de regarder une publicité. Une récompense éventuelle est cosmétique, facultative et sans avantage dans le quotidien ou le duel.

La configuration d'une régie, le compte éditeur réellement approuvé, les informations d'éditeur et le dispositif de consentement applicable sont des dépendances externes de l'activation. Le développement de l'adaptateur, ses erreurs et l'absence d'annonce peuvent être terminés sans cette activation. Ne pas charger une fausse régie ou copier des identifiants publics trouvés ailleurs.

Mesurer avec définitions stables : début réel de partie, proposition valide, progression, victoire, partage utilisé, retour J1/J7, session et impression. Ne pas compter une proposition comme une nouvelle page vue. Ne pas transmettre les mots ou secrets dans les événements analytiques. Séparer les faits de jeu nécessaires des traceurs publicitaires/mesure soumis à leurs règles applicables.

La politique exacte, ses seuils de fréquence et les critères d'expérimentation seront consignés dans une configuration. Le jeu doit rester utilisable en cas de refus, blocage ou panne de la publicité.

Sources à consulter avant activation : [Google AdSense, pages de jeu](https://support.google.com/adsense/answer/2768340), [Google H5 Games Ads](https://adsense.google.com/start/h5-games-ads/), [politiques des annonces récompensées](https://support.google.com/adsense/answer/9121589).

## 16. Séquencement des lots

| Lot | Contenu | Dépendances | Sortie |
|---|---|---|---|
| B0 | Référence V1, fixtures, état, mesures et contrats | Aucune | Point de comparaison reproductible et migration préparée |
| B1 | Faisabilité/provisionnement R2, versions immuables et lecteur segmenté | B0 + binding R2 réel | Compatibilité V1 et stockage réel vérifiés |
| B2 | Catalogue étendu et calendrier durable | B1 | 400 cibles validées et 365 dates distinctes |
| B3 | Interface vivante, événements et module publicité inactif | B0 | Jeu central utilisable, animations fidèles, mode sans annonce |
| B4 | Migration, archives, objectifs et cosmétiques | B1, B3 | Progression préservée et dédupliquée |
| B5 | Collections puis expéditions | B2, B4 | 5 collections, 6 parcours complets |
| B6 | Faisabilité/provisionnement D1, sessions invitées et parties serveur | B1, B4 + binding D1 réel | Autorité serveur et droits validés |
| B7 | Cercles et duels asynchrones | B2, B6 | Parcours sociaux complets avec résultats réels |
| B8 | Deux braises et L'intrus | B2, B4 | Deux variantes complètes |
| B9 | Studio créateurs | B5, B6 | Brouillon, validation, édition publiée et retrait |
| B10 | Partage, PWA et embed | B3, B6 + origine de test maîtrisée pour embed | Implémentation et contrôles autorisés ; validations restantes consignées |
| B11 | Consolidation, qualification et publication privée | B5, B7, B8, B9, B10 | Dix chemins implémentés ; contrôles autorisés réalisés ; validations restantes consignées |
| C1 | Activation commerciale et partenaires | B11 + données externes réelles | Accès et publicités réellement validés |
| C2 | Direct et chaîne généralisée | B7/B8 + preuves d'usage et capacités | Extensions mesurées, jamais activées par défaut |

Si R2 ou D1 est indisponible, ne pas déclarer son lot terminé ; préparer ses interfaces puis continuer les lots indépendants. Le démonstrateur iframe exige une origine de test effectivement maîtrisée, pas un partenaire fictif.

B3 peut avancer pendant la préparation de B1/B2. B6 peut être réalisé en parallèle conceptuel de B5, après stabilisation des contrats. L'intégration dans le checkout reste séquentielle. Aucun délai calendaire n'est promis sans mesure de charge et validation des dépendances.

## 17. Qualité, DX et AX

Chaque lot possède une entrée, une sortie et des preuves. Les tests ciblent les vrais risques : calendrier Paris, maintien des cibles V1, normalisation, réponses tardives, récompenses répétées, sauvegardes corrompues, droits, invitations, soumissions simultanées et panne des dépendances.

Pour le code : tests pertinents, `npm run typecheck`, `npm run build`. Les modifications documentaires seules ne justifient pas une reconstruction de l'application. Les contrôles navigateur suivent les instructions de l'environnement et nécessitent une demande explicite de ce type de test ; ne pas inventer une autorisation ni annoncer des captures inexistantes. Conserver séparément les contrôles réalisés et ceux restant à faire.

Pour les agents : chemins canoniques, schémas lisibles, fixtures stables, interfaces explicites et journal d'exécution. Un agent reprend le prochain travail depuis le journal, et non depuis une promesse dans une ancienne conversation.

Pour le retour arrière : conserver version précédente, empreintes du corpus et migrations compatibles. Déployer avec drapeaux de fonctionnalité ; activer une nouvelle fonction après vérification. Un rollback de code ne supprime jamais automatiquement des données utilisateur ni une migration.

## 18. Objectif et boucle de reprise

Le contrat de reprise est dans `GOAL.md`, et l'état machine dans `EXECUTION.json`. Ce sont des fichiers de pilotage, pas une implémentation fictive de la commande `/goal`.

Boucle : lire l'état distant exact → choisir un lot débloqué → réaliser une tranche complète → vérifier → corriger → enregistrer preuves et commit → publier si le jalon l'exige et que l'audience est autorisée → enregistrer la prochaine action.

Si une dépendance externe bloque un lot, continuer les autres lots réalisables. Si plus aucun travail autorisé et exécutable ne reste, suspendre la reprise et produire un état explicite. En cas de fin du périmètre principal, conserver séparément l'activation commerciale et les extensions conditionnelles.

L'arrêt sur erreur préserve la version live précédente. Ne pas multiplier automatiquement les essais identiques. Un blocage ne devient pas une réussite par reformulation.
