# BRAIZ — Référencement Google, moteurs IA et AdSense

Audit et corrections du 15 octobre 2026. Domaine public : https://braiz.io.

## État de préparation

| Sujet | Résultat | Limite |
| --- | --- | --- |
| Structure SEO | 9 pages publiques avec contenu HTML, titres, descriptions, canoniques et maillage | L’indexation et les positions ne sont pas garanties |
| Google Search Console | Vérification tentée par connecteur puis navigateur | Le connecteur GSC Wizard exige un abonnement ; le navigateur demande une connexion Google. Propriété, sitemap enregistré, trafic et indexation non vérifiables |
| ChatGPT et moteurs IA | Pages publiques accessibles aux robots selon robots.txt ; index de lecture llms.txt fourni | Aucune preuve d’inclusion ou de citation dans un moteur IA |
| AdSense, association technique | Identifiant existant conservé, balise de vérification et ads.txt ajoutés | La présence de ces éléments ne prouve pas l’approbation Google |
| AdSense, diffusion | Inactive : aucune requête d’annonce ni espace vide simulé | Adaptateur publicitaire et consentement effectif non configurés ; état du compte inaccessible |
| Identification de l’éditeur | Aucune coordonnée ajoutée | L’utilisateur demande explicitement de laisser ce sujet en attente. Les mentions légales et le contact public ne sont pas finalisés |

**Conclusion : le socle technique SEO est préparé ; il serait inexact d’annoncer AdSense entièrement prêt ou une indexation Google confirmée.**

## Corrections réalisées

- Jeu immédiatement accessible sur l’accueil, sans écran marketing préalable. Les explications et guides sont placés après le jeu ; aucun texte pédagogique supplémentaire n’est ajouté autour de la saisie ou de la flamme.
- Sept nouvelles pages documentaires, reliées entre elles et depuis l’accueil. Leur introduction répond directement à la question de la page. FAQ visibles avec une hiérarchie H2/H3 ; pas de faux avis ni de promesse de résultat enrichi.
- Métadonnées propres à l’accueil, au duel et aux sept guides : titre, description, canonical, Open Graph et aperçu Twitter. Suppression de la canonical d’accueil héritée indifféremment par toutes les pages.
- Image de partage de marque en PNG, 1 200 × 630 pixels, sans résultat de jeu inventé.
- Données structurées WebSite et WebApplication sur l’accueil ; BreadcrumbList sur les guides et le duel. Leur JSON est contrôlé dans le HTML réellement renvoyé, sans prétendre à une validation de résultat enrichi par Google.
- Sitemap limité aux neuf pages éditoriales publiques. L’ancien lastmod fixe et les fréquences/priorités arbitraires sont retirés : aucune date de modification quotidienne fictive.
- robots.txt conserve l’accès aux pages publiques, dont Googlebot, Bingbot et OAI-SearchBot via le groupe générique ; les chemins API et données sémantiques sont exclus de l’exploration. Ces directives ne constituent pas une protection d’accès aux données.
- llms.txt décrit les modes réels et relie les pages utiles. Aucune solution quotidienne, invitation, identité privée ou donnée de partie n’y est publiée.
- Pages /studio, /streamer, /laboratoire, /laboratoire/deux-braises, /cercles, /integration, /espace, /embed et /entrainement marquées noindex et absentes du sitemap. Elles restent explorables pour que les robots lisent cette instruction. Les variantes de jeu sur l’accueil conservent la canonical vers /.
- Script publicitaire global retiré. Vérification du compte assurée par la méthode officielle de balise Meta et ads.txt. Le module publicitaire conserve sa décision skip/not-configured ; aucun consentement fictif ni fausse impression.
- Confidentialité rendue accessible par une URL stable, avec la description du comportement réel : sauvegarde locale, calcul en ligne, synchronisation facultative non chiffrée de bout en bout, fonctionnement publicitaire inactif.

Les moteurs sémantiques, corpus et identités historiques, réponses API, sauvegardes et pack d’entraînement immuable ne sont pas modifiés.

## Carte thématique et intention par page

BRAIZ est un jeu grand public, pas un SaaS B2B. Les intentions ci-dessous sont des choix éditoriaux, sans volumes de recherche ni positions inventés.

