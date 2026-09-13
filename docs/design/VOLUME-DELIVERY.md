# Flamme volumétrique

Références d’Antoine : vidéos Overworld Audio et construction animée d’un univers 3D. Les maquettes continuent de fixer l’organisation du jeu ; les vidéos fixent la recherche de profondeur et de mouvement.

## Réalisation

La scène principale abandonne la déformation de l’image. Un shader échantillonne un champ de densité en trois dimensions sur 44 pas bornés par une boîte englobante. L’enveloppe effilée contient deux surfaces turbulentes et un cœur plus dense. L’émission et l’extinction s’accumulent progressivement. Une texture de bruit déterministe alimente le flux ascendant ; elle ne contient aucune donnée de jeu.

La caméra conserve la perspective au changement de dimensions et réagit au pointeur avec interpolation et angle limité à trois degrés. Des braises projetées dans le même espace et un reflet analytique au sol complètent la scène. Le score réel accepté pilote progressivement hauteur, émission, reflet et braises. La victoire utilise exclusivement le signal transitoire existant.

Rendu borné à 440 × 480 pixels et 30 images/s maximum demandé. Il ne s’agit pas d’une mesure de performance obtenue. Pause produit, réduction du mouvement et invisibilité suspendent la boucle. L’image précédente demeure le secours en cas d’absence de WebGL, erreur de shader, exception de rendu ou perte du contexte.

## Contrôles

TypeScript et build de production vérifiés. Revue indépendante Astra High : corrections du repli après exception et division à l’horizon intégrées.

Le script optionnel scripts/render-flame-study.py compile le shader de production et le rend avec EGL/llvmpipe, en adaptant uniquement les déclarations GLSL à OpenGL desktop. Les images idle, warm, hot et compact ont été inspectées et ont permis corriger une densité trop uniforme et un échantillonnage bruité. L’aperçu flame-volume-study.mp4 contient quatre secondes de cette étude isolée à chaleur illustrative constante ; ce n’est pas une capture du jeu, un résultat de partie ou un test iPhone.

Aucun nouveau test navigateur. WebGL reste indisponible dans le navigateur géré. Compatibilité WebGL sur appareils réels, fluidité et rendu Safari iPhone restent à qualifier. Cette étape ne constitue pas une certification du niveau de finition des références sur tous les écrans.

Aucune modification du moteur, corpus, sessions, parties ou sauvegardes. Ancien programme automatique toujours suspendu. Dépôt source Sites conservé ; aucun changement d’audience ni synchronisation GitHub dans cette passe.
