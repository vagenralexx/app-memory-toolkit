import{augmentGraph,parserCapabilities}from'./graph-extractors.js';import{extractMedia,validateMedia}from'./graph-media.js';import{cachedGraphQuery}from'./graph-cache.js';import{graphWatch,graphProviderStatus,syncGraph}from'./graph-operations.js';
import{retrieve}from'./retrieval.js';
import{createHash}from'node:crypto';import{posix}from'node:path';
import{queryGraph,graphHelp,validateGraphArgs}from'./graph-core.js';import{scanProject}from'./projects.js';import{typedContext}from'./type-intelligence.js';import{docRefs}from'./document-drift.js';import{containsSecret}from'./safety.js';import{hash}from'./store.js';
/** Combines current source guards, existing TypeChecker, record relations and document reference extractor. */
export async function projectGraphContext(store,projectId,raw){
 const project=store.project(projectId),{project_id,...input}=raw,args=validateGraphArgs(input);if(args.mode==='help')return{...graphHelp(),optional_parsers:parserCapabilities()};
 const inScope=p=>!args.paths?.length||args.paths.some(base=>p===base||p.startsWith(base.endsWith('/')?base:base+'/'));
 const scan=await scanProject(project.root,store.directory,{artifacts:validateMedia(args.media).map(x=>x.path)}),sources=scan.sources.filter(s=>inScope(s.path)),byPath=new Map(sources.map(s=>[s.path,s]));
 const indexed=store.db.prepare("SELECT * FROM records WHERE project_id=? AND source_path IS NOT NULL AND status='observed' ORDER BY source_path").all(projectId).filter(r=>inScope(r.source_path)),recordsByPath=new Map(indexed.map(r=>[r.source_path,r]));
 const modules=new Map(store.db.prepare('SELECT record_id,min(module)AS module FROM chunks WHERE project_id=? GROUP BY record_id').all(projectId).map(r=>[r.record_id,r.module]));
 const warnings=[],current=new Set();for(const row of indexed){const s=byPath.get(row.source_path);if(s&&s.hash===row.source_hash)current.add(row.source_path);else warnings.push({path:row.source_path,state:'STALE_OR_SOURCE_UNAVAILABLE'});}
 for(const s of sources){s.module=modules.get(recordsByPath.get(s.path)?.id);if(!current.has(s.path))warnings.push({path:s.path,state:'UNINDEXED_OR_STALE_SOURCE'});}
 const typed=await typedContext(store,projectId,{limit:10000});warnings.push(...typed.warnings.filter(w=>!w.path||inScope(w.path)));if(typed.truncated)warnings.push({state:'TYPE_CONTEXT_TRUNCATED'});
 for(const w of typed.warnings)if(w.path&&w.state==='STALE')current.delete(w.path);
 const definitions=typed.definitions.filter(d=>current.has(d.path)&&byPath.get(d.path)?.hash===d.source_hash).map(d=>({key:'symbol:'+d.symbol_key,path:d.path,name:d.name,line:d.line,kind:d.kind})),connections=[];
 const defTargets=new Map();for(const d of definitions){const key=d.path+'\0'+d.name+'\0'+d.line,items=defTargets.get(key)??[];items.push(d.key);defTargets.set(key,items);}
 for(const imp of typed.imports)if(imp.resolved_path&&current.has(imp.path)&&current.has(imp.resolved_path)&&byPath.get(imp.path)?.hash===imp.source_hash)connections.push({from:'file:'+imp.path,to:'file:'+imp.resolved_path,relation:'imports',confidence:'EXTRACTED',path:imp.path,line:imp.line,mechanism:'existing_TypeChecker_import_resolver; current sources'});
 for(const call of typed.callers)if(current.has(call.path)&&byPath.get(call.path)?.hash===call.source_hash)for(const target of call.targets){if(!current.has(target.path)||byPath.get(target.path)?.hash!==target.source_hash)continue;const keys=defTargets.get(target.path+'\0'+target.name+'\0'+target.line)??[];for(const key of keys)connections.push({from:'file:'+call.path,to:key,relation:'calls',confidence:keys.length===1?'INFERRED':'AMBIGUOUS',path:call.path,line:call.line,mechanism:'existing_TypeChecker_symbol_identity; static not runtime'});}
 const canonical=store.db.prepare("SELECT id,title,kind,content,revision,source_path FROM records WHERE project_id=? AND source_path IS NULL AND status NOT IN ('removed','retired','superseded','rejected') ORDER BY id LIMIT 1001").all(projectId);
 const records=canonical.slice(0,1000).filter(r=>!containsSecret(r.title+'\n'+r.content)).map(r=>({key:'record:'+r.id,label:r.title,kind:r.kind,hash:hash(r.content+':'+r.revision)}));if(!args.paths?.length&&canonical.length>1000)warnings.push({state:'CANONICAL_RECORD_LIMIT'});
 const canonicalKeys=new Set(records.map(r=>r.key)),relationRows=store.db.prepare('SELECT source_id,target_id,relation FROM relations WHERE project_id=? ORDER BY source_id,target_id,relation LIMIT 10001').all(projectId);if(!args.paths?.length&&relationRows.length>10000)warnings.push({state:'CANONICAL_RELATION_LIMIT'});
 const indexedById=new Map(indexed.map(r=>[r.id,r]));
 const keyFor=id=>{const row=indexedById.get(id);return row&&current.has(row.source_path)?'file:'+row.source_path:canonicalKeys.has('record:'+id)?'record:'+id:null;};
 for(const r of relationRows.slice(0,10000)){const from=keyFor(r.source_id),to=keyFor(r.target_id);if(from&&to)connections.push({from,to,relation:r.relation,confidence:'EXTRACTED',mechanism:'existing_canonical_record_link; declared relation not implementation proof'});}
 for(const doc of sources.filter(s=>/\.(md|txt)$/i.test(s.path)&&current.has(s.path)))for(const ref of docRefs(doc)){const target=posix.normalize(posix.join(ref.link?posix.dirname(doc.path):'',ref.path));if(!target.startsWith('../')&&byPath.has(target))connections.push({from:'file:'+doc.path,to:'file:'+target,relation:ref.link?'links_to':'mentions',confidence:'EXTRACTED',path:doc.path,line:ref.line,mechanism:'existing_document_reference_extractor; mention not implementation proof'});}
 let retrieval; if(args.mode==='query'){try{const found=await retrieve(store,projectId,args.query??'',{limit:10,semantic:args.semantic===true});retrieval={keys:found.rows.flatMap(r=>r.source_path?['file:'+r.source_path]:r.parent_id?['record:'+r.parent_id]:[]),provider:args.semantic===true?'existing_retrieve_hybrid':'existing_retrieve_lexical',warnings:found.warnings};}catch{retrieval={keys:[],provider:args.semantic===true?'existing_retrieve_hybrid':'existing_retrieve_lexical',warnings:['HYBRID_SEEDS_UNAVAILABLE; graph label fallback']};}}
 const complete=scan.complete&&warnings.length===0;
 const baseInput={scope:'project:'+projectId,retrieval,sources,definitions,connections,records,coverage:{complete,warnings:warnings.slice(0,100),warning_count:warnings.length,scan_skipped:scan.skipped,bytes_read:scan.bytes,type_engine:typed.engine,unresolved_imports:typed.unresolved_imports.length,indexed_current_files:current.size}};
 const media=await extractMedia(project.root,args.media,new Set(scan.artifacts),text=>!containsSecret(text));
 const withMedia={...baseInput,sources:[...baseInput.sources,...media.sources],coverage:{...baseInput.coverage,complete:baseInput.coverage.complete&&media.warnings.length===0,warnings:[...(baseInput.coverage.warnings??[]),...media.warnings],media:media.receipts}};
 const enriched=await augmentGraph(withMedia,{enabled:args.parsers!==false,dialect:args.sql_dialect});
 return{...cachedGraphQuery(enriched,input),project_id:projectId,persistence:{namespace:'notes',key:'graph:snapshot',write_tool:'memory_store existente; value JSON string; expected_revision ao atualizar; somente se fits_memory=true',writes_automatically:false},next_tools:['get_symbol_context','get_code_references','get_dependency_context','find_related_knowledge','get_ponytail_guidance','check_architecture_conflicts'],adapter:'existing_scanner+TypeChecker+canonical_relations+document_drift_extractor'};
}

export async function manageProjectGraph(store,projectId,args){
 const project=store.project(projectId),scope='project:'+projectId;
 if(args.action==='status')return{providers:graphProviderStatus(),watcher:graphWatch(scope,project.root,'status')};
 if(args.action==='watch_stop')return graphWatch(scope,project.root,'watch_stop');
 if(args.action==='watch_start'){const {indexProject}=await import('./projects.js');return graphWatch(scope,project.root,'watch_start',args.seconds??120,async()=>{await indexProject(store,projectId);});}
 if(args.action!=='sync'||!['neo4j','falkordb'].includes(args.target))throw Error('Operação de grafo inválida.');
 const result=await projectGraphContext(store,projectId,{project_id:projectId,mode:'export',format:'json',paths:args.paths,max_nodes:500});return syncGraph(JSON.parse(result.export.content),args.target);
}