| Type | URL | H1 | Mot-clé principal | Intention |
| --- | --- | --- | --- | --- |
| Jeu | / | Mot du jour | jeu de mots du jour gratuit | Jouer immédiatement |
| Pilier | /jeu-de-mots-semantique | Qu’est-ce qu’un jeu de mots sémantique ? | jeu de mots sémantique | Informationnelle : comprendre la famille de jeux |
| Guide pratique | /comment-jouer | Comment jouer à BRAIZ | règles BRAIZ | Informationnelle : apprendre les actions et indices |
| Explication | /proximite | Comprendre la proximité dans BRAIZ | proximité BRAIZ | Informationnelle : interpréter classement et jauge |
| Mode | /partie-libre | Jouer une partie libre | BRAIZ partie libre | Jouer sans attendre le lendemain |
| Mode | /archives | Retrouver les mots des jours précédents | archives BRAIZ | Retrouver un défi passé, sans page de solutions |
| Mode | /duels | Duel | duel de mots entre amis | Jouer à deux, de manière asynchrone |
| Méthode | /a-propos | À propos de BRAIZ | BRAIZ modèle linguistique | Comprendre les sources, limites et licences |
| Information | /confidentialite | Confidentialité | confidentialité BRAIZ | Comprendre le traitement des données |

La page pilier relie tous les guides. Chaque guide renvoie au pilier et aux modes concernés. La page /partie-libre explique le mode et mène au vrai lancement /?mode=free ; /archives mène au vrai calendrier /?surface=archives. Ces URL éditoriales ne créent pas de faux jeux parallèles.

## Briefs de contenu mis en œuvre

| Page | Réponse directe en introduction | Structure principale | Vocabulaire naturel |
| --- | --- | --- | --- |
| Pilier | Définition du jeu sémantique et présentation des modes réels de BRAIZ | Sens et orthographe ; représentation du progrès ; choix du mode ; limites ; FAQ | mot secret, proximité de sens, modèle linguistique, mot du jour |
| Règles | Envoyer des mots français et suivre le meilleur résultat | Envoyer ; comparer ; trois indices ; reprendre une partie ; FAQ | proposition, historique, classement, sauvegarde, indice |
| Proximité | Distinguer le rang exact et le remplissage visuel de la flamme | Lecture du progrès ; avant le Top 5 000 ; associations inattendues ; pistes ; FAQ | Top 5 000, Top 1 000, Top 100, Top 10, pourcentage |
| Partie libre | Chercher un nouveau mot à tout moment, avec les règles classiques | Continuer après le défi ; progression séparée ; indices ; FAQ | partie libre, essais illimités, jeu en français |
| Archives | Choisir une date passée et reprendre ses essais | Date ; réponse préservée ; reprise ; FAQ | archives, calendrier, défi quotidien, partie passée |
| Duel | Même série de trois mots, 30 essais par manche, sans indice, 48 heures après acceptation | Invitation ; rythme asynchrone ; départage ; confidentialité des mots ; FAQ | duel, ami, invitation, trois manches |
| À propos | Présentation concrète du jeu et des modes | Modèle ; données et licences ; modes ; FAQ | Word2Vec, frWaC, fastText, édition historique |

Les textes complets publiés constituent les livrables de ces briefs. Aucun bourrage de mots-clés, promesse de performance, comparaison de concurrent non vérifiée ni article de remplissage n’est ajouté.

## Relecture critique : objections et réponses

1. **« On ne comprend pas le pourcentage. »** La page Proximité décrit l’échelle réelle : 20/40/60/80 % aux repères Top 5 000/1 000/100/10. 100 % est réservé à la réponse. Les classements exacts restent dans l’historique. Cette explication demeure dans le guide, sans encombrer le plateau.
2. **« Les associations ont-elles été arrangées ? »** À propos explique le calcul à partir du modèle et ses limites. Aucune supériorité sémantique absolue n’est promise. Les anciennes éditions gardent leurs données.
3. **« Est-ce vraiment illimité ? »** Les pages distinguent les essais illimités des parties classiques et la limite réelle de 30 essais par manche du duel. Elles distinguent aussi partie libre en ligne et entraînement téléchargé.
4. **« Vais-je perdre mon mot du jour ? »** Les guides expliquent les progressions séparées et la sauvegarde dans le navigateur, sans promettre une restauration après suppression des données.
5. **« Mes essais sont-ils envoyés ailleurs ? »** La page Confidentialité décrit les propositions transmises pour le calcul et le transfert facultatif du profil. Elle ne prétend pas à un chiffrement de bout en bout.
6. **« Qui exploite le jeu et comment le contacter ? »** Point non résolu, laissé en attente à la demande explicite de l’utilisateur. Ne pas présenter la préparation éditoriale/juridique AdSense comme achevée.

## Mise en service Google restant à effectuer dans le compte

