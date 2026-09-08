# B1b : directive de corpus exhaustif

Statut : exigence produit enregistrée, non encore implémentée.

## État exact de la version publiée

- Le corpus V1 contient 30 000 entrées françaises filtrées parmi les 50 000 premières lignes de la source fastText Wikipédia français.
- 120 entrées seulement sont des cibles.
- Les 3 600 000 scores et rangs de la matrice 30 000 × 120 sont réels, déterministes et vérifiés.
- Les mots hors de ces 30 000 entrées sont refusés. Aucun score de remplacement n'est inventé.

Cette version ne constitue donc ni le dictionnaire français complet ni un catalogue où tout mot accepté peut devenir une cible.

## Exigence désormais prioritaire

Le prochain corpus doit parcourir l'intégralité du flux source et produire un lexique français canonique, versionné et mesurable. Le filtre d'admission doit être explicite, reproductible et auditable. Il conserve les formes lexicales françaises exploitables et documente séparément chaque exclusion technique, par exemple les lignes invalides, les vecteurs absents, les doublons Unicode ou les jetons non lexicaux.

Pour chaque entrée admise :

1. une proposition reçoit une similarité réelle issue de son vecteur, jamais une approximation présentée comme réelle ;
2. l'entrée est éligible comme cible d'une partie versionnée ;
3. le score, le rang et l'ordre stable restent identiques pour une même version de corpus, de règles et de cible ;
4. les anciennes parties V1 conservent exactement leur matrice, leurs identités et leurs sauvegardes.

Le nombre final d'entrées doit venir du pipeline complet et de son rapport d'exclusions. Il ne doit pas être annoncé avant ingestion et validation.

## Architecture retenue

Une matrice pré-calculée de toutes les paires croît au carré et ne doit être ni générée intégralement ni envoyée au navigateur. Le corpus complet reste segmenté côté serveur :

- manifeste protégé par des empreintes, version de filtre et provenance ;
- lexique et vecteurs normalisés répartis en segments bornés ;
- index de présence exact pour valider une proposition ;
- calcul direct de la similarité réelle à partir des deux vecteurs pour une proposition, et génération déterministe préalable du segment complet de scores et de rangs quand une partie exige un rang ;
- tâche de génération hors requête, reprenable par segment et par cible ; une cible froide n'est ouverte qu'après validation et activation atomique de son segment complet ;
- cache adressé par le contenu, borné et avec éviction ; un segment évincé est régénérable depuis les vecteurs immuables et ne transforme jamais le stockage en matrice quadratique durable ;
- lecture bornée et concurrente, avec refus explicite si un segment réel n'est pas disponible ;
- réponse API minimale pour une proposition, sans exposer le corpus ou les réponses actives au navigateur.

Le contrat de corpus fige la dimension et l'encodage des vecteurs, les normalisations Unicode et vectorielle, la formule de similarité, la quantification et l'arrondi, le traitement des égalités de rang et l'ordre stable de départage. Ces versions font partie de l'identité de chaque manifeste, segment et clé de cache.

La construction écrit d'abord des segments immuables dans un espace non actif. Chaque reprise relit et vérifie l'empreinte de la source, la configuration complète et tous les segments déjà produits. Le manifeste actif ne bascule qu'après validation exhaustive ; deux générations différentes ne peuvent jamais être mélangées.

Les budgets de mémoire couvrent séparément l'index de présence, les vecteurs et buffers décompressés, le calcul et le classement d'une cible, le nombre de tâches concurrentes et la taille du cache. Ils sont mesurés sur le corpus complet localement, puis qualifiés de nouveau dans le Worker et R2 réels avant déploiement.

R2 est la cible de stockage prévue mais reste non provisionné et non qualifié. Tant que le binding réel manque, le pipeline et ses validateurs peuvent être développés localement, sans déclarer le corpus complet déployé.

## Garde-fous UX, DX et AX

UX : la saisie reste rapide sur mobile, le premier chargement n'embarque pas le dictionnaire complet, et seuls les mots véritablement absents du lexique canonique sont refusés avec une explication claire.

DX : le pipeline est relançable, reprend après interruption, sépare source, filtre, manifeste et segments, et publie les comptages, tailles, durées et empreintes de chaque étape.

AX : chaque checkpoint expose les entrées lues, admises et exclues, les cibles couvertes, les segments produits et vérifiés, les budgets mémoire et les dépendances externes réelles. Aucun agent ne peut convertir un échantillon ou une estimation en couverture complète.

## Critères d'acceptation

- Lecture de l'intégralité de la source de référence, sans limite silencieuse de lignes ou d'entrées.
- Rapport reproductible des admissions et exclusions, avec empreinte de la source et version du filtre.
- Inventaire exhaustif reliant chaque entrée admise à un unique vecteur valide et à l'index de cible, sans trou ni doublon.
- Couverture mesurée de 100 % des entrées admises pour la validation des propositions et le calcul chaud/froid, avec traversée de tous les segments plutôt qu'un échantillon.
- Chaque entrée admise est techniquement utilisable comme cible versionnée ; une cible froide ne devient jouable qu'après génération, contrôle et activation de son segment complet.
- Tests de compatibilité V1, déterminisme, corruption, segment manquant, reprise, mémoire et concurrence.
- Bornes testées pour l'index, les buffers décompressés, le calcul d'une cible, la concurrence et l'éviction du cache. Mesures locales séparées de la qualification réelle du Worker et de R2.
- Publication privée uniquement après réussite des gates et confirmation du déploiement exact.
