# BRAIZ — flamme remplissable et retours des mots

Direction retenue le 14 octobre 2026 : `iteration-1.png` de Braise-Maquettes-2026-10-14, grande flamme sans bulle, progression sous la flamme, réception du mot vers sa ligne en 450 ms.

## Expérience livrée

- Mot du jour, archives, partie libre et défis classiques : même flamme vectorielle, grande et nette à toute résolution, remplie depuis le bas. La flamme garde le meilleur rang accepté. Une proposition moins proche fait apparaître son reçu et sa ligne sans faire reculer la jauge.
- Pourcentage entier sous la flamme. Il décrit le remplissage de la jauge de progression, pas une probabilité, ni un pourcentage du dictionnaire. Les rangs exacts restent dans l’historique trié par proximité.
- Repères stables : Top 5 000 = 20 %, Top 1 000 = 40 %, Top 100 = 60 %, Top 10 = 80 %, réponse reconnue = 100 %. Entre les repères, interpolation logarithmique déjà utilisée par la jauge. Le simple percentile du lexique n’est pas utilisé ; il monterait artificiellement très près de 100 % trop tôt. Les rangs inconnus ne reçoivent aucun score.
- Reçu transitoire `mot · rang` uniquement après acceptation de la réponse de la partie courante. Trajet de la saisie vers la ligne effectivement classée, 450 ms, au plus trois reçus simultanés. Aucun changement du focus ni défilement automatique. Aucun reçu pour un refus, un doublon, une restauration ou une ancienne réponse d’une autre partie.
- Burger à icône seule sur les pages utilisant la navigation commune, avec son libellé accessible conservé. Destinations : Mot du jour, Partie libre, Archives, Duel, Profil, Règles.
- Suppression des commandes d’épinglage et du carnet de pistes du plateau. Les anciennes données d’épingles sont conservées dans les sauvegardes et transferts pour éviter de supprimer les données de l’utilisateur.
- Trois indices maximum par partie classique, sauvegardés et décomptés après acceptation uniquement. Chaque indice utilise les vrais rangs du moteur courant : mot non joué, strictement mieux placé que le meilleur essai, jamais la réponse. Aucun palier imposant cinq essais. Le texte déjà saisi reste intact. Si le meilleur essai est 2e, aucun mot intermédiaire ne peut être proposé et le contrôle est désactivé.
- Les indices comptent dans les essais de la partie et sont identifiés dans l’historique et le bilan. Ils ne sont pas crédités comme des propositions personnelles ni comme une réussite sans indice.
- Résultat : une seule grande flamme, `Trouvé`, le mot, essais et indices, puis Continuer à jouer et Partager. Le bilan est replié sous Voir les essais. Retrait du texte de reprise redondant, du double bouton de copie/partage et du toast de victoire redondant. Le partage garde ses chemins natif, presse-papiers et copie manuelle, sans divulguer la réponse.
- Duel : réutilisation des mêmes composants de flamme, jauge et reçus ; resultats de manches harmonisés. Ses règles restent trois manches, trente essais par manche, sans indice, avec les règles serveur existantes. Le moteur n’est pas changé par cette refonte.
- Espace serveur : libellés Mot et Envoyer, retrait des degrés, historique trié du plus proche au moins proche avec rang exact. Tutoriel et règles classiques actualisés pour la progression et les trois indices.

## Compatibilité et limites

Le corpus et les réponses numériques ne sont pas modifiés. Les identités de partie, lectures historiques, clé de profil, contexte des archives, sauvegardes et pack hors connexion figé restent compatibles. La future édition classic-v2 inactive conserve sa politique sans indices manuellement sélectionnés ; la refonte ne réactive pas cette couche de voisins. Les éditions classiques actuellement jouables sont couvertes par les nouveaux indices.

Les effets respectent la réduction des animations, la pause choisie par la personne et la visibilité de la flamme. Les reçus et l’animation ne sont jamais enregistrés dans une sauvegarde.

Les maquettes et les trois séquences Imagegen sont des propositions illustratives statiques ; leurs valeurs ne sont pas des résultats réels. La version du site calcule et anime les seules réponses réellement acceptées.

## Vérification

La validation automatisée et les preuves de navigateur de cette livraison sont consignées dans le livrable `Braise-Maquettes-2026-10-14/Livraison.md`, avec le commit et la version native réellement publiés.

