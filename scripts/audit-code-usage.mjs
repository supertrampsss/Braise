import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,relative,dirname,posix} from 'node:path';
import ts from 'typescript';

// Inventory only. This command never deletes files: framework entries, tests, CLI
// tools and dynamic imports must all be considered before a candidate is removed.
const root=process.cwd(),slash=value=>value.replaceAll('\\','/');
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(file=>/\.(?:[cm]?js|tsx?|css|py)$/.test(file)&&existsSync(file));
const known=new Set(files),edges=new Map(),packages=new Map(),exports=new Map(),consumed=new Map(),dynamic=[];
const options=ts.parseJsonConfigFileContent(ts.readConfigFile('tsconfig.json',ts.sys.readFile).config,ts.sys,root).options;
function target(from,specifier){
 const found=ts.resolveModuleName(specifier,resolve(from),options,ts.sys).resolvedModule?.resolvedFileName;
 if(found){const path=slash(relative(root,found));if(known.has(path))return path;}
 const base=specifier.startsWith('@/')?specifier.slice(2):specifier.startsWith('.')?slash(relative(root,resolve(dirname(from),specifier))):null;
 return base&&[base,...['.ts','.tsx','.mjs','.js','.css','/index.ts','/index.tsx'].map(extension=>base+extension)].find(path=>known.has(path));
}
function dependency(file,specifier,names=[]){
 const local=target(file,specifier);
 if(local){edges.get(file).add(local);if(!consumed.has(local))consumed.set(local,new Set());for(const name of names)consumed.get(local).add(name);}
 else if(!specifier.startsWith('.')&&!specifier.startsWith('@/')&&!specifier.startsWith('node:')){
  const name=specifier.startsWith('@')?specifier.split('/').slice(0,2).join('/'):specifier.split('/')[0];
  if(!packages.has(name))packages.set(name,new Set());packages.get(name).add(file);
 }
}
for(const file of files){
 edges.set(file,new Set());exports.set(file,new Set());const text=readFileSync(file,'utf8');
 // CLI scripts can read a TS resource as text instead of importing it (shader studies, fixtures).
 for(const match of text.matchAll(/["']((?:components|lib|hooks)\/[^"']+\.(?:tsx?|[cm]?js|css))["']/g))if(known.has(match[1]))edges.get(file).add(match[1]);
 if(file.endsWith('.py'))continue;
 if(file.endsWith('.css')){for(const match of text.matchAll(/@import\s+["']([^"']+)["']/g))dependency(file,match[1]);continue;}
 const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
 function visit(node){
  if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)){
   const clause=node.importClause,names=clause?.name?['default']:[];
   if(clause?.namedBindings){if(ts.isNamespaceImport(clause.namedBindings))names.push('*');else for(const item of clause.namedBindings.elements)names.push((item.propertyName??item.name).text);}
   dependency(file,node.moduleSpecifier.text,names);
  }
  if(ts.isExportDeclaration(node)){
   const names=node.exportClause&&ts.isNamedExports(node.exportClause)?node.exportClause.elements.map(item=>(item.propertyName??item.name).text):['*'];
   if(node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))dependency(file,node.moduleSpecifier.text,names);
   if(node.exportClause&&ts.isNamedExports(node.exportClause))for(const item of node.exportClause.elements)exports.get(file).add(item.name.text);
  }
  if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require')){
   const arg=node.arguments[0];if(arg&&ts.isStringLiteralLike(arg))dependency(file,arg.text,['*']);else dynamic.push({file,line:source.getLineAndCharacterOfPosition(node.pos).line+1});
  }
  if(ts.isImportTypeNode(node)&&ts.isLiteralTypeNode(node.argument)&&ts.isStringLiteral(node.argument.literal))dependency(file,node.argument.literal.text,['*']);
  const modifiers=ts.canHaveModifiers(node)?ts.getModifiers(node):undefined;
  if(modifiers?.some(mod=>mod.kind===ts.SyntaxKind.ExportKeyword)){
   if(modifiers.some(mod=>mod.kind===ts.SyntaxKind.DefaultKeyword))exports.get(file).add('default');
   else if(node.name&&ts.isIdentifier(node.name))exports.get(file).add(node.name.text);
   else if(ts.isVariableStatement(node))for(const item of node.declarationList.declarations)if(ts.isIdentifier(item.name))exports.get(file).add(item.name.text);
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
}
const framework=files.filter(file=>file.startsWith('app/')&&/^(page|layout|route|loading|error|not-found|global-error|template|default|sitemap|robots|manifest|icon|apple-icon|opengraph-image|twitter-image)\./.test(posix.basename(file))||file.startsWith('public/')||!file.includes('/'));
const tools=files.filter(file=>file.startsWith('scripts/')),tests=files.filter(file=>file.startsWith('tests/'));
function reachable(roots){const seen=new Set();function walk(file){if(seen.has(file))return;seen.add(file);for(const next of edges.get(file)??[])walk(next);}roots.forEach(walk);return seen;}
const runtime=reachable(framework),all=reachable([...framework,...tools,...tests]);
const candidates=files.filter(file=>/^(components|lib|hooks)\//.test(file)&&!all.has(file));
const sourceExports=files.filter(file=>/^(components|lib|hooks)\//.test(file)&&all.has(file)).flatMap(file=>[...exports.get(file)].filter(name=>!consumed.get(file)?.has(name)&&!consumed.get(file)?.has('*')).map(name=>({file,name})));
console.log(JSON.stringify({entryPoints:{framework,tools,tests:tests.length},summary:{files:files.length,runtime:runtime.size,reachableIncludingToolsAndTests:all.size,unreferencedCandidates:candidates.length},unreferencedCandidates:candidates,testOrToolOnly:files.filter(file=>/^(components|lib|hooks)\//.test(file)&&all.has(file)&&!runtime.has(file)),unreferencedExports:sourceExports,nonLiteralImports:dynamic,packageConsumers:Object.fromEntries([...packages].sort(([a],[b])=>a.localeCompare(b)).map(([name,consumers])=>[name,[...consumers]]))},null,2));
