import ts from 'typescript';
import { resolve,join,relative,dirname,extname } from 'node:path';
import { safeFile,readBounded } from './safety.js';
import { hash } from './store.js';
const typedCache=new Map();
const normalize=path=>resolve(path).replaceAll('\\','/');
export async function typedContext(store,projectId,{symbol,file,limit=30}={}) {
 const project=store.project(projectId),rows=store.db.prepare("SELECT * FROM records WHERE project_id=? AND kind='code' AND status='observed' AND source_path IS NOT NULL ORDER BY source_path").all(projectId).filter(r=>/\.[cm]?[jt]sx?$/.test(r.source_path));
 const files=new Map(),warnings=[];let bytes=0;
 for(const row of rows){if(files.size>=1000||bytes>12_000_000){warnings.push({state:'LIMIT_REACHED'});break;}try{const checked=await safeFile(project.root,join(project.root,row.source_path),{maxBytes:100000});const content=await readBounded(checked.path,100000);if(hash(content)!==row.source_hash){warnings.push({path:row.source_path,state:'STALE'});continue;}files.set(normalize(join(project.root,row.source_path)),{...row,content});bytes+=Buffer.byteLength(content);}catch{warnings.push({path:row.source_path,state:'SOURCE_UNAVAILABLE'});}}
 const options={target:ts.ScriptTarget.Latest,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,allowJs:true,checkJs:true,noLib:true,noEmit:true,jsx:ts.JsxEmit.Preserve,skipLibCheck:true,baseUrl:project.root};
 const configRow=store.db.prepare("SELECT * FROM records WHERE project_id=? AND source_path='tsconfig.json' AND status='observed'").get(projectId);
 if(configRow)try{const current=await safeFile(project.root,join(project.root,'tsconfig.json'));const content=await readBounded(current.path);if(hash(content)!==configRow.source_hash)warnings.push({path:'tsconfig.json',state:'STALE'});else{const config=ts.parseConfigFileTextToJson('tsconfig.json',content);if(config.error)throw Error();const c=config.config.compilerOptions??{};if(c.paths&&typeof c.paths==='object')options.paths=c.paths;if(typeof c.baseUrl==='string')options.baseUrl=resolve(project.root,c.baseUrl);if(config.config.extends)warnings.push({path:'tsconfig.json',state:'EXTENDS_NOT_LOADED',note:'Somente opções locais indexadas; nenhuma configuração externa é executada/lida.'});}}catch{warnings.push({path:'tsconfig.json',state:'CONFIG_UNAVAILABLE'});}
 const cacheKey=hash(JSON.stringify([projectId,project.root,[...files].map(([p,r])=>[p,r.id,r.source_hash,r.content]),options,symbol,file,limit,warnings]));const previous=typedCache.get(cacheKey);if(previous)return{...structuredClone(previous),structural_cache_hit:true};
 const directories=new Set();for(const path of files.keys()){let dir=dirname(path);while(dir!==dirname(dir)){directories.add(normalize(dir));dir=dirname(dir);}}
 const host={getSourceFile:(path,language)=>{const row=files.get(normalize(path));return row?ts.createSourceFile(path,row.content,language,true):undefined;},getDefaultLibFileName:()=>'/__no_lib__.d.ts',writeFile:()=>{},getCurrentDirectory:()=>project.root,getDirectories:()=>[],fileExists:path=>files.has(normalize(path)),readFile:path=>files.get(normalize(path))?.content,directoryExists:path=>directories.has(normalize(path)),getCanonicalFileName:path=>normalize(path),useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n',realpath:path=>normalize(path)};
 const program=ts.createProgram([...files.keys()],options,host),checker=program.getTypeChecker(),definitions=[],calls=[],imports=[];
 const location=node=>{const tree=node.getSourceFile(),row=files.get(normalize(tree.fileName));return {record_id:row?.id,path:row?.source_path,line:tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1,source_hash:row?.source_hash,state:'SOURCE_CURRENT'};};
 function canonical(s){const seen=new Set();while(s&&(s.flags&ts.SymbolFlags.Alias)&&!seen.has(s)){seen.add(s);const next=checker.getAliasedSymbol(s);if(next===s)break;s=next;}return s;}
 function signature(node){try{if(ts.isFunctionLike(node)){const s=checker.getSignatureFromDeclaration(node);return s?checker.signatureToString(s):'';}return checker.typeToString(checker.getTypeAtLocation(node));}catch{return 'unresolved';}}
 function matches(name,path){return (!symbol||name===symbol||name.endsWith('.'+symbol))&&(!file||path===file);}
 const declarationNodes=[];
 for(const tree of program.getSourceFiles()){
  function walk(node){
   if((ts.isFunctionDeclaration(node)||ts.isClassDeclaration(node)||ts.isInterfaceDeclaration(node)||ts.isTypeAliasDeclaration(node)||ts.isEnumDeclaration(node)||ts.isMethodDeclaration(node)||ts.isMethodSignature(node)||ts.isVariableDeclaration(node))&&node.name&&ts.isIdentifier(node.name)){
    const name=node.name.text,loc=location(node),s=canonical(checker.getSymbolAtLocation(node.name));if(matches(name,loc.path)){const d={name,kind:ts.SyntaxKind[node.kind],...loc,type:signature(node),symbol_key:`${loc.path}#${name}@${loc.line}`};definitions.push(d);declarationNodes.push({s,d});}
   }
   if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)){const result=ts.resolveModuleName(node.moduleSpecifier.text,tree.fileName,options,host).resolvedModule;imports.push({...location(node),specifier:node.moduleSpecifier.text,resolved_path:result?files.get(normalize(result.resolvedFileName))?.source_path??null:null,external:!node.moduleSpecifier.text.startsWith('.')&&!result});}
   ts.forEachChild(node,walk);
  }walk(tree);
 }
 for(const tree of program.getSourceFiles()){
  function walk(node){
   if(ts.isCallExpression(node)||ts.isNewExpression(node)){
    const expr=node.expression,name=ts.isPropertyAccessExpression(expr)?expr.name:expr,s=canonical(checker.getSymbolAtLocation(name));
    const declarations=s?.getDeclarations()??[],targets=declarations.filter(d=>files.has(normalize(d.getSourceFile().fileName))).map(d=>({name:s.getName(),...location(d),type:signature(d)}));
    const matching=targets.filter(d=>matches(d.name,d.path));
    if(matching.length){const resolved=checker.getResolvedSignature(node);calls.push({...location(node),expression:expr.getText(tree).slice(0,300),targets:matching,signature:resolved?checker.signatureToString(resolved):null,resolution:'type_checker_symbol_identity'});}
   }ts.forEachChild(node,walk);
  }walk(tree);
 }
 const unresolvedImports=imports.filter(i=>!i.resolved_path);
 const result={engine:`TypeScript ${ts.version} TypeChecker`,symbol:symbol??null,file:file??null,definitions:definitions.slice(0,limit),callers:calls.slice(0,limit),imports:imports.slice(0,limit),unresolved_imports:unresolvedImports.slice(0,20),warnings,total:{definitions:definitions.length,callers:calls.length,imports:imports.length},truncated:definitions.length>limit||calls.length>limit||imports.length>limit,files_checked:files.size,execution_verified:false,limits:'Resolve aliases, reexports, imports relativos/paths locais e tipos disponíveis nos arquivos indexados. Bibliotecas externas, tsconfig extends, geração de código e resolução dinâmica não são presumidos. Arquivos stale foram excluídos.'};
 if(Buffer.byteLength(JSON.stringify(result))<=1000000){while(typedCache.size>=6)typedCache.delete(typedCache.keys().next().value);typedCache.set(cacheKey,structuredClone(result));}return{...result,structural_cache_hit:false};
}
