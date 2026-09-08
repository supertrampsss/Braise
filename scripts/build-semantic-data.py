import urllib.request, re, json, base64, hashlib, pathlib, unicodedata
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[1] / 'work' / 'semantic'
ROOT.mkdir(parents=True, exist_ok=True)
OUTPUT=pathlib.Path(__file__).resolve().parents[1] / 'data' / 'semantic-fr.json'
URL='https://dl.fbaipublicfiles.com/fasttext/vectors-wiki/wiki.fr.vec'
GROUPS={
'Animal':'chat chien cheval lapin souris renard loup ours lion tigre singe éléphant girafe zèbre mouton chèvre vache cochon poule canard aigle hibou pigeon poisson dauphin baleine requin tortue serpent grenouille abeille fourmi papillon araignée escargot',
'Nature et paysage':'forêt arbre fleur feuille racine branche herbe prairie montagne colline vallée rivière fleuve lac mer océan plage île désert volcan roche sable terre neige pluie vent nuage soleil lune étoile ciel orage éclair glace printemps automne hiver été',
'Objet du quotidien':'table chaise fauteuil lit armoire miroir lampe bougie horloge montre téléphone ordinateur clavier écran livre cahier crayon stylo pinceau ciseaux marteau tournevis clé serrure porte fenêtre rideau tapis coussin assiette verre tasse bouteille fourchette cuillère couteau casserole panier sac valise parapluie chaussure chemise pantalon chapeau lunettes vélo voiture train bateau avion guitare piano tambour appareil appareil-photo',
'Alimentation':'pain fromage beurre lait yaourt pomme poire pêche abricot cerise fraise framboise orange citron banane raisin melon tomate carotte salade pomme-de-terre courgette aubergine soupe gâteau chocolat miel sucre sel poivre café thé riz pâtes farine œuf',
'Lieu':'maison école bibliothèque musée cinéma théâtre hôpital marché restaurant boulangerie jardin parc village ville gare aéroport port pont route chemin rue place ferme château palais plage cuisine chambre salon atelier bureau magasin stade piscine',
'Émotion et vie intérieure':'joie bonheur tristesse peur colère surprise confiance patience courage espoir amour amitié tendresse plaisir nostalgie curiosité fierté calme rêve souvenir imagination humour sourire',
'Action':'marcher courir sauter nager voler danser chanter jouer rire sourire dormir rêver manger boire cuisiner lire écrire dessiner peindre construire réparer ouvrir fermer chercher trouver regarder écouter parler raconter apprendre comprendre choisir partager offrir voyager explorer planter cueillir',
}
cache=ROOT/'vectors.npz'
if not cache.exists():
 words=[]; vectors=[]; seen=set()
 with urllib.request.urlopen(URL,timeout=120) as r:
  header=r.readline().decode().strip(); print('HEADER',header,flush=True)
  for row in range(50000):
   line=r.readline().decode('utf-8'); token,_,v=line.partition(' ')
   word=unicodedata.normalize('NFC',token.lower())
   if not re.fullmatch(r'[a-zàâäçéèêëîïôöùûüÿœæ]+(?:-[a-zàâäçéèêëîïôöùûüÿœæ]+)*',word) or len(word)<2 or word in seen: continue
   values=np.fromstring(v,sep=' ',dtype=np.float32)
   if len(values)!=300: continue
   seen.add(word);words.append(word);vectors.append(values)
   if row%10000==0: print('ROWS',row,flush=True)
 matrix=np.array(vectors);matrix/=np.linalg.norm(matrix,axis=1,keepdims=True)
 np.savez_compressed(cache,words=np.array(words),vectors=matrix)
else:
 z=np.load(cache); words=z['words'].tolist();matrix=z['vectors']
words=words[:30000];matrix=matrix[:30000]
idx={w:i for i,w in enumerate(words)}
pool={}
for category,items in GROUPS.items():
 for w in items.split():
  if w in idx and w not in pool: pool[w]=category
# Fixed deterministic order, independent of Python hash seeds.
selected=sorted(pool,key=lambda w: hashlib.sha256(('braise-v1:'+w).encode()).hexdigest())[:120]
targets=[]
for w in selected:
 scores=np.clip(np.rint(matrix@matrix[idx[w]]*10000),-10000,10000).astype('<i2'); scores[idx[w]]=10000
 # Association selected from curated common words, avoiding trivial shared stems.
 candidates=[v for v in pool if v!=w and not (v.startswith(w[:4]) or w.startswith(v[:4]))]
 association=max(candidates,key=lambda v:(int(scores[idx[v]]),v))
 targets.append({'word':w,'category':pool[w],'hints':[f'Univers : {pool[w].lower()}.',f'Une association proche : {association}.',f'Le mot commence par « {w[:2]} ».'],'association':association,'scores':base64.b64encode(scores.tobytes()).decode()})
meta={'version':1,'model':'fastText wiki.fr, skip-gram, 300 dimensions','source':URL,'sourcePage':'https://fasttext.cc/docs/en/pretrained-vectors.html','license':'CC BY-SA 3.0','licenseUrl':'https://creativecommons.org/licenses/by-sa/3.0/','attribution':'Piotr Bojanowski, Edouard Grave, Armand Joulin, Tomas Mikolov; fastText / Facebook. Enriching Word Vectors with Subword Information (2017).','modifications':'First 50,000 vocabulary rows; retain first 30,000 filtered entries; French-character filtering, NFC lowercase, deduplication, unit normalization, cosine similarity quantized to signed int16 × 10000. Curated target pool; deterministic SHA-256 order.','encoding':'Each target.scores is base64 of little-endian signed int16, dictionary order. Divide by 10000 for cosine.','dimensions':300,'sourceRows':50000,'dictionarySize':len(words),'targetCount':len(targets)}
data={'meta':meta,'words':words,'puzzles':targets}
p=OUTPUT;p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
examples=[]
for a,b,c in [('chat','chien','marteau'),('forêt','arbre','ordinateur'),('mer','océan','fromage'),('joie','bonheur','chaise')]:
 vals={v:round(float(matrix[idx[a]]@matrix[idx[v]]),4) if v in idx else None for v in (b,c)}
 examples.append({'target':a,'cosines':vals})
report={'bytes':p.stat().st_size,'dictionarySize':len(words),'targetCount':len(targets),'examples':examples,'missingCandidateWords':[w for items in GROUPS.values() for w in items.split() if w not in idx]}
(ROOT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
