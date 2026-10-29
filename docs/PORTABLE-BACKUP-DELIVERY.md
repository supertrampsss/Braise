# Sauvegarde portable et profil

29 octobre 2026. Mise en production assurée avec le lot principal ; cette note ne vaut pas confirmation de déploiement.

## Livré dans le code

- Une rubrique Vos données visible dans le profil permet de télécharger puis importer une sauvegarde sans compte.
- Le fichier contient le profil et les sauvegardes classiques complètes : quotidien, libre, archive et défi, en cours ou terminées. Il conserve les mots, scores, rangs, indices, anciennes épingles et contextes de reprise.
- Un aperçu affiche les parties à ajouter, à fusionner, déjà présentes ou en conflit. La confirmation est indispensable. Un conflit bloque tout l'import ; aucune sélection silencieuse de la copie gagnante.
- L'accès aux duels reste séparé, avec un lien vers la récupération d'identité. Les secrets de session et de récupération ne figurent jamais dans le fichier.
- Le profil met en avant mots trouvés, série quotidienne et essais médians. Objectifs, niveau, détails statistiques et diagnostics restent disponibles à la demande, sans nouvelle récompense.
- Le contrôle volontaire de mesure produit s'insère dans Préférences ; son comportement appartient au module de mesure.

## Contrat conservé

La synchronisation serveur existe déjà. Son format et sa limite restent inchangés ; elle transporte les parties classiques en cours. Le nouveau format local `braiz-local-backup`, version 1, inclut également les historiques terminés et accepte au plus 8 Mio, 1 000 parties et les limites d'essais de chaque lecteur existant. Aucun dépassement n'est tronqué.

L'ancien fichier de profil reste strictement limité au profil. Les fichiers de sauvegarde complète et de profil seul disposent de commandes distinctes. Aucun envoi réseau ou import automatique ne résulte de la sélection d'un fichier.

Les lecteurs et validateurs existants sont réutilisés. Les identités V1, quotidien V2 et Word2Vec ne sont jamais converties. Les scores ne sont ni recalculés ni inventés. La frontière de migration et la chaîne brute du profil V1 sont préservées par le moteur d'import existant. Une frontière V1 différente bloque l'import.

La fusion réunit les essais compatibles et conserve les indices consommés. Les différences de score, date d'acceptation, statut d'indice ou contexte bloquent le rapprochement. Une partie terminée peut compléter sa propre branche inachevée ; elle ne peut absorber une autre branche ni remplacer une fin de partie divergente.

La préparation et l'aperçu utilisent une copie mémoire. L'import revérifie la révision locale et la garde du plateau avant les écritures. Une réponse de jeu ancienne est invalidée par la garde existante. Les erreurs de quota déclenchent le mécanisme de restauration des valeurs précédentes. Les données importées ne déclenchent ni victoire, ni animation, ni crédit supplémentaire.

L'aperçu et la confirmation vérifient aussi que chaque essai, indice et épingle du plateau en mémoire existe dans sa sauvegarde. Un essai non enregistré bloque le transfert, même si le fichier importé concerne une autre partie. Ce garde s'applique également à la fusion de la copie serveur, pour éviter qu'une reprise depuis le disque efface un essai resté en mémoire.

## Portée affichée

La copie contient des mots et des solutions en clair et doit être gardée privée. Elle exclut les secrets de connexion, l'accès aux duels, les modes d'entraînement séparés, le rappel calendrier et la préférence de mesure. Les statistiques importées restent personnelles et ne deviennent pas des résultats compétitifs vérifiés.

## Vérifications

Tests ciblés : sauvegarde portable, composant de confirmation, fusion locale existante, interface de synchronisation, profil et compatibilité Word2Vec. Cas couverts : sélection sans mutation, annulation, confirmation explicite, fichier lent supplanté, conflit partiel bloquant tout le lot, historique terminé, rang au-delà de 30 000, éditions mixtes, frontière V1, contexte, identité future, quota, état périmé, garde de plateau et import répété sans double crédit.

Commande : `node work/run-duel-tests.mjs local-backup local-backup-components device-sync social-sync-components profile-panel word2vec-integration`.

Résultat du 29 octobre : 50 tests réussis, aucun échec. Les régressions couvrent le refus d'un plateau non enregistré avant l'aperçu et après l'aperçu, pour le fichier local et la copie serveur.

La recette visuelle sur le vrai navigateur, le contrôle TypeScript final et la construction sont assurés par l'intégration du lot principal.
