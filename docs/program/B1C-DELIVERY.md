# B1c, génération paginée des cibles BRV2

## Statut

Le générateur local de scores et rangs d'une cible BRV2 arbitraire est implémenté et vérifié. Toute entrée admise par un corpus BRV2 peut être demandée comme cible technique. Cette preuve porte sur des fixtures synthétiques, pas sur le dictionnaire français complet réel qui reste absent de l'environnement.

## Livré

- cosinus réel calculé sur les vecteurs float32 vérifiés, avec contrat numérique versionné
- score int16 quantifié entre -10 000 et 10 000, arrondi symétrique explicite et cible exacte à 10 000
- rangs de compétition uint32 et ordre stable par score décroissant puis identifiant croissant
- histogramme fixe de 20 001 cases et index SQLite temporaire, sans tri global du corpus en mémoire
- pages immuables bornées `BSV2` et `BSO2`, chacune contrôlée par tailles et empreintes
- reprise par segment, y compris après synchronisation d'une queue non encore checkpointée
- vérificateur indépendant recalculant chaque score, chaque rang et toute la permutation avant activation locale
- verrou global sérialisant les différentes cibles et quota dur de huit cibles en staging par défaut
- une cible interrompue réserve immédiatement sa place dans le quota
- optimisation du calcul de taille des segments BRV2 pour éviter un coût quadratique dans un segment

## Vérifications

- `npm test` : 103 tests réussis, 0 échec
- fixture de 65 537 mots : identifiants, positions et rang 65 537 réellement vérifiés en uint32
- reprises après checkpoint, après synchronisation avant checkpoint et après pages immuables : sorties identiques à une génération propre
- corruption, configuration incompatible, cible hors corpus et dépassement de quota : refus explicites sans nouvelle activation
- `npm run typecheck` : réussi
- build Sites de production : réussi, avec régénération stable des 120 fragments V1
- ESLint ciblé sur les nouveaux scripts et tests : réussi
- `git diff --check` : réussi
- relecture gpt-6-astra maximale et deux revues spécialisées : aucun bloqueur local restant après corrections

## Limites réelles

- le fichier fastText français complet n'est toujours pas disponible et n'a pas été ingéré
- aucune cible du corpus réel complet n'a donc été préparée ni activée
- les mesures de durée, mémoire et disque sur le volume réel restent inconnues
- l'index de présence exact destiné au serveur reste à produire
- le mécanisme d'éviction opérationnelle et sa coordination avec de futurs lecteurs restent à implémenter ; le quota actuel refuse toute accumulation supplémentaire
- R2 est nul et non qualifié, tout comme la mémoire du Worker sur le volume complet
- le moteur V1 publié reste inchangé avec 30 000 mots, 120 cibles et 3 600 000 scores réels
- aucun test navigateur n'a été demandé ou exécuté
- aucune nouvelle version du Site n'a été enregistrée ou publiée pour ce lot de staging

## Retour arrière

Annuler les scripts, tests et documents B1c dans un nouveau commit. V1, les sauvegardes, les fragments publiés et la version privée 2 restent inchangés. Aucun corpus distant ni binding n'a été créé.

## Prochaine action

Produire l'index de présence paginé et l'éviction sûre du cache de cibles. Dès que la source complète autorisée est disponible, exécuter B1b et B1c sur son volume réel, enregistrer les mesures exactes, puis qualifier R2 et le Worker avant toute activation produit.
