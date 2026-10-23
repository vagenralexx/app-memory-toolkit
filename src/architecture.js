import { scanProject } from './projects.js';
import { parseCode } from './structure.js';
import { pack,hash } from './store.js';
import { analyzeSources } from './analysis.js';
import { matchesGlob } from 'node:path';
export const RULE_KINDS=['dependency_absent','dependency_present','path_absent','path_present','import_forbidden','module_boundary','text_absent','text_present','domain_absent','symbol_present'];
const fold=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function glob(pattern,path){return typeof pattern==='string'&&typeof path==='string'&&matchesGlob(path,pattern);}
export function saveConstraint(store,args,type='architecture_constraint'){
 store.project(args.project_id);if(args.decision_id){const d=store.get(args.project_id,args.decision_id);if(d.kind!=='decision'||d.status!=='accepted')throw new Error('Vincule uma decisão aceita deste projeto.');}
 if(args.id){const r=store.get(args.project_id,args.id);if(r.kind!=='rule'||JSON.parse(r.content).type!==type)throw new Error('ID não é regra estruturada compatível.');}
 const value={type,kind:args.kind,pattern:args.pattern??'**',value:args.value,target:args.target??null,decision_id:args.decision_id??null,evidence:args.evidence,explanation:args.explanation};
 const row=store.write({projectId:args.project_id,id:args.id,expectedRevision:args.expected_revision,kind:'rule',title:args.title,content:JSON.stringify(value),status:args.status});return {id:row.id,revision:row.revision};
}
export function constraints(store,projectId,type='architecture_constraint'){return store.db.prepare("SELECT * FROM records WHERE project_id=? AND kind='rule' AND status='active' AND json_valid(content) AND json_extract(content,'$.type')=? ORDER BY id").all(projectId,type).map(r=>({...JSON.parse(r.content),id:r.id,revision:r.revision,title:r.title}));}
export function evaluateConstraint(rule,sources,{intent='',changes={}}={}){
 const selected=sources.filter(s=>glob(rule.pattern,s.path)),data=analyzeSources(sources),deps=data.dependencies;
 const evidence=[],locations=items=>items.map(s=>({path:s.path,source_hash:s.hash,line:Math.max(1,s.content.split('\n').findIndex(l=>l.includes(rule.value))+1)}));
 let violation=false,checked=true,observed=null;
 if(rule.kind==='dependency_absent'||rule.kind==='dependency_present'){const found=deps.filter(d=>d.name===rule.value);observed=found;violation=rule.kind==='dependency_absent'?found.length>0:found.length===0;for(const d of found)evidence.push({path:d.source,declared:d.declared});if((changes.dependencies??[]).includes(rule.value)&&rule.kind==='dependency_absent'){violation=true;evidence.push({proposed_dependency:rule.value});}}
 else if(rule.kind==='path_absent'||rule.kind==='path_present'){const found=sources.filter(s=>glob(rule.value,s.path));observed=found.map(s=>s.path);violation=rule.kind==='path_absent'?found.length>0:found.length===0;evidence.push(...locations(found));if(rule.kind==='path_absent'&&(changes.paths??[]).some(p=>glob(rule.value,p))){violation=true;evidence.push({proposed_path:true});}}
 else if(rule.kind==='text_absent'||rule.kind==='text_present'){const found=selected.filter(s=>s.content.includes(rule.value));observed=found.length;violation=rule.kind==='text_absent'?found.length>0:found.length===0;evidence.push(...locations(found));}
 else if(rule.kind==='import_forbidden'||rule.kind==='module_boundary'){const found=selected.flatMap(s=>parseCode({id:s.path,source_path:s.path,content:s.content}).imports.filter(spec=>glob(rule.value,spec)).map(spec=>({path:s.path,specifier:spec,source_hash:s.hash,line:Math.max(1,s.content.split('\n').findIndex(l=>l.includes(spec))+1)})));observed=found;violation=found.length>0;evidence.push(...found);for(const change of changes.imports??[])if(glob(rule.pattern,change.path)&&glob(rule.value,change.specifier)){violation=true;evidence.push({proposed_import:change});}}
 else if(rule.kind==='domain_absent'){violation=intent&&fold(intent).includes(fold(rule.value));observed=violation?'intent_mentions_absent_domain':'not_mentioned';if(violation)evidence.push({declaration:rule.decision_id??rule.id,scope:'explicit_absent_domain_policy'});}
 else if(rule.kind==='symbol_present'){const found=selected.flatMap(s=>parseCode({id:s.path,source_path:s.path,content:s.content}).symbols.filter(x=>x.name===rule.value).map(x=>({path:s.path,line:x.line,source_hash:s.hash})));violation=!found.length;observed=found;evidence.push(...found);}
 else checked=false;
 return {rule_id:rule.id,title:rule.title,kind:rule.kind,verdict:!checked?'UNSUPPORTED':violation?'VIOLATION':'SATISFIED_IN_SCOPE',observed,evidence,decision_id:rule.decision_id,source_scope:rule.pattern};
}
export async function architectureConflicts(store,args){
 const project=store.project(args.project_id),scan=await scanProject(project.root,store.directory),rules=constraints(store,args.project_id),checks=rules.map(r=>evaluateConstraint(r,scan.sources,args));
 const applicable=checks.filter(c=>c.verdict==='VIOLATION'),rows=store.search(args.project_id,args.intent,12,'decision').filter(r=>r.status==='accepted');
 const coverage=scan.complete&&!Object.entries(scan.skipped).some(([key,value])=>value&&['possible_secret','size','unreadable_file','unreadable_directory','unreadable_ignore'].includes(key));
 return {verdict:applicable.length?'CONFLICTS_FOUND':rules.length&&coverage?'NO_CONFLICTS_IN_DECLARED_RULES':'REVIEW_REQUIRED',checks,hard_conflicts:applicable,rule_count:rules.length,scan_complete:scan.complete,coverage_complete:coverage,skipped:scan.skipped,...pack(rows,{budget:args.budget??2000,query:args.intent}),fingerprint:hash(scan.sources.map(s=>s.path+':'+s.hash).join('\n')),limits:'Conflitos são verificações de regras estruturadas explicitamente registradas, não uma interpretação infalível de qualquer ADR em linguagem natural. Conteúdo não lido pode conter outras violações; resultado não aprova mudanças.'};
}
