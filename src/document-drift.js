import { join,dirname,relative,isAbsolute,basename } from 'node:path';
import { lstat,realpath } from 'node:fs/promises';
import { scanProject } from './projects.js';
import { parseCode } from './structure.js';
import { constraints,evaluateConstraint } from './architecture.js';
import { hash } from './store.js';
import { isWithin } from './safety.js';
function docRefs(doc){const refs=[];for(const m of doc.content.matchAll(/\[[^\]]*\]\(([^)\s]+)\)|`((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_./-]+\.[a-zA-Z0-9]+(?::\d+)?(?:#[\w$]+)?)`/g)){const text=m[1]??m[2];if(/^(?:https?:|mailto:|#|data:)/.test(text))continue;const [raw,symbol]=text.split('#'),path=raw.replace(/:\d+$/,'');refs.push({path,symbol,link:Boolean(m[1]),line:doc.content.slice(0,m.index).split('\n').length+1});}return refs;}
export async function documentDrift(store,projectId,{limit=30,offset=0,other_project_ids=[]}={}){
 const project=store.project(projectId),scan=await scanProject(project.root,store.directory),byPath=new Map(scan.sources.map(s=>[s.path,s]));
 const indexed=store.db.prepare("SELECT * FROM records WHERE project_id=? AND source_path IS NOT NULL").all(projectId),old=new Map(indexed.map(r=>[r.source_path,r]));
 const items=[];
 for(const doc of scan.sources.filter(s=>s.kind==='spec'))for(const ref of docRefs(doc)){
  const abs=join(ref.link?join(project.root,dirname(doc.path)):project.root,ref.path),path=relative(project.root,abs).replaceAll('\\','/');
  let classification='CURRENT',action='KEEP',confidence='high',candidate=null;
  const future=/status:\s*(planned|proposed|future)|Estado: planejamento|a implementar|implementação futura/i.test(doc.content.slice(0,1500)),historical=/status:\s*(superseded|deprecated|historical|archived)/i.test(doc.content.slice(0,1500));
  if(!isWithin(project.root,abs)||isAbsolute(ref.path)){classification='EXTERNAL_REFERENCE';}
  else if(historical){classification='HISTORICAL_REFERENCE';}
  else if(!byPath.has(path)){
   if(future)classification='SPEC_FUTURE';
   else {
    let present=false;try{const stat=await lstat(abs);if(stat.isSymbolicLink())throw Error();const canonical=await realpath(abs);present=isWithin(project.root,canonical);}catch{}
    if(present){classification='UNINDEXED_REFERENCE';confidence='low';action='REVIEW';}
    else{
     const previous=old.get(path),moved=previous?scan.sources.filter(s=>s.hash===previous.source_hash):[];
     if(moved.length===1){classification='PATH_MOVED';candidate=moved[0].path;action='UPDATE_CANONICAL';}
     else{classification='CODE_REMOVED';action='REVIEW';confidence='medium';for(const id of other_project_ids){const other=store.project(id);try{const otherPath=join(other.root,path),canonical=await realpath(otherPath);if(isWithin(other.root,canonical)){classification='OTHER_BRANCH';candidate={project_id:id,path};action='KEEP';break;}}catch{}}
      if(classification==='CODE_REMOVED'){const similar=scan.sources.filter(s=>basename(s.path)===basename(path));if(similar.length===1){classification='POSSIBLE_PATH_MOVE';candidate=similar[0].path;confidence='low';}}
     }
    }
   }
  }else if(ref.symbol&&byPath.get(path).kind==='spec'){
   const anchors=[...byPath.get(path).content.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m=>m[1].trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/\s/g,'-'));
   if(!anchors.includes(ref.symbol.toLowerCase())){classification=future?'SPEC_FUTURE':'DOCUMENT_ANCHOR_MISSING';action=future?'KEEP':'REVIEW';}
  }else if(ref.symbol){const current=byPath.get(path),symbols=parseCode({id:path,source_path:path,content:current.content}).symbols;
   if(!symbols.some(s=>s.name===ref.symbol)){
    if(future)classification='SPEC_FUTURE';else{classification='SYMBOL_MISSING';action='REVIEW';const previous=old.get(path),before=previous?parseCode({id:path,source_path:path,content:previous.content}).symbols.find(s=>s.name===ref.symbol):null;
     if(before){const shape=s=>s.signature.replace(s.name,'$NAME');const rename=symbols.filter(s=>shape(s)===shape(before));if(rename.length===1){classification='POSSIBLE_SYMBOL_RENAME';candidate=rename[0].name;confidence='medium';}}
    }
   }
  }
  items.push({id:hash(`${doc.path}:${ref.line}:${path}:${ref.symbol??''}`).slice(0,24),document:doc.path,line:ref.line,reference:{path,symbol:ref.symbol??null},classification,confidence,candidate,action,patch_allowed:classification==='PATH_MOVED'&&!/(^|\/)(?:ADR[-_]|AGENTS\.md|CLAUDE\.md)/i.test(doc.path),document_hash:doc.hash,requires_review:action!=='KEEP'});
 }
 const claims=constraints(store,projectId,'knowledge_claim').map(r=>({...evaluateConstraint(r,scan.sources),classification:'STRUCTURED_KNOWLEDGE_CLAIM'}));
 const total=items.length;return {items:items.slice(offset,offset+limit),total,next_offset:offset+limit<total?offset+limit:null,claims:claims.slice(0,100),claims_truncated:claims.length>100,scan_complete:scan.complete,skipped:scan.skipped,semantic_consistency_verified:false,analysis:'References, source fingerprints and explicit testable claims; not arbitrary natural-language entailment.',execution_verified:false};
}
