import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Deterministic rasterization of the existing brand asset. No new artwork.
const source=await readFile(new URL('../public/favicon.svg',import.meta.url));
const output=new URL('../public/icons/',import.meta.url);
await mkdir(output,{recursive:true});
for(const size of [192,512]){
  await sharp(source).resize(size,size).flatten({background:'#151718'}).png().toFile(fileURLToPath(new URL(`icon-${size}.png`,output)));
}
for(const [name,size,inset] of [['maskable-512.png',512,64],['apple-touch-icon.png',180,8]]){
  const symbol=await sharp(source).resize(size-inset*2,size-inset*2).png().toBuffer();
  await sharp({create:{width:size,height:size,channels:4,background:'#151718'}}).composite([{input:symbol,left:inset,top:inset}]).png().toFile(fileURLToPath(new URL(name,output)));
}
