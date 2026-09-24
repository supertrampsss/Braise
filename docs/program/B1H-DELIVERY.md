# B1h : génération réelle des tables de scores

## Résultat

Le corpus français BRV2 complet a été restauré et contrôlé, puis le générateur du projet a produit les tables réelles de scores et d’ordre pour les **62 mots approuvés à ce jour**. Chaque table couvre les **1 013 881 entrées** du corpus, avec 16 pages de scores et 16 pages d’ordre. Les contrôles exhaustifs du générateur et le contrôle global des 62 manifestes ont réussi.

Les mesures et l’empreinte agrégée sont dans [B1H-MEASUREMENTS.json](./B1H-MEASUREMENTS.json). La restauration du corpus est documentée dans [B1G-DELIVERY.md](./B1G-DELIVERY.md).

## Activation

Les fichiers sont un staging local ignoré par Git, dans work/semantic-v2-real et work/semantic-v2-targets-real. Ils n’ont pas été transférés au Site, à GitHub ou à R2. Le corpus V2 reste inactif et le moteur V1 publié n’a pas changé. R2 n’est pas provisionné ni qualifié, et la mémoire du Worker reste à qualifier. Il manque encore 303 approbations pour le calendrier éditorial de 365 mots.

Aucun test navigateur n’a été demandé ou effectué.

## Suite

Poursuivre les approbations jusqu’à 365 mots et construire le calendrier immuable. Provisionner ensuite R2, qualifier le Worker, puis transférer les actifs avec contrôle d’intégrité avant toute activation V2.
