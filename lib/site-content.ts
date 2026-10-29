export type Guide = {
  path: string; title: string; heading: string; description: string; intro: string;
  action?: { href: string; label: string };
  sections: { heading: string; paragraphs: string[] }[];
  faq: { question: string; answer: string }[];
};

// Public documentation only: no target words, saved games or private identities.
export const GUIDES: Guide[] = [
  {
    path: '/jeu-de-mots-semantique', title: 'Jeu de mots sémantique en français : le guide',
    heading: 'Qu’est-ce qu’un jeu de mots sémantique ?',
    description: 'Découvrez le principe des jeux de mots sémantiques : trouver un mot secret grâce à la proximité de sens, puis essayer BRAIZ gratuitement.',
    intro: 'Un jeu de mots sémantique consiste à trouver un mot secret en proposant des mots proches par le sens. BRAIZ permet de jouer en français avec un mot du jour commun à tous, des parties libres et des duels.',
    action: { href: '/', label: 'Essayer le mot du jour' },
    sections: [
      { heading: 'Chercher une idée plutôt qu’une orthographe', paragraphs: ['Chaque proposition reçoit un classement de proximité avec le mot recherché. Deux mots peuvent se ressembler à l’écrit sans être proches dans ce classement ; à l’inverse, des mots très différents peuvent appartenir au même contexte.', 'Le défi consiste à explorer ces liens. Un objet peut évoquer un usage, un lieu, un métier ou une action. Proposer plusieurs familles d’idées aide à distinguer une piste prometteuse d’une simple association.'] },
      { heading: 'Comment BRAIZ représente la progression', paragraphs: ['La flamme et la barre se remplissent à partir du meilleur classement obtenu. Les repères Top 5 000, Top 1 000, Top 100 et Top 10 donnent une échelle commune, jusqu’au mot trouvé.', 'L’historique conserve les propositions et les classe du plus proche au moins proche. Un essai moins bien placé reste utile pour tester une hypothèse, sans faire reculer votre meilleure progression.'] },
      { heading: 'Choisir une façon de jouer', paragraphs: ['Le mot du jour convient au rendez-vous quotidien. La partie libre permet d’enchaîner des mots sans attendre le lendemain. Les archives donnent accès aux défis quotidiens passés. En duel, deux personnes jouent les mêmes trois manches, chacune à son rythme.'] },
      { heading: 'Les limites du classement', paragraphs: ['Le calcul utilise un modèle linguistique entraîné sur des textes. Il reflète des contextes d’usage, avec leurs ambiguïtés, et ne constitue pas un dictionnaire parfait des synonymes.', 'Un lien inattendu peut venir d’un sens secondaire ou d’une expression fréquente. Les règles et les données peuvent aussi varier entre éditions : les anciens défis conservent leur moteur historique.'] },
    ],
    faq: [
      { question: 'Faut-il connaître des mots rares ?', answer: 'Vous pouvez commencer avec des mots courants. Essayez des noms, des verbes ou des adjectifs de plusieurs domaines avant de préciser une piste.' },
      { question: 'BRAIZ est-il gratuit ?', answer: 'Le mot du jour et les parties libres sont accessibles gratuitement depuis le navigateur.' },
      { question: 'Peut-on jouer sur téléphone ?', answer: 'Oui. Le jeu fonctionne dans le navigateur sur téléphone comme sur ordinateur, sans installation obligatoire.' },
    ],
  },
  {
    path: '/comment-jouer', title: 'Comment jouer à BRAIZ : règles et indices', heading: 'Comment jouer à BRAIZ',
    description: 'Les règles de BRAIZ : envoyer un mot français, suivre la flamme, comparer les essais et utiliser jusqu’à trois indices pour trouver le mot secret.',
    intro: 'Dans BRAIZ, trouvez le mot secret en envoyant des mots français. La flamme conserve votre meilleure progression et l’historique classe les essais du plus proche au moins proche.',
    action: { href: '/', label: 'Jouer au mot du jour' },
    sections: [
      { heading: 'Envoyer un mot', paragraphs: ['Saisissez votre proposition dans le champ « Mot », puis choisissez « Envoyer » ou appuyez sur Entrée. Commencez par un nom, un adjectif ou un verbe à l’infinitif.', 'Un mot accepté rejoint l’historique avec son classement. Si le lexique ne reconnaît pas une proposition, elle ne devient pas un essai accepté : vous pouvez la corriger dans le champ.'] },
      { heading: 'Comparer les essais', paragraphs: ['Le mot le mieux placé reste en haut de la liste. Un classement plus petit indique une proposition plus proche ; le rang 1 correspond au mot secret.', 'La flamme suit votre meilleur essai. Vous pouvez donc essayer une autre piste sans perdre la progression déjà atteinte. Les essais sont illimités dans les parties classiques.'] },
      { heading: 'Utiliser les trois indices', paragraphs: ['Une partie classique propose au maximum trois indices. Chacun ajoute un mot encore inutilisé et modérément mieux placé que votre meilleur essai : le gain dépend de votre rang actuel, sans vous propulser directement parmi les tout premiers. Un indice ne révèle pas la réponse.', 'L’indice apparaît dans les essais et son utilisation est conservée dans la partie. Lorsqu’il ne reste que le mot secret devant votre meilleur essai, aucun nouvel indice n’est proposé. Le duel se joue sans indice.'] },
      { heading: 'Retrouver une partie', paragraphs: ['Les parties personnelles se sauvegardent dans le navigateur. Revenir sur le même appareil permet de reprendre les essais déjà acceptés. Effacer les données du site peut supprimer cette progression.', 'Une synchronisation facultative est disponible dans le profil. Elle demande une confirmation avant de transférer les données.'] },
    ],
    faq: [
      { question: 'Y a-t-il un nombre d’essais maximal ?', answer: 'Les parties classiques ont des essais illimités. En duel, chaque personne dispose de 30 essais par manche.' },
      { question: 'Pourquoi ma flamme ne redescend-elle pas ?', answer: 'Elle conserve le meilleur résultat de la partie. Un nouvel essai moins proche ne remplace pas ce meilleur résultat.' },
      { question: 'Les indices sont-ils obligatoires ?', answer: 'Non. Vous pouvez résoudre une partie sans utiliser d’indice.' },
    ],
  },
  {
    path: '/proximite', title: 'Proximité, pourcentage et classement dans BRAIZ', heading: 'Comprendre la proximité dans BRAIZ',
    description: 'À quoi correspondent la flamme, le pourcentage et les rangs de BRAIZ ? Comprenez les repères Top 5 000, Top 1 000, Top 100 et Top 10.',
    intro: 'Dans BRAIZ, le classement indique la place d’un mot par rapport au mot secret. Le pourcentage représente le remplissage de la flamme à partir du meilleur classement de la partie.',
    sections: [
      { heading: 'Deux lectures du même progrès', paragraphs: ['L’historique donne le classement exact de chaque essai. La flamme en propose une lecture visuelle : elle monte lorsqu’un nouveau mot dépasse votre meilleur essai.', 'L’échelle réserve de la place aux derniers progrès. Ses repères sont : Top 5 000 à 20 %, Top 1 000 à 40 %, Top 100 à 60 %, Top 10 à 80 %, puis 100 % lorsque le mot est trouvé. Entre ces repères, le remplissage avance progressivement.'] },
      { heading: 'Et avant le Top 5 000 ?', paragraphs: ['La progression commence aussi pour les mots situés au-delà du Top 5 000. Leur remplissage se situe dans la première partie de la jauge, en fonction de leur rang et de la taille du lexique de l’édition.', 'Le pourcentage est un repère de progression, pas une probabilité de gagner ni la proportion de mots éliminés. Les arrondis peuvent donner le même pourcentage à deux rangs différents : l’historique garde leur classement exact.'] },
      { heading: 'Pourquoi certaines associations surprennent', paragraphs: ['Le modèle rapproche des mots employés dans des contextes comparables dans ses textes d’entraînement. Il ne se limite pas aux synonymes : objets, actions, lieux et expressions peuvent se croiser.', 'Un mot possède parfois plusieurs sens. Une association qui semble évidente pour une personne peut être moins représentée dans les textes du modèle. Le classement est un résultat du calcul, pas un jugement sur votre raisonnement.'] },
      { heading: 'Comparer des pistes', paragraphs: ['Quand plusieurs mots d’un domaine restent éloignés, essayez un autre contexte. Si un mot progresse nettement, testez ensuite des actions, des objets ou des lieux liés à cette idée.', 'Les archives et les duels peuvent conserver une édition historique du modèle. Les rangs sont cohérents à l’intérieur d’une partie ; comparer des pourcentages entre deux mots secrets ne mesure pas leur difficulté de façon absolue.'] },
    ],
    faq: [
      { question: 'Que signifie Top 100 ?', answer: 'Votre mot fait partie des 100 mots les mieux classés pour le mot secret de cette partie. Un rang plus petit est meilleur.' },
      { question: 'Pourquoi ne suis-je pas à 100 % avec un mot presque trouvé ?', answer: 'Le jeu réserve 100 % à la réponse exacte. Même le deuxième mot le mieux classé reste sous ce seuil.' },
      { question: 'Un synonyme doit-il toujours être premier ?', answer: 'Non. Seul le mot secret occupe le rang 1 ; les autres mots suivent les similarités calculées par le modèle de l’édition.' },
    ],
  },
  {
    path: '/partie-libre', title: 'Partie libre : jouer à BRAIZ sans attendre', heading: 'Jouer une partie libre',
    description: 'Lancez une partie libre de BRAIZ : un nouveau mot secret en français, des essais illimités et trois indices, sans attendre le prochain mot du jour.',
    intro: 'La partie libre permet de chercher un nouveau mot secret quand vous le souhaitez. Elle reprend la flamme, les classements et les trois indices des parties classiques, avec des essais illimités.',
    action: { href: '/?mode=free', label: 'Lancer une partie libre' },
    sections: [
      { heading: 'Continuer après le mot du jour', paragraphs: ['Le défi quotidien donne le même mot à tous les joueurs. Une partie libre est indépendante de ce rendez-vous : vous pouvez en lancer une sans attendre le lendemain.', 'Le jeu reste identique : envoyez un mot, observez sa proximité et suivez les meilleures pistes dans l’historique. Il n’y a pas de limite de temps imposée.'] },
      { heading: 'Une progression séparée', paragraphs: ['La partie libre ne remplace pas les essais de votre mot du jour. Les parties personnelles se conservent dans le navigateur utilisé pour jouer.', 'Terminer une partie libre ne valide pas rétroactivement un défi quotidien. Pour retrouver un mot d’une date passée, utilisez plutôt les archives.'] },
      { heading: 'Trois indices pour débloquer une piste', paragraphs: ['Vous pouvez demander jusqu’à trois mots mieux placés que votre meilleur essai. Chaque indice utilisé est conservé avec la partie.', 'Pour une confrontation à deux, le duel utilise des règles distinctes : trois manches, 30 essais par manche et aucun indice.'] },
    ],
    faq: [
      { question: 'Dois-je finir le mot du jour avant de jouer en libre ?', answer: 'Non. La partie libre est accessible depuis le menu, indépendamment de votre progression quotidienne.' },
      { question: 'Faut-il attendre entre deux parties libres ?', answer: 'Non. Ce mode permet de poursuivre le jeu sans attendre le renouvellement du défi quotidien.' },
      { question: 'Est-ce un entraînement hors connexion ?', answer: 'Non. Les parties libres utilisent le service en ligne. Le pack d’entraînement téléchargeable est un mode distinct avec ses propres parcours.' },
    ],
  },
  {
    path: '/archives', title: 'Archives BRAIZ : rejouer les mots des jours précédents', heading: 'Retrouver les mots des jours précédents',
    description: 'Choisissez une date passée dans les archives BRAIZ et jouez son mot secret avec votre progression sauvegardée, indépendamment du défi du jour.',
    intro: 'Les archives permettent de jouer les défis quotidiens des dates passées disponibles dans BRAIZ. Choisissez une date dans le calendrier pour ouvrir sa partie et retrouver vos essais déjà enregistrés.',
    action: { href: '/?surface=archives', label: 'Ouvrir le calendrier' },
    sections: [
      { heading: 'Choisir une date passée', paragraphs: ['Le calendrier rassemble les défis archivés accessibles. Il sert à retrouver une partie interrompue ou à découvrir un jour auquel vous n’aviez pas joué.', 'Une archive garde le mot et l’édition associés à sa date. Les règles de calcul d’une ancienne édition peuvent donc différer de celles du mot du jour actuel.'] },
      { heading: 'Jouer sans révéler la réponse', paragraphs: ['Ouvrir une archive ne dévoile pas son mot secret. Vous retrouvez la même recherche par propositions, avec la flamme de progression et l’historique des essais.', 'Vos essais d’archive restent séparés de la partie quotidienne actuelle. Une archive terminée ne prolonge pas rétroactivement votre série du jour.'] },
      { heading: 'Reprendre sur le même navigateur', paragraphs: ['La sauvegarde locale permet de retrouver la progression déjà enregistrée pour une date. Si vous effacez les données du site, cette sauvegarde peut disparaître.', 'Le profil propose des fonctions facultatives de transfert et de synchronisation. Consultez les informations de confidentialité avant de transférer vos données vers un autre appareil.'] },
    ],
    faq: [
      { question: 'Peut-on ouvrir un mot d’une date future ?', answer: 'Non. Les archives donnent accès aux dates passées disponibles, pas aux futurs mots secrets.' },
      { question: 'Le jeu montre-t-il les solutions dans le calendrier ?', answer: 'Non. Le calendrier ouvre les parties sans publier leur réponse à l’avance.' },
      { question: 'Une archive compte-t-elle pour la série quotidienne ?', answer: 'Elle conserve sa propre progression, mais ne répare pas rétroactivement une journée manquée de la série quotidienne.' },
    ],
  },
  {
    path: '/a-propos', title: 'À propos de BRAIZ : jeu, modèles et données', heading: 'À propos de BRAIZ',
    description: 'BRAIZ est un jeu de mots sémantique gratuit en français. Découvrez ses modes, les sources linguistiques et les limites du calcul de proximité.',
    intro: 'BRAIZ est un jeu de mots sémantique gratuit, jouable en français dans un navigateur. Il propose un défi quotidien, des parties libres, des archives et un duel à deux.',
    sections: [
      { heading: 'Un classement issu d’un modèle linguistique', paragraphs: ['La recherche du mot secret repose sur des représentations numériques de mots apprises à partir de textes. Pour une partie donnée, le modèle classe les propositions selon leur similarité avec la cible.', 'BRAIZ n’ajoute pas une sélection manuelle de voisins destinée à favoriser une piste particulière. Le modèle peut cependant produire des rapprochements ambigus ou peu intuitifs.'] },
      { heading: 'Sources et licences', paragraphs: ['L’édition Word2Vec utilise les données françaises frWaC publiées par Jean-Philippe Fauconnier, sous licence Creative Commons Attribution 3.0. Le modèle source comporte des représentations de 500 dimensions ; le lexique de cette édition du jeu contient 155 562 entrées.', 'Les éditions historiques conservent leurs données fastText françaises et leur licence Creative Commons Attribution – Partage dans les mêmes conditions 3.0. Ces éditions restent lisibles afin de préserver les anciennes parties.'] },
      { heading: 'Plusieurs façons de continuer', paragraphs: ['Le mot du jour est partagé par tous. Le mode libre permet de poursuivre à son rythme ; les archives rouvrent les défis passés. Le duel confronte deux personnes sur les mêmes trois mots, sans exiger de jouer simultanément.', 'Les règles détaillent l’usage des indices et la page Proximité explique les repères de la flamme. Aucune page de ce guide ne dévoile le mot quotidien ni les mots d’une partie privée.'] },
    ],
    faq: [
      { question: 'BRAIZ est-il Cémantix ?', answer: 'Non. BRAIZ est un jeu distinct. Il appartient à la même famille des jeux de recherche de mots par proximité de sens.' },
      { question: 'Le calcul comprend-il tous les sens d’un mot ?', answer: 'Il reflète les usages présents dans les textes du modèle. Une ambiguïté, un sens rare ou une expression peuvent produire un classement surprenant.' },
    ],
  },
  {
    path: '/confidentialite', title: 'Confidentialité et données personnelles', heading: 'Confidentialité',
    description: 'Informations sur les sauvegardes BRAIZ, la synchronisation facultative, la mesure volontaire sans mots saisis et la publicité actuellement inactive.',
    intro: 'BRAIZ conserve la progression personnelle dans le navigateur et envoie les propositions des modes connectés au serveur pour calculer leur proximité. La synchronisation du profil est facultative et demande une confirmation.',
    sections: [
      { heading: 'Sauvegarde sur votre appareil', paragraphs: ['Les essais, victoires, préférences et faits de progression des modes personnels sont enregistrés dans le navigateur utilisé. Les onglets du même navigateur partagent cette progression. Effacer les données du site efface aussi les sauvegardes locales et leurs copies de secours.', 'L’export de profil contient les faits personnels validés, dont les mots associés aux essais du profil. Il ne contient pas les parties classiques en cours. L’import présente un aperçu et demande une confirmation avant d’écrire.'] },
      { heading: 'Calcul en ligne et parties partagées', paragraphs: ['Dans les modes connectés, les mots proposés sont transmis au serveur pour calculer leur proximité. Les parties partagées, dont les duels, utilisent aussi une identité et des résultats enregistrés côté serveur.', 'Le pseudonyme choisi pour un duel et les informations nécessaires à son déroulement sont visibles par l’autre participant. Les mots d’une manche sont révélés aux deux participants lorsque leurs deux recherches sont closes ou lorsque le duel est terminé. Un lien d’invitation doit être partagé uniquement avec la personne souhaitée.', 'L’hébergeur peut traiter les journaux techniques nécessaires au fonctionnement du service. Le pack d’entraînement téléchargé calcule ses parcours finis sur votre appareil, avec une progression séparée.'] },
      { heading: 'Synchronisation facultative', paragraphs: ['Une synchronisation explicitement confirmée peut envoyer au serveur une copie du profil et des parties classiques en cours, avec leurs mots, scores, indices et contextes sauvegardés. Elle n’est pas chiffrée de bout en bout.', 'La suppression d’une copie distante se confirme dans le profil. Effacer seulement les données du navigateur ne constitue pas une demande de suppression de cette copie distante.'] },
      { heading: 'Mesure volontaire', paragraphs: ['La mesure est désactivée par défaut. Dans les préférences du profil, vous pouvez autoriser BRAIZ à compter les actions réalisées ensuite : ouverture et reprise de partie, essais acceptés ou refusés, indices, victoires, partage, duels et erreurs réseau. Aucun historique antérieur n’est envoyé. La mesure n’envoie ni mots, solutions, scores, pseudonymes, identifiants de compte, liens privés, adresse de la page ou site d’origine.', 'Un identifiant aléatoire propre à ce navigateur est créé uniquement après votre choix. Son empreinte est conservée côté serveur avec le type d’action, le mode et la date de réception. Cet identifiant est distinct des comptes et des sauvegardes. Aucun prestataire de mesure tiers n’est utilisé. Le tableau opérateur présente uniquement des agrégats de navigateurs volontaires, pas la fréquentation totale du site.', 'L’autorisation expire après 35 jours et doit être renouvelée volontairement. Les données expirées sont exclues des résultats et supprimées lors de la prochaine requête au service de mesure. Le retrait de l’autorisation arrête immédiatement les envois et demande la suppression des données associées. Si la connexion manque, la demande reste en attente et sa confirmation est affichée dans les préférences. Effacer le stockage du navigateur avant cette confirmation empêche cette relance ; les données restantes expirent au plus tard à la fin de leur période de 35 jours.', 'Les journaux de diagnostic conservés localement restent distincts de cette mesure. Leur export nécessite votre action et n’est pas transmis automatiquement.'] },
      { heading: 'Publicité', paragraphs: ['Aucune demande d’annonce ni aucun emplacement publicitaire n’est activé actuellement. Une balise de vérification du compte AdSense et un fichier ads.txt identifient l’éditeur publicitaire ; ils ne chargent pas le programme de diffusion d’annonces.', 'L’activation d’annonces nécessitera une configuration effective du service et du consentement applicable. Cette page devra être mise à jour pour décrire le fonctionnement réellement activé.'] },
      { heading: 'Hors connexion', paragraphs: ['Un écran de secours neutre est mis en cache. Un pack d’entraînement fini et vérifié peut aussi être téléchargé volontairement, avec son interface, son lexique et ses parcours.', 'Les pages quotidiennes et privées nécessitent une connexion. Le service hors connexion ne met pas en cache ces pages avec vos propositions ou résultats.'] },
    ],
    faq: [
      { question: 'Ma progression apparaît-elle automatiquement sur un autre appareil ?', answer: 'Non. Les données personnelles restent locales tant que vous n’utilisez pas volontairement les fonctions de transfert ou de synchronisation.' },
      { question: 'Effacer le navigateur supprime-t-il une copie synchronisée ?', answer: 'Non. La suppression de la copie distante doit être demandée et confirmée dans le profil.' },
    ],
  },
];

export const DUEL_GUIDE = {
  heading: 'Le duel de mots, à votre rythme',
  intro: 'Deux personnes cherchent les mêmes trois mots secrets dans BRAIZ. Chacune dispose de 30 essais par manche, sans indice, et joue à son rythme pendant les 48 heures qui suivent l’acceptation.',
  faq: [
    { question: 'Comment inviter une personne ?', answer: 'Créez un duel avec votre pseudonyme, puis copiez son lien d’invitation et transmettez-le à votre adversaire. La partie démarre après son acceptation.' },
    { question: 'Faut-il être connecté en même temps ?', answer: 'Non. Le duel est asynchrone : chacun peut jouer ses manches pendant la période de 48 heures.' },
    { question: 'Comment une manche est-elle départagée ?', answer: 'Trouver le mot l’emporte. Si les deux personnes le trouvent, le nombre d’essais décide ; sinon, le meilleur classement décide. Une égalité reste une égalité.' },
    { question: 'Voit-on les mots de l’adversaire ?', answer: 'Pendant une manche encore jouable, vous voyez sa progression sans ses mots. Dès que les deux recherches sont closes, vous pouvez consulter ses essais et la solution. À la fin du duel, toutes les manches sont consultables.' },
  ],
};