1. Ouvrir la propriété Search Console correspondant à braiz.io ; vérifier la propriété réelle et ses variantes de domaine.
2. Soumettre https://braiz.io/sitemap.xml dans la propriété existante, sans créer de propriété de remplacement inutile.
3. Inspecter l’accueil, /jeu-de-mots-semantique et /comment-jouer ; confirmer l’URL canonique retenue par Google et l’absence de blocage d’exploration. Demander une indexation seulement sur les pages importantes mises à jour.
4. Lire les rapports Indexation et Core Web Vitals ; vérifier d’éventuelles actions manuelles. Ces rapports ne sont pas disponibles dans cette session.
5. Mesurer ensuite impressions, clics et requêtes sur des périodes comparables. Aucun gain ne peut être chiffré avant ces observations ; aucune mesure de terrain Core Web Vitals n’est inventée.

## Mise en service AdSense restant à effectuer

1. Vérifier dans le compte que l’identifiant ca-pub-6705187262207125 est celui de l’éditeur et que le domaine braiz.io est associé. Il provient de la configuration déjà présente dans le projet.
2. Vérifier la reconnaissance de la balise Meta et de https://braiz.io/ads.txt, puis l’état d’examen du site. Une association technique ne vaut pas approbation ni statut « Prêt ».
3. Compléter ultérieurement l’identification de l’éditeur, le contact et les informations de confidentialité nécessaires au fonctionnement retenu ; aucune donnée inventée ou adresse personnelle n’a été publiée.
4. Configurer réellement une CMP certifiée compatible avec les exigences Google applicables aux annonces dans l’EEE, au Royaume-Uni et en Suisse. Une simple bannière artisanale n’est pas déclarée certifiée.
5. Implémenter l’adaptateur publicitaire dans lib/advertising.ts avec décisions fondées sur le consentement, la disponibilité et la fréquence. Réserver les emplacements hors de la saisie et des commandes du jeu ; contrôler mobile et déplacements de mise en page.
6. Ne charger le service de diffusion et ne demander d’annonces qu’une fois ces prérequis vérifiés. Contrôler les cas refus de consentement, retrait, absence d’annonce et réseau défaillant. Le site actuel reste sans requête d’annonce.

L’accès Google exige une connexion dans le navigateur ; aucune saisie d’identifiants, souscription payante, acceptation de contrat publicitaire ou activation commerciale n’a été effectuée pendant cet audit.

## Points de méthode vérifiés dans les sources officielles

- Google indique que les fondamentaux SEO, le texte utile et les liens restent applicables à ses fonctionnalités IA ; aucune optimisation spéciale n’assure leur inclusion. [Google Search : fonctionnalités IA](https://developers.google.com/search/docs/appearance/ai-features).
- Google précise depuis juin 2026 que llms.txt n’améliore ni ne dégrade le classement. Le résultat enrichi FAQ n’apparaît plus depuis mai 2026. Les FAQ restent ici pour répondre aux joueurs, sans promesse de visibilité spéciale. [Mises à jour Google Search](https://developers.google.com/search/updates).
- L’accès OAI-SearchBot concerne la recherche ChatGPT ; le contrôle d’entraînement GPTBot est distinct. La politique d’entraînement n’a pas été modifiée. [OpenAI : éditeurs et développeurs](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq).
- Google accepte une balise Meta ou ads.txt pour connecter le site à AdSense, puis exige l’approbation du site avant diffusion. [Connexion du site à AdSense](https://support.google.com/adsense/answer/7584263?hl=fr).
- Le fichier ads.txt identifie les vendeurs autorisés ; sa présence seule ne déclenche pas la diffusion. [Google : ads.txt](https://support.google.com/adsense/answer/12171612?hl=fr).
- Les exigences de CMP certifiée doivent être vérifiées avant toute activation dans les régions concernées. [Google : CMP et consentement](https://support.google.com/adsense/answer/13554116?hl=fr).

## Preuves de vérification

Le contrôle scripts/check-public-seo.mjs vérifie les réponses HTTP du serveur construit : neuf pages publiques en 200, titre distinct, description, canonical unique, partage social, balise éditeur, absence de script d’annonces, H1 unique, JSON-LD lisible, FAQ visibles, liens internes, couverture du sitemap/llms.txt, format ads.txt, dimensions du PNG, neuf exclusions noindex et vraie réponse 404.

Le fichier de livraison joint enregistre les résultats finaux, la publication et les limites observées. L’accessibilité technique d’une URL lors de ces contrôles ne prouve pas sa présence dans l’index d’un moteur.
