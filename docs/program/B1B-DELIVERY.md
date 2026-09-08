# B1b, pipeline local du corpus complet

## Statut

Le pipeline reproductible d'ingestion du corpus V2 est implémenté et vérifié localement. Cette tranche prépare le chargement exhaustif demandé, mais le dictionnaire complet réel n'a pas encore été ingéré et le moteur V1 publié reste inchangé.

## Livré

- lecture en flux jusqu'à la fin réelle du fichier source, sans plafond implicite de lignes
- filtre lexical français canonique, versionné et assorti de motifs d'exclusion exclusifs
- déduplication exacte sur disque avec conservation de la première occurrence valide
- normalisation numérique robuste et stockage des vecteurs en float32 little-endian
- segments BRV2 immuables, compressés, bornés et vérifiés par empreintes SHA-256
- reprise déterministe après interruption, y compris après écriture d'un segment orphelin
- verrou exclusif sérialisé, récupération explicite d'un verrou abandonné et refus des constructions concurrentes
- manifeste candidat vérifié intégralement avant activation atomique
- vérificateur indépendant qui relit la source, les exclusions, chaque mot et chaque vecteur
- commandes dédiées `npm run semantic:v2:build` et `npm run semantic:v2:verify`

## Vérifications

- `npm test` : 96 tests réussis, 0 échec
- `npm run typecheck` : réussi
- build Sites de production : réussi, avec régénération des 120 fragments V1 existants
- `git diff --check` : réussi
- relecture gpt-6-astra maximale : aucun bloqueur local restant
- relectures spécialisées gpt-6-astra faible : concurrence, stockage, bornes et qualité validés

## Limites réelles

- aucun fichier source fastText complet n'était disponible dans cet environnement, donc aucune taille finale du lexique n'est annoncée
- aucun score ni rang V2 par cible n'est encore généré
- le binding R2 réel est nul et non qualifié
- la mémoire du Worker Cloudflare avec le corpus complet reste à qualifier
- V1 reste actif avec 30 000 mots admis, 120 cibles et 3 600 000 scores réels
- aucun test navigateur n'a été demandé ou exécuté
- aucune nouvelle version du Site n'a été enregistrée ou publiée pour cette tranche incomplète

## Reprise et retour arrière

Les fichiers V1, les parties existantes et la version privée publiée ne sont pas modifiés. En cas de retour arrière, il suffit d'annuler les scripts, tests et documents B1b dans un nouveau commit. Aucun corpus distant ni binding n'a été créé.

## Prochaine action

Obtenir la source complète autorisée, exécuter le pipeline jusqu'à son manifeste actif et enregistrer les mesures exactes. Ensuite, générer les scores et rangs réels pour chaque cible admise, transférer les segments vers R2 et qualifier le Worker avant toute activation produit.
