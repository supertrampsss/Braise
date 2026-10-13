# Recette navigateur contrôleur — 12 octobre 2026, build 0886549

Origine exclusivement locale `http://127.0.0.1:5198`, Worker figé issu du build vérifié du lot4. Migrations locales0000–0005 exécutées avec succès dans `work/qa-state`. Aucune partie ni progression de production modifiée. Serveur identifié PID19888/session14508, fermé après recette, port5198 libre. Aucun changement du code par le contrôleur.

## Parcours effectivement exécutés

- Profil : résumé initial0 victoire/0série; portée du fichier profil et de la synchronisation lisible. Configuration sync explicite, aucune identité/transmission créée; accès vers `/espace`. Les parcours auth/sync complets attendent l'entrée des modes activée dans la préversion du lot8.
- Libre `00123` : identité et zéros initiaux conservés. Mot absent refusé sans compteur augmenté, saisie préservée et fiche de signalement volontaire proposée. Cinq propositions acceptées successives donnent les vrais scores V1; la meilleure piste reste distincte d'un dernier essai moins proche. Indice déverrouillé au cinquième essai, puis piste réelle43,20°/rang351 identifiée comme indice. Épingle posée,6essais/1indice et épingle conservés après rechargement. Doublon refusé sans incrément. Victoire réelle au septième essai, température100°/rang1, titre de victoire focalisé après rendu. Bilan :6propositions personnelles,1indice, seuil18° à l'essai2,35° à l'essai6(indice),55° à l'essai7. Profil :1victoire/0série/162XP, À ce moment Attiser6/15, Revenir1/3, Viserjuste0/2; médianes7essais/1indice, dénominateur1 explicite, réussite Libre datée12octobre.
- Quotidien local du12octobre puis archive du11octobre : deux vraies réponses acceptées par API V1,1essai chacune sans indice. Archive badge/date/retour et règle de série visibles; calendrier passe son11octobre à Terminé après victoire. Profil final3victoires/1jour de série/466XP; Attiser8/15, Revenir1/3, Viserjuste2/2 terminé. Aucune extension rétroactive de série. Style Cendre solaire effectivement déverrouillé, équipé explicitement, toujours équipé après rechargement. XP/progression restent466/3/1 après recharge, aucune récompense dupliquée.
- Capture mobile de référence publiquev32 via viewport390x844 seul +capture fullPage : DOM390x844/dpr1/client375/scroll375. Capture actuelle non qualifiée comme nouvelle publication. Capture desktop corrigée par CDP : emulation640x450/dSF2 sur origine localhost avec zoom0,5 donne un DOM réellement1280x900/dpr1 et une image1280x900. Overrides CDP et viewport réinitialisés après capture. Le fullPage du backend avait produit5058px, impropre à prouver1280px; ces deux captures sont en scratch.

## Preuves visuelles

Dans les sorties du chat, `Braise-realisation/captures/06-profil-qualifie-local.jpg` (viewport1280x900 vérifié) : préversion locale0886549, pas nouvelle publication. `02-public-v32-mobile.jpg` : ancienne version publique32. Ne jamais présenter une capture locale comme preuve de déploiement final.

## À terminer au lot8

- Partage : clic réel sur Partager ma réussite, pas de résultat vérifiable dans l'IAB (aucun toast/changement/document JS dialog observé). Aucun texte envoyé à un tiers; ne pas compter un partage réussi dans la recette. Vérifier voie native et fallback de copie réellement utilisable; tests unitaires seuls ne prouvent pas une feuille native de partage.
- Petites corrections visibles de français : «1 essais», «1 indices reçus», «sur1 réussites renseignées», «1 réussites» dans le profil/historique. Pas un blocage du lot4; compléter la cohérence D28 dans le lot8.
- Après une victoire à1essai, l'info Indice après5essais reste affichée alors que le bouton a disparu. Éviter cette explication de verrouillage inutile dans un plateau terminé, correction de hiérarchie D04/D29 au lot8.
- Les snapshots AX immédiats au rechargement ont parfois omis des textes alors que le DOM visible et la capture suivante les contenaient. Attendre le rendu réellement stabilisé avant verdict; aucune perte de données constatée.
- Les modes avancés restent volontairement masqués dans ce build; social/Studio/variantes/offline/embed et recette responsive finale encore requis. Aucune conformité globale, partage natif, calendrier externe ou lecteur d'écran réel revendiqué ici.
