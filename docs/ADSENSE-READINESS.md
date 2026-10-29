# Publicité : adaptateur prêt, diffusion inactive

État au 29 octobre 2026 : `AD_RUNTIME_CONFIG` reste `null`. Aucun appel au SDK AdSense, aucune demande d'annonce et aucun faux emplacement ne sont émis par les appels existants.

## Ce qui est implémenté

`lib/advertising.ts` décide explicitement de l'éligibilité. Un adaptateur AdSense réel dans `lib/adsense-adapter.ts` charge le SDK asynchrone et crée une unité responsive avec les attributs du fournisseur. `components/ad-placement.tsx` l'utilise seulement après passage de tous les contrôles.

Les contrôles cumulatifs sont : configuration AdSense valide, confirmation effective de validation du compte, identifiant réel de l'emplacement, intégration CMP prête, consentement publicitaire explicitement accordé, partie inactive et fréquence autorisée. Un état absent ou inconnu ferme le placement. Le consentement de mesure BRAIZ n'est jamais assimilé à un consentement publicitaire.

L'adaptateur partage un chargement du SDK par document, refuse un second éditeur concurrent, vérifie de nouveau l'éligibilité après chargement, limite à une demande d'annonce par document et ne rafraîchit pas automatiquement les annonces. Un abandon du composant ou retrait du consentement pendant le chargement empêche la demande d'annonce. Une erreur de script ou un bloqueur laisse le placement sans annonce. Les tests utilisent un faux DOM et des valeurs fictives isolées, sans aucune requête Google.

## Informations et intégration encore requises

1. Vérifier dans le compte AdSense la validation réelle du domaine et l'état de diffusion. La balise d'identification et `ads.txt` ne prouvent pas cette validation.
2. Créer les emplacements réels dans ce compte et reporter leurs identifiants. Aucun ID d'emplacement n'a été inventé dans la configuration de production.
3. Choisir/configurer une CMP adaptée au trafic et vérifier le parcours réel de consentement et de retrait. Brancher son état vivant vers `AdEligibility`; les appels existants restent volontairement fermés tant que cette intégration n'existe pas.
4. Après validation, passer l'état réel de partie terminée et la politique de fréquence au composant. Aucun écran de jeu en cours n'est éligible par défaut.
5. Vérifier sur le domaine avec une annonce réelle : taille/réservation d'espace, refus, retrait, adblock, navigation et absence de requête avant consentement. Le contrôle de disposition sur une vraie création publicitaire reste à faire; les tests locaux ne certifient pas son rendu.
6. Mettre à jour la confidentialité selon le traitement effectivement activé. Les coordonnées éditeur n'ont pas été inventées : l'instruction utilisateur de les laisser en attente est conservée.

Retirer une unité déjà demandée ne désinstalle pas le script tiers chargé. L'intégration CMP finale doit gérer l'arrêt du fournisseur après retrait, et si nécessaire recharger le document dans l'état refusé. Le seul adaptateur d'unité ne prétend pas fournir cette capacité globale.

## Sources officielles consultées

- [Code des unités asynchrones AdSense](https://support.google.com/adsense/answer/9183243?hl=en) : chargement asynchrone, unité `adsbygoogle`, client et slot.
- [Exigences Google de gestion du consentement](https://support.google.com/adsense/answer/13554116?hl=en) : CMP certifiée et cadre TCF pour les régions concernées. La vérification de conformité de l'intégration réelle reste distincte de l'existence d'un adaptateur.

Tests : `node work/run-duel-tests.mjs advertising adsense-adapter`. Le code ne peut pas conclure « AdSense prêt à diffuser » en l'absence des validations et identifiants réels ci-dessus.
