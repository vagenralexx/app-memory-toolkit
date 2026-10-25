/** Bounded content-addressed enrichment. Source text is data, never executable instructions. */
import {createHash} from 'node:crypto';
import type {GraphInput,GraphSource,GraphDefinition,GraphConnection} from './graph-core.js';
const cache=new Map<string,{definitions:GraphDefinition[];connections:GraphConnection[]}>();
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
function sql(source:GraphSource){
 // Conservative DDL subset: comments and literal values are erased before finding explicit declarations.
 const text=source.content.replace(/"(?:""|[^"])*"|`[^`]*`|\[[^\]]*\]|--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|\$([A-Za-z_]\w*|)\$[\s\S]*?\$\1\$/g,m=>/^["`\[]/.test(m)?m:m.replace(/[^\n]/g,' '));
 const identifier='(?:"(?:""|[^"])+"|`[^`]+`|\\[[^\\]]+\\]|[A-Za-z_][\\w$]*)(?:\\s*\\.\\s*(?:"(?:""|[^"])+"|`[^`]+`|\\[[^\\]]+\\]|[A-Za-z_][\\w$]*))*';
 const normalize=(s:string)=>(s.match(/"(?:""|[^"])+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w$]*/g)??[]).map(x=>/^["`\[]/.test(x)?x.slice(1,-1).replace(/""/g,'"'):x.toLowerCase()).join('.');
 const definitions:GraphDefinition[]=[],connections:GraphConnection[]=[];
 const re=new RegExp('\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:TEMP(?:ORARY)?\\s+|UNIQUE\\s+)?(TABLE|VIEW|INDEX|TRIGGER|FUNCTION|PROCEDURE)\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?('+identifier+')','gi');
 const outside=text.replace(/"(?:""|[^"])*"|`[^`]*`|\[[^\]]*\]/g,m=>m.replace(/[^\n]/g,' '));
 const declarations=[...text.matchAll(re)].filter(m=>outside.slice(m.index,m.index!+6).toUpperCase()==='CREATE');
 for(const m of declarations){const name=normalize(m[2]),line=text.slice(0,m.index).split('\n').length;definitions.push({key:'sql:'+source.path+':'+m[1].toLowerCase()+':'+name,path:source.path,name,line,kind:'sql_'+m[1].toLowerCase()});}
 for(let i=0;i<declarations.length;i++){const d=definitions[i],start=declarations[i].index!,end=declarations[i+1]?.index??text.length,body=text.slice(start,end);if(d.kind!=='sql_table')continue;
 for(const ref of body.matchAll(new RegExp('\\bREFERENCES\\s+('+identifier+')','gi'))){connections.push({from:d.key,to:'sql-target:'+normalize(ref[1]),relation:'references_table',path:source.path,line:text.slice(0,start+ref.index!).split('\n').length,confidence:'EXTRACTED',mechanism:'conservative_sql_ddl_reference; explicit identifier; dialect subset'});}}
 return{definitions,connections};
}
export function enrichGraph(input:GraphInput,raw?:unknown){
 let hits=0,misses=0;const definitions:GraphDefinition[]=[],connections:GraphConnection[]=[],warnings:unknown[]=[],live=new Set<string>();
 for(const source of input.sources.filter(s=>/\.sql$/i.test(s.path))){const key=input.scope+'\0'+source.path+'\0'+digest(source.content);live.add(key);let parsed=cache.get(key);if(parsed)hits++;else{misses++;parsed=sql(source);cache.set(key,parsed);}definitions.push(...parsed.definitions);connections.push(...parsed.connections);}
 for(const key of cache.keys())if(key.startsWith(input.scope+'\0')&&!live.has(key))cache.delete(key);while(cache.size>256)cache.delete(cache.keys().next().value!);
 const tables=definitions.filter(d=>d.kind==='sql_table');const resolved:GraphConnection[]=[];for(const edge of connections){const name=edge.to.slice(11),matches=tables.filter(d=>d.name===name||(!name.includes('.')&&d.name.split('.').pop()===name));if(matches.length===1)resolved.push({...edge,to:matches[0].key});else warnings.push({state:matches.length?'SQL_TARGET_AMBIGUOUS':'SQL_TARGET_NOT_OBSERVED',target:name});}
 let accepted=0,rejected=0;
 if(raw!==undefined){if(!raw||typeof raw!=='object'||Array.isArray(raw)||JSON.stringify(raw).length>200000)throw Error('enrichment inválido ou maior que200KB.');const packet=raw as Record<string,unknown>;if(Object.keys(packet).some(k=>!['schema','links'].includes(k))||packet.schema!=='mcp-graph-enrichment/v1'||!Array.isArray(packet.links)||packet.links.length>200)throw Error('Contrato enrichment inválido.');
 const sources=new Map(input.sources.map(s=>[s.path,s])),known=new Set([...input.sources.map(s=>'file:'+s.path),...input.definitions.map(d=>d.key),...definitions.map(d=>d.key),...(input.records??[]).map(r=>r.key)]);
 for(const item of packet.links){if(!item||typeof item!=='object'||Array.isArray(item)){rejected++;continue;}const x=item as Record<string,unknown>,s=sources.get(String(x.path)),line=Number(x.line),quote=String(x.quote??'');if(Object.keys(x).some(k=>!['from','to','relation','path','line','quote','source_hash','provider'].includes(k))||!s||x.source_hash!==s.hash||!Number.isSafeInteger(line)||line<1||line>s.content.split('\n').length||!quote.trim()||quote.length>1000||!s.content.split('\n')[line-1].includes(quote)||!known.has(String(x.from))||!known.has(String(x.to))||!['mentions','explains','implements','related_to','depends_on','calls','imports','references'].includes(String(x.relation))||typeof x.provider!=='string'||x.provider.length>100){rejected++;continue;}
 // An anchor verifies provenance, never the semantic assertion or an external parser's correctness.
 resolved.push({from:String(x.from),to:String(x.to),relation:String(x.relation),path:s.path,line,confidence:'INFERRED',mechanism:'host_supplied_inference; anchor_hash_checked; provider:'+x.provider});accepted++;}}
 if(rejected)warnings.push({state:'ENRICHMENT_REJECTED',count:rejected});
 return{input:{...input,definitions:[...input.definitions,...definitions],connections:[...input.connections,...resolved],coverage:{...input.coverage,complete:input.coverage.complete&&warnings.length===0,warnings:[...(input.coverage.warnings??[]),...warnings],enrichment:{sql_dialect_subset:true,sql_definitions:definitions.length,cache:{hits,misses,entries:cache.size,storage:'bounded_process_memory; fresh source hashes each call'},external_links_accepted:accepted,external_links_rejected:rejected}}}};
}
