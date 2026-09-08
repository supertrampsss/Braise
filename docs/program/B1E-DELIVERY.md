# B1e : corpus réel et lecteur paginé

La source fastText française complète a été ingérée localement et contrôlée indépendamment : 1 152 449 lignes, 1 013 881 entrées admises, 248 segments. Les empreintes et exclusions exactes sont dans B1E-MEASUREMENTS.json. Il s'agit des entrées du filtre versionné, pas d'une garantie lexicographique sur chaque mot français.

Lors de cette livraison historique, l'index exact couvrait toutes les entrées. Huit cibles (0, 1013880, 281, 2106, 916, 223, 1080, 1344) avaient chacune été générées avec couverture exhaustive des scores et rangs, puis vérifiées par le vérificateur indépendant intégré. Le quota de huit colonnes de staging était respecté.

Le lecteur paginé contrôle les empreintes épinglées, les bornes, les identifiants uint32 et les charges concurrentes. Son cache est limité à 8 Mio, ses opérations à quatre. L'adaptateur R2 borne les flux avant leur chargement intégral et refuse toute incohérence sans score de substitution. Les tampons externes ne peuvent pas altérer le cache après vérification.

Contrôles historiques : 140 tests passent, TypeScript et build de production passent. Relecture Astra maximale du lecteur sans bloqueur restant. Le transport R2 est testé avec des fixtures explicitement synthétiques, pas avec un service R2 réel. Le rapport durable B1E-MEASUREMENTS.json enregistre 6 828 ms et 163 224 Kio de RSS pour le lecteur local. Les valeurs précédemment annoncées de 68 ms et 53 280 Kio n'ont pas de rapport durable distinct retrouvé et ne doivent pas servir de preuve. Aucune de ces mesures ne qualifie un Worker.

Les sorties existaient sous work/source, work/semantic-v2-real et work/semantic-v2-targets-real lors de cette livraison. Elles ont ensuite disparu avec le nettoyage du checkout local : leur disponibilité ne doit pas être déduite de ce rapport historique. La reprise exacte est suivie dans RECOVERY-DELIVERY.md. Les commandes de génération et vérification sont documentées dans AGENTS.md. Le script qualify-semantic-v2-reader.mjs reproduit les lectures locales réelles quand son index et ses deux colonnes sont présents. La source est https://dl.fbaipublicfiles.com/fasttext/vectors-wiki/wiki.fr.vec, attribution fastText, licence CC BY-SA 3.0.

V1 reste actif et inchangé. Aucun corpus V2 n'est publié ni relié aux parties. R2 réel et mémoire Worker restent à provisionner et qualifier. Les contrôles HTTP authentifiés du Site et les tests navigateur ne sont pas réalisés. Les cercles, duels, studio et distribution locale sont déjà publiés en privé v5.

Suite : catalogue éditorial et politique de préparation des cibles, puis transfert durable et qualification R2/Worker avant activation V2. Les huit colonnes préparées ne constituent pas une limitation du vocabulaire éligible.
