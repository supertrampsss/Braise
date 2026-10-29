# Publicité : adaptateur prêt, diffusion inactive

État au 29 octobre 2026 : `AD_RUNTIME_CONFIG` reste `null`. Aucun appel au SDK AdSense, aucune demande d'annonce et aucun faux emplacement ne sont émis par les appels existants.

## Contrôle des comptes du 29 octobre

L'accès natif à Search Console et AdSense a été vérifié. Les anciennes notes indiquant un accès bloqué ou un abonnement supplémentaire nécessaire sont dépassées. Les preuves détaillées restent dans le dossier privé `BRAIZ-Qualification-2026-10-29/Google-AdSense.md`.

| Sujet | État constaté |
| --- | --- |
| Search Console | Rapport du 23 octobre : 8 URL indexées et 4 non indexées. Sitemap de 9 URL traité avec succès, dernière lecture le 26 octobre ; les périmètres des deux rapports diffèrent. |
| Deux demandes d'indexation | Tests en ligne réussis et demandes acceptées le 29 octobre pour `/comment-jouer` et `/proximite`. Cela ne confirme pas encore leur indexation ; ne pas répéter les demandes. |
| Approbation AdSense | « Attention requise », état daté du 22 septembre : contenu à faible valeur informative et écrans sans contenu d'éditeur. Aucun refus n'est déclaré corrigé. |
| ads.txt | Le fichier public répond HTTP 200 avec la ligne attendue. Le tableau AdSense le marque encore « Introuvable » ; sa nouvelle détection reste à confirmer. |
| Compte et unité | Les informations de paiement sont encore demandées. Aucune unité dédiée à BRAIZ n'apparaît dans la liste consultée. |
| Consentement | Le panneau Google est resté vide : état de ses messages inconnu. Aucune intégration CMP active dans le code contrôlé. |

## Ce qui est implémenté

`lib/advertising.ts` décide explicitement de l'éligibilité. Un adaptateur AdSense réel dans `lib/adsense-adapter.ts` charge le SDK asynchrone et crée une unité responsive avec les attributs du fournisseur. `components/ad-placement.tsx` l'utilise seulement après passage de tous les contrôles.

Les contrôles cumulatifs sont : configuration AdSense valide, confirmation effective de validation du compte, identifiant réel de l'emplacement, intégration CMP prête, consentement publicitaire explicitement accordé, partie inactive et fréquence autorisée. Un état absent ou inconnu ferme le placement. Le consentement de mesure BRAIZ n'est jamais assimilé à un consentement publicitaire.

L'adaptateur partage un chargement du SDK par document, refuse un second éditeur concurrent, vérifie de nouveau l'éligibilité après chargement, limite à une demande d'annonce par document et ne rafraîchit pas automatiquement les annonces. Un abandon du composant ou retrait du consentement pendant le chargement empêche la demande d'annonce. Une erreur de script ou un bloqueur laisse le placement sans annonce. Les tests utilisent un faux DOM et des valeurs fictives isolées, sans aucune requête Google.

## Informations et intégration encore requises

1. Corriger les motifs de refus avec des preuves de contenu utile et d'écrans admissibles, puis demander un réexamen. Seule la décision Google confirme l'approbation. Faire compléter le profil de paiement directement dans le compte, sans recueillir ces données dans le projet.
2. Créer une unité dédiée à BRAIZ et reporter son identifiant réel ; confirmer aussi la nouvelle détection d'ads.txt. Aucun ID d'emplacement n'a été inventé dans la configuration de production.
3. Choisir/configurer une CMP adaptée au trafic et vérifier le parcours réel de consentement et de retrait. Brancher son état vivant vers `AdEligibility`; les appels existants restent volontairement fermés tant que cette intégration n'existe pas.
4. Après validation, passer l'état réel de partie terminée et la politique de fréquence au composant. Aucun écran de jeu en cours n'est éligible par défaut.
5. Vérifier sur le domaine avec une annonce réelle : taille/réservation d'espace, refus, retrait, adblock, navigation et absence de requête avant consentement. Le contrôle de disposition sur une vraie création publicitaire reste à faire; les tests locaux ne certifient pas son rendu.
6. Mettre à jour la confidentialité selon le traitement effectivement activé. Les coordonnées éditeur n'ont pas été inventées : l'instruction utilisateur de les laisser en attente est conservée.

Retirer une unité déjà demandée ne désinstalle pas le script tiers chargé. L'intégration CMP finale doit gérer l'arrêt du fournisseur après retrait, et si nécessaire recharger le document dans l'état refusé. Le seul adaptateur d'unité ne prétend pas fournir cette capacité globale.

## Sources officielles consultées

- [Code des unités asynchrones AdSense](https://support.google.com/adsense/answer/9183243?hl=en) : chargement asynchrone, unité `adsbygoogle`, client et slot.
- [Exigences Google de gestion du consentement](https://support.google.com/adsense/answer/13554116?hl=en) : CMP certifiée et cadre TCF pour les régions concernées. La vérification de conformité de l'intégration réelle reste distincte de l'existence d'un adaptateur.

Tests : `node work/run-duel-tests.mjs advertising adsense-adapter`. Le code ne peut pas conclure « AdSense prêt à diffuser » en l'absence des validations et identifiants réels ci-dessus.

Le [registre de revue](CONTINUOUS-REVIEW.md) distingue les contrôles achevés des prérequis encore ouverts.
