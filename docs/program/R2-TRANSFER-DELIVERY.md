# Stockage durable, 24 septembre 2026

**Actualisation du 12 octobre 2026 :** le constat403 ci-dessous est historique et sp�cifique au client Python. Les quatre transferts Node natifs ont d�sormais r�ussi avec relecture GET/SHA de 509 fragments. Voir [qualification actuelle](../review/corpus-qualification.md) et [inventaires durables](qualification-2026-10-12/r2-native-qualification.json). Le stockage runtime V2 et son calendrier restent � qualifier. Aucun filtre de s�curit� n�a �t� modifi�.

Binding natif Sites SEMANTIC_DATA déclaré, publication publique v32 réussie. Source applicative : 3bfd5a722186304c587100bebed5837022c33eaa.

V1 reste explicitement sur les assets tant que BRAIZ_V1_STORAGE ne vaut pas r2. Provisionner un bucket vide ne coupe plus le jeu. Aucun repli après échec R2 n'est ajouté.

Import limité aux blobs SHA-256 de 8 Mio maximum, avec vérification des octets et checksums R2. Authentification temporaire avec expiration, y compris GET et HEAD. Aucun calendrier, pointeur actif ou chemin arbitraire modifiable. Le script Python lit le secret sans écho, refuse les redirections et relit chaque objet avant checkpoint. Persister les inventaires complets dans Git pour reconstruire les archives.

174 tests, TypeScript et build réussis. Authentification, expiration, bornes, checksum, roundtrip simulé et pannes couverts. Aucun test navigateur.

## Blocage réel

Le premier HEAD authentifié pour le manifeste V1 reçoit HTTP403. Diagnostic séparé sans secret : Cloudflare error code 1010, Browser Integrity Check. Aucun PUT effectué ; aucun objet distant revendiqué. Qualification réelle R2 non réalisée.

Variables temporaires retirées. Republier le même code applique leur retrait. Le filtre Cloudflare doit autoriser le client de transfert sur /api/semantic-transfer, en conservant l'authentification applicative. Aucun changement d'agent utilisateur ou contournement tenté. Aucune régénération coûteuse lancée.

Après correction, réémettre un secret temporaire, déployer sa configuration, vérifier le transfert réel, restaurer la source avec semantic:v2:restore et sauvegarder les archives source/corpus dans R2 avec inventaires commités. L'activation V2 reste à réaliser. Les parties V1 sont préservées, l'automatisation reste arrêtée.
