import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const origin=process.argv[2]??'http://127.0.0.1:5186';
const canonicalOrigin='https://braiz.io';
const paths=['/','/jeu-de-mots-semantique','/comment-jouer','/proximite','/partie-libre','/archives','/duels','/a-propos','/confidentialite'];
const privatePaths=['/studio','/streamer','/laboratoire','/laboratoire/deux-braises','/cercles','/integration','/espace','/embed','/entrainement','/observatoire'];
const titles=new Set();
const report={origin,checkedAt:new Date().toISOString(),pages:[],files:[],privatePages:[],discovery:{},notFound:null};
const links=new Map();
function attributes(tag) {return Object.fromEntries([...tag.matchAll(/([:\w-]+)=["']([^"']*)["']/g)].map(match=>[match[1],match[2]]));}
function metas(html) {return [...html.matchAll(/<meta\b[^>]*>/g)].map(match=>attributes(match[0]));}
async function fetchChecked(path) {
  const response=await fetch(origin+path,{signal:AbortSignal.timeout(45000)});
  assert.equal(response.status,200,path+' HTTP status');
  return {response,body:await response.text()};
}
for(const path of paths) {
  const {response,body}=await fetchChecked(path);
  assert.match(response.headers.get('content-type')??'',/text\/html/,path);
  const title=body.match(/<title>([^<]+)<\/title>/)?.[1];
  assert(title&&title.length>10,path+' title');assert(!titles.has(title),path+' duplicate title');titles.add(title);
  const canonical=[...body.matchAll(/<link\b[^>]*>/g)].map(match=>attributes(match[0])).filter(link=>link.rel==='canonical');
  assert.equal(canonical.length,1,path+' canonical count');assert.equal(canonical[0].href,canonicalOrigin+path,path+' canonical');
  const tags=metas(body);
  const meta=name=>tags.find(tag=>tag.name===name||tag.property===name)?.content;
  assert(meta('description')?.length>60,path+' description');
  assert(!/noindex/.test(meta('robots')??''),path+' must be indexable');
  assert.equal(meta('og:url'),canonicalOrigin+path,path+' OG URL');
  assert.equal(meta('og:image'),canonicalOrigin+'/social-card.png',path+' OG image');
  assert.equal(meta('twitter:card'),'summary_large_image',path+' Twitter card');
  assert.equal(meta('google-adsense-account'),'ca-pub-6705187262207125',path+' publisher');
  assert.doesNotMatch(body,/<script[^>]+src=["'][^"']*(?:googlesyndication|doubleclick)/i,path+' inactive advertising');
  const schemas=[...body.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match=>JSON.parse(match[1]));
  assert(schemas.length>0,path+' JSON-LD');
  assert.equal((body.match(/<h1\b/g)??[]).length,1,path+' H1 count');
  const document=body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  const targets=[...document.matchAll(/<a\b[^>]*>/g)].map(match=>attributes(match[0]).href).filter(Boolean)
    .map(href=>new URL(href,canonicalOrigin+path)).filter(url=>url.origin===canonicalOrigin&&paths.includes(url.pathname)).map(url=>url.pathname);
  links.set(path,[...new Set(targets)]);
  if(path==='/') {
    assert(schemas.some(schema=>schema['@type']==='WebSite'));
    assert(schemas.some(schema=>schema['@type']==='WebApplication'));
  } else {
    assert(body.includes('Questions fréquentes'),path+' visible FAQ');
    assert(schemas.some(schema=>schema['@type']==='BreadcrumbList'),path+' breadcrumb schema');
  }
  report.pages.push({path,status:response.status,title,canonical:canonical[0].href,schemas:schemas.map(schema=>schema['@type'])});
}
// Follow real server-rendered links: a guide can be discovered through the rules
// page without expanding the deliberately compact game footer.
const discovered=new Map([['/',0]]),pending=['/'];
for(const path of pending)for(const target of links.get(path)??[])if(!discovered.has(target)){
  discovered.set(target,discovered.get(path)+1);pending.push(target);
}
for(const path of paths)assert(discovered.has(path),path+' discoverable through public HTML links');
report.discovery=Object.fromEntries(discovered);
const sitemap=(await fetchChecked('/sitemap.xml')).body;
const locations=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]).sort();
assert.deepEqual(locations,paths.map(path=>canonicalOrigin+path).sort(),'sitemap public coverage');
const robots=(await fetchChecked('/robots.txt')).body;
assert.match(robots,/User-agent: \*\s+Allow: \//);assert.match(robots,/Disallow: \/api\//);assert.match(robots,/Sitemap: https:\/\/braiz.io\/sitemap.xml/);
const llms=(await fetchChecked('/llms.txt')).body;
for(const path of paths.filter(path=>path!=='/'))assert(llms.includes(canonicalOrigin+path),'llms public coverage '+path);
assert.equal((await fetchChecked('/ads.txt')).body.trim(),'google.com, pub-6705187262207125, DIRECT, f08c47fec0942fa0');
const card=await fetch(origin+'/social-card.png');assert.equal(card.status,200);assert.match(card.headers.get('content-type')??'',/image\/png/);
const image=Buffer.from(await card.arrayBuffer());assert.equal(image.readUInt32BE(16),1200);assert.equal(image.readUInt32BE(20),630);
report.files=['sitemap.xml','robots.txt','llms.txt','ads.txt','social-card.png'];
for(const path of privatePaths) {
  const {body}=await fetchChecked(path);
  assert(metas(body).some(tag=>tag.name==='robots'&&/noindex/.test(tag.content)),path+' noindex');
  assert(!locations.includes(canonicalOrigin+path),path+' excluded from sitemap');
  report.privatePages.push({path,noindex:true});
}
const missing=await fetch(origin+'/page-inexistante-verification-seo',{redirect:'manual'});
assert.equal(missing.status,404,'unknown URL must not be soft 404');report.notFound=404;
if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
