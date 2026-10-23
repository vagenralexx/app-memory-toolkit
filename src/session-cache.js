import { randomUUID } from 'node:crypto';
import { hash,estimateTokens } from './store.js';
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
export const CACHE_TOOLS=new Set(['search_knowledge','get_context','get_task_briefing','get_module_context','get_project_context','get_ecosystem_context','get_design_guidance','get_react_view_transitions','memory_retrieve']);
export class SessionCache {
 constructor(store,{max=64,ttl=1800000}={}){this.store=store;this.max=max;this.ttl=ttl;this.entries=new Map();}
 version(projectId){return hash(JSON.stringify([projectId?this.store.revision(projectId):this.store.projects().map(p=>[p.id,this.store.revision(p.id)]),this.store.setting('semantic')]));}
 key(name,args){const {cache_mode,...input}=args;return hash(JSON.stringify(stable([name,input])));}
 lookup(name,args){const key=this.key(name,args),entry=this.entries.get(key);if(!entry)return null;if(entry.version!==this.version(args.project_id)||Date.now()-entry.at>this.ttl){this.entries.delete(key);return null;}this.entries.delete(key);this.entries.set(key,entry);return entry;}
 save(name,args,value){if(Buffer.byteLength(JSON.stringify(value))>150000)return null;const key=this.key(name,args),entry={ref:randomUUID(),key,project_id:args.project_id??null,version:this.version(args.project_id),at:Date.now(),value:structuredClone(value)};this.entries.set(key,entry);while(this.entries.size>this.max)this.entries.delete(this.entries.keys().next().value);return entry;}
 resolve(projectId,ref,budget=10000){const entry=[...this.entries.values()].find(e=>e.ref===ref&&e.project_id===(projectId??null));if(!entry)throw new Error('Referência ausente/expirada nesta sessão; repita a consulta.');if(entry.version!==this.version(projectId)||Date.now()-entry.at>this.ttl)throw new Error('Referência desatualizada; repita a consulta.');const required=estimateTokens(JSON.stringify(entry.value));if(required>budget)return {ref,requires_budget:required,resolved:false,next:'Repetir resolve_cached_ref com budget suficiente ou executar consulta com orçamento menor.'};return {ref,resolved:true,value:structuredClone(entry.value)};}
}
