# Entraînement guidé et pack hors ligne

Entrée : **Explorer → Entraînement guidé**, URL `/entrainement`. Trois parcours indépendants, accessibles sans identité, avec neuf indices textuels progressifs. Aucun appel au quotidien, profil, XP, séries, cercle ou classement. Les réponses du pack sont inspectables : cet entraînement public n’a aucune valeur compétitive.

## Périmètre fini et scores

- Pack `training-v1-editorial-1` : **208 graphies, 3 cibles, 624 évaluations**.
- Les températures et rangs sont les valeurs V1 exactes ; les rangs portent sur **30 000 mots**, jamais sur les seuls 208 mots du pack.
- La liste consultable contient aussi les trois réponses. Les majuscules/espaces sont normalisés ; les accents doivent correspondre à la graphie indiquée. Un sous-ensemble ne peut garantir la désambiguïsation des alias du lexique complet.
- Un mot hors pack n’ajoute **ni score ni essai**, conserve la saisie et n’est pas déclaré absent de V1.
- JSON : **42 695 octets**. Installation complète : **255 268 octets non compressés**, manifeste compris, affichés avant l’action explicite de téléchargement. Le transport HTTP peut compresser ces fichiers ; le chiffre n’inclut pas ses en-têtes.

## Relecture éditoriale du 12 octobre 2026

Relecture effectuée lors de la mise en œuvre sur des cibles déjà présentes dans la collection V1 figée. Les intitulés décrivent le guidage proposé, sans statistique de difficulté, popularité ni affinité calculée. Aucun test de difficulté auprès de joueurs n’est revendiqué.

| Niveau | Cible | Caractéristique relue | Progression des trois indices |
| --- | --- | --- | --- |
| Facile | pomme | Objet concret du quotidien, détail final distinctif | Alimentation → fruit d’un arbre → pommier et couleurs |
| Standard | port | Mot polysémique ; sélection progressive du sens « lieu » | Déplacements/échanges → lieu au bord de l’eau → bateaux qui accostent |
| Exploration | curiosité | Disposition abstraite ; recherche d’une idée | Disposition de l’esprit → questions/découverte → désir de savoir parfois indiscret |

Les indices sont disponibles dès le début sur action volontaire. Ils ne modifient pas les cinq essais requis dans le quotidien. L’indice demandé est annoncé dans une zone de statut ; la restauration ne rejoue pas son annonce.

## Provenance et vérification reproductible

`node scripts/build-training-pack.mjs` génère les actifs ; `node scripts/build-training-pack.mjs --verify` vérifie sans réécrire les actifs publics.

Le producteur lit les trois segments V1 figés, vérifie leurs sommes SHA-256 et extrait seulement les 208 évaluations par cible. Il récupère **le véritable `lib/semantic.ts` du commit `85b05a71cba67b3283e1a19a1745d2d90570bcd2` avec Git**, l’exécute séparément sur le corpus brut figé, puis compare **chacune des 624 évaluations**. Ce vérificateur n’utilise ni le décodeur du producteur ni une copie de sa formule. Empreinte du code oracle : `e236e7505e25140cea77c21201143542e20c15c70ec885e8a4c820f8ab62c482`.

Corpus brut SHA-256 : `7bfcdbe58d335f191b1c72f9764b563e47d0035d45227603300db12428d64e16`.

Pack SHA-256 : `ace47abbbeda8bebf838d0dbe14982e8a0557b42f0ab166882f36fb53309c061`.

Manifeste final : `/training/manifest-c8ac667a9e336d0c28ae02d22f94b97ec0b967b99aa999997e9ce65774cb27c9.json`.

Le manifeste contient les tailles et empreintes exactes du pack et de l’écran autonome HTML/JS/CSS. Le service worker épingle son empreinte. Le navigateur vérifie à nouveau le JSON avant de rendre les scores utilisables. Les fichiers sont adressés par leur contenu ; `.gitattributes` sous `public/training` interdit les conversions de fins de ligne qui changeraient leurs octets. Le générateur vérifie qu’aucun corpus ou lecteur sémantique serveur n’entre dans le JavaScript client.

## Installation, reprise et suppression

La page en ligne utilise `components/training.tsx`. Un écran HTML autonome, construit à partir du **même composant React**, possède son JavaScript et ses styles intégralement inclus dans l’installation. Il ne dépend pas des chargements différés Next/RSC. La navigation froide et le rechargement de `/entrainement` utilisent cet écran en cas de coupure.

La consultation ou l’enregistrement du service worker ne télécharge pas de pack hors ligne. Seul **Télécharger pour jouer hors ligne** met les fichiers en cache : toutes les empreintes sont vérifiées, puis le marqueur d’installation est écrit en dernier. Une erreur conserve les versions précédentes. Une ancienne version complète demeure utilisable après mise à jour ; sa progression reste liée à son propre hash de pack. **Supprimer les fichiers hors ligne** retire les caches dédiés, même si leur manifeste est altéré, et conserve la progression personnelle ainsi que les caches étrangers. La page neutre `/offline.html` est conservée indépendamment.

La progression utilise exclusivement `braiz.training.progress.v1.<sha256-du-pack>`. Les sauvegardes futures/corrompues et les modifications concurrentes sont préservées et bloquent l’écriture. La reprise ne joue aucun son, ne déplace aucun focus, n’annonce aucune récompense et n’écrit rien à elle seule.

Le service worker ne met jamais en cache une API de jeu, d’authentification ou de synchronisation, ni une page personnelle. Les autres navigations privées hors connexion reçoivent seulement la page neutre.

## Limites et recette

Le navigateur peut refuser/évincer son stockage. Les téléchargements ne sont donc annoncés disponibles qu’après vérification locale, et la disponibilité doit être contrôlée avant un départ hors connexion. Sans téléchargement préalable, l’entraînement hors ligne est indisponible. Les données locales ne sont pas synchronisées entre appareils.

Tests ciblés : validation du pack, scores indépendants, état personnel, future corruption, erreur/concurrence, composant réel, protocole service worker et isolation des caches. **Les mocks Cache ne prouvent pas une coupure navigateur** : la recette réelle est effectuée par le contrôleur en Task 8, sur les hashes de livraison. Une première recette réelle a déjà validé coupure réseau + serveur arrêté + nouvel onglet + reprise sur une version antérieure de l’écran ; elle n’est pas présentée comme validation du hash final.
