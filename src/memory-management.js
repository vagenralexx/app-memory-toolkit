import { feedbackScore } from './memory-quality.js';
export { feedbackScore } from './memory-quality.js';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { memoryStore, memoryRetrieve, memorySearch } from './lifecycle.js';
import { backupStore } from './portability.js';
import { hash } from './store.js';

export function listMemory(store,projectId,{namespace,limit=50,offset=0,include_inactive=false}={}) {
 store.project(projectId);
 const where=`r.project_id=? AND (? IS NULL OR k.namespace=?) AND (?=1 OR r.status NOT IN ('removed','retired','superseded'))`;
 const args=[projectId,namespace??null,namespace??null,include_inactive?1:0];
 const total=store.db.prepare(`SELECT count(*) AS n FROM memory_keys k JOIN records r ON r.id=k.record_id WHERE ${where}`).get(...args).n;
 const results=store.db.prepare(`SELECT k.namespace,k.key,r.id,r.title,r.status,r.revision,r.updated_at FROM memory_keys k JOIN records r ON r.id=k.record_id WHERE ${where} ORDER BY k.namespace,k.key LIMIT ? OFFSET ?`).all(...args,limit,offset);
 return {results,total,next_offset:offset+results.length<total?offset+results.length:null};
}
export function memoryStats(store,projectId) {
 store.project(projectId);
 return {namespaces:store.db.prepare(`SELECT k.namespace,r.status,count(*) AS count FROM memory_keys k JOIN records r ON r.id=k.record_id WHERE r.project_id=? GROUP BY k.namespace,r.status`).all(projectId),
 feedback:store.db.prepare(`SELECT json_extract(content,'$.success') AS outcome,count(*) AS count FROM records WHERE project_id=? AND kind='learning' AND json_valid(content) AND json_extract(content,'$.type')='memory_feedback' GROUP BY outcome`).all(projectId),
 semantic:store.setting('semantic')??{enabled:false},confidence_note:'Feedback é resultado declarado com evidência; não é probabilidade de correção.'};
}
export function feedbackMemory(store,args) {
 return store.transaction(()=>{
  store.project(args.project_id);
  if(!args.key&&!args.task)throw new Error('Informe key ou task.');
  const related=args.key?memoryRetrieve(store,args.project_id,args.namespace,args.key):memorySearch(store,args.project_id,args.task,args.namespace).slice(0,5);
  const pattern=related[0];if(args.key&&!pattern)throw new Error('Memória ativa não encontrada.');
  if(!args.evidence.length)throw new Error('Feedback exige evidência de resultado.');
  const input={type:'memory_feedback',record_id:pattern?.id??null,related_ids:related.map(r=>r.id),pattern_revision:pattern?.revision??null,namespace:args.namespace,key:args.key,task:args.task,success:args.success,quality:args.quality,helpful_docs:args.helpful_docs,agent:args.agent,feedback:args.feedback,evidence:args.evidence,idempotency_key:args.idempotency_key,lesson_key:args.lesson_key,lesson:args.lesson};
  const old=store.db.prepare(`SELECT * FROM records WHERE project_id=? AND kind='learning' AND json_valid(content) AND json_extract(content,'$.type')='memory_feedback' AND json_extract(content,'$.idempotency_key')=?`).get(args.project_id,args.idempotency_key);
  if(old){const stored=JSON.parse(old.content);const comparable=value=>{const {record_id,related_ids,pattern_revision,...body}=value;return body;};if(hash(JSON.stringify(comparable(stored)))!==hash(JSON.stringify(comparable(input))))throw new Error('idempotency_key já usada com outro resultado.');return {id:old.id,duplicate:true,confidence:stored.record_id?feedbackScore(store,args.project_id,stored.record_id):null};}
  const row=store.write({projectId:args.project_id,kind:'learning',title:`Feedback: ${args.key??args.task.slice(0,120)}`,content:JSON.stringify(input),status:'evidence_reported'});
  let distilled=null;
  const lessonKey=args.lesson_key??(args.task?`feedback/${args.idempotency_key}`:null),lesson=args.lesson??(args.task?`${args.task}\nResultado declarado: ${args.success}\nAprendizado: ${args.feedback}`:null);
  if(lessonKey&&lesson){if(lessonKey.length>160)throw new Error('Chave de aprendizado excede160 caracteres; informe lesson_key.');const found=memoryRetrieve(store,args.project_id,'patterns',lessonKey,{includeInactive:true})[0];if(found)throw new Error('lesson_key já existe; atualize o padrão explicitamente com revisão.');distilled=memoryStore(store,{project_id:args.project_id,namespace:'patterns',key:lessonKey,value:lesson,evidence:args.evidence,applicability:'Aprendizado destilado de feedback; conferir escopo nas evidências.',status:'evidence_reported'});}
  return {id:row.id,duplicate:false,distilled,confidence:pattern?feedbackScore(store,args.project_id,pattern.id):null,related_patterns:related.map(r=>({id:r.id,confidence:feedbackScore(store,args.project_id,r.id)}))};
 });
}
export async function deleteMemory(store,args){
 const row=memoryRetrieve(store,args.project_id,args.namespace,args.key,{includeInactive:true})[0];if(!row)throw new Error('Memória não encontrada.');
 if(row.revision!==args.expected_revision)throw new Error('Conflito de revisão.');
 if(!args.purge){const changed=store.write({projectId:args.project_id,id:row.id,expectedRevision:row.revision,kind:row.kind,title:row.title,content:row.content,status:'retired'});return {id:row.id,revision:changed.revision,retired:true,purged:false,history_preserved:true};}
 const dir=join(store.directory,'backups');await mkdir(dir,{recursive:true});const backup=await backupStore(store,join(dir,`before-memory-purge-${randomUUID()}.sqlite`));
 store.transaction(()=>{const current=store.get(args.project_id,row.id);if(current.revision!==args.expected_revision)throw new Error('Memória mudou antes da exclusão.');store.db.prepare('DELETE FROM relations WHERE project_id=? AND (source_id=? OR target_id=?)').run(args.project_id,row.id,row.id);store.db.prepare('DELETE FROM memory_keys WHERE project_id=? AND record_id=?').run(args.project_id,row.id);store.db.prepare('DELETE FROM history WHERE project_id=? AND record_id=?').run(args.project_id,row.id);store.db.prepare('DELETE FROM records WHERE project_id=? AND id=?').run(args.project_id,row.id);store.db.prepare('DELETE FROM retrieval_cache WHERE project_id=?').run(args.project_id);});
 return {id:row.id,purged:true,history_preserved:false,backup,note:'Snapshot de recuperação contém o valor anterior. Purge não apaga backups externos.'};
}
