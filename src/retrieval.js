import { hash, pack, now } from './store.js';
import { embed, cosine, rerank,embeddingKey } from './semantic.js';
import { queryTerms } from './text.js';

const baseSql = `SELECT c.*,r.kind,r.status,r.revision,r.updated_at,r.source_path,r.source_hash,c.record_id AS parent_id
  FROM chunks c JOIN records r ON r.id=c.record_id WHERE c.project_id=? AND r.status NOT IN ('removed','superseded','deprecated','retired')
  AND (? IS NULL OR r.kind=?) AND (? IS NULL OR c.module=?) AND (?=1 OR c.document_status NOT IN ('superseded','deprecated','historical'))`;

export async function retrieve(store,projectId,query,{limit=8,kind,module,includeInactive=false,semantic=true,expandRelations=false,embedder=embed,reranker=rerank}={}) {
  store.project(projectId);
  const terms=queryTerms(query);
  if(!terms.length) return {rows:[],cache_hit:false,channels:['lexical'],warnings:[],candidate_count:0};
  const revision=store.revision(projectId);
  const config=store.setting('semantic');
  const identity=config?.enabled?embeddingKey(config):null;
  const key=hash(JSON.stringify({query:query.trim().toLocaleLowerCase(),limit,kind,module,includeInactive,semantic:semantic&&config?.enabled,model:identity,reranker:semantic?config?.reranker:null,expandRelations,ranking_version:3}));
  const cached=store.db.prepare('SELECT payload FROM retrieval_cache WHERE project_id=? AND key=? AND revision=?').get(projectId,key,revision);
  if(cached) {
    try{
      const data=JSON.parse(cached.payload);
      return {...data,rows:data.results.map(result=>({...store.get(projectId,result.id),retrieval:result.retrieval})),cache_hit:true};
    }catch{store.db.prepare('DELETE FROM retrieval_cache WHERE project_id=? AND key=?').run(projectId,key);}
  }
  const filters=[projectId,kind??null,kind??null,module??null,module??null,includeInactive?1:0];
  const expression=terms.map(term=>`"${term}"`).join(' OR ');
  const lexical=store.db.prepare(`${baseSql} AND c.rowid IN (SELECT rowid FROM chunk_search WHERE chunk_search MATCH ?)
    ORDER BY (SELECT bm25(chunk_search,4.0,1.0) FROM chunk_search WHERE rowid=c.rowid AND chunk_search MATCH ?),c.id LIMIT 60`).all(...filters,expression,expression);
  const pool=new Map();
  function add(row,rank,channel,similarity) {
    const entry=pool.get(row.id)??{row,score:0,channels:[],similarity:null};
    entry.score+=1/(60+rank+1);entry.channels.push(channel);
    if(similarity!==undefined) entry.similarity=similarity;
    pool.set(row.id,entry);
  }
  lexical.forEach((row,i)=>add(row,i,'lexical'));
  const warnings=[],channels=['lexical'];let semanticCoverage=null;
  if(semantic&&config?.enabled) {
    const vectors=store.db.prepare(`${baseSql} AND EXISTS(SELECT 1 FROM embeddings e WHERE e.chunk_id=c.id AND e.model=? AND e.digest=c.digest)`).all(...filters,identity);
    const total=store.db.prepare(`SELECT count(*) AS n FROM (${baseSql})`).get(...filters).n;
    semanticCoverage={indexed:vectors.length,total,pending:total-vectors.length};
    if(vectors.length) {
      try {
        const [queryVector]=await embedder(store.directory,[query],{query:true});
        const ranked=vectors.map(row=>{
          const vector=JSON.parse(store.db.prepare('SELECT vector FROM embeddings WHERE chunk_id=? AND model=?').get(row.id,identity).vector);
          return {row,similarity:cosine(queryVector,vector)};
        }).filter(item=>item.similarity>=0.7).sort((a,b)=>b.similarity-a.similarity).slice(0,60);
        ranked.forEach((item,i)=>add(item.row,i,'semantic',item.similarity));channels.push('semantic');
      } catch(error) { warnings.push(error.message); }
    } else warnings.push('Modelo habilitado, mas o projeto ainda não tem vetores. Execute index --semantic.');
  }
  let ranked=[...pool.values()].sort((a,b)=>b.score-a.score||a.row.id.localeCompare(b.row.id));
  if(semantic&&config?.reranker?.enabled&&ranked.length){
    try{
      const candidates=ranked.slice(0,config.reranker.max_candidates??24);
      const scores=await reranker(store.directory,query,candidates.map(item=>`${item.row.title}\n${item.row.content}`));
      if(scores.length!==candidates.length||scores.some(value=>!Number.isFinite(value)))throw new Error('Retorno inválido do reranker.');
      ranked=candidates.map((item,i)=>({...item,relevance:scores[i],lexical_rescue:lexical[0]?.id===item.row.id,exact:/^[\w$./\\:-]+$/.test(query)&&/[a-z][A-Z]|[_$./\\]/.test(query)&&(item.row.content.includes(query)||item.row.title.includes(query))}))
        .map(item=>({...item,strong_semantic:item.similarity!==null&&item.similarity>=0.85}))
        .filter(item=>item.exact||item.lexical_rescue||item.strong_semantic||(item.relevance>=(config.reranker.min_score??0.004)&&(item.similarity===null||item.similarity>=(config.reranker.min_similarity??0.83))))
        .sort((a,b)=>Number(b.exact)-Number(a.exact)||Number(b.strong_semantic)-Number(a.strong_semantic)||b.relevance-a.relevance||b.score-a.score);
      channels.push('reranker');
    }catch(error){warnings.push(error.message.slice(0,300));}
  }
  const chosen=[],counts=new Map(),digests=new Set();
  for(const item of ranked) {
    const count=counts.get(item.row.record_id)??0;
    if(count>=2||digests.has(item.row.digest)) continue;
    chosen.push({...item.row,retrieval:{score:item.score,channels:item.channels,similarity:item.similarity,...(item.relevance!==undefined?{relevance:item.relevance,exact_match:item.exact,lexical_rescue:item.lexical_rescue}:{} )}});
    counts.set(item.row.record_id,count+1);digests.add(item.row.digest);
    if(chosen.length>=limit) break;
  }
  if(expandRelations&&chosen.length<limit) {
    for(const row of [...chosen]) {
      const relations=store.db.prepare('SELECT target_id,relation FROM relations WHERE project_id=? AND source_id=? LIMIT 3').all(projectId,row.parent_id);
      for(const relation of relations) {
        const related=store.db.prepare(`${baseSql} AND r.id=? LIMIT 1`).get(...filters,relation.target_id);
        if(!related||chosen.some(item=>item.id===related.id)||chosen.length>=limit) continue;
        chosen.push({...related,retrieval:{score:0,channels:['relation'],from:row.id,relation:relation.relation}});
      }
    }
  }
  const result={results:chosen.map(row=>({id:row.id,retrieval:row.retrieval})),channels,warnings,candidate_count:pool.size,semantic_coverage:semanticCoverage};
  // Errors are retryable: a temporary model failure must not persist as a cache hit.
  if(!warnings.length) {
    try{
      store.db.prepare('INSERT INTO retrieval_cache VALUES(?,?,?,?,?) ON CONFLICT(project_id,key) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,created_at=excluded.created_at')
        .run(projectId,key,revision,JSON.stringify(result),now());
      store.db.prepare('DELETE FROM retrieval_cache WHERE rowid NOT IN (SELECT rowid FROM retrieval_cache ORDER BY created_at DESC LIMIT 1000)').run();
    }catch{warnings.push('Resultado entregue, mas o cache não pôde ser salvo.');}
  }
  return {...result,rows:chosen,cache_hit:false};
}

export async function searchKnowledge(store,projectId,query,options={}) {
  const found=await retrieve(store,projectId,query,options);
  const response=pack(found.rows,{...options,query});
  response.search={channels:found.channels,cache_hit:found.cache_hit,candidate_count:found.candidate_count,warnings:found.warnings,semantic_coverage:found.semantic_coverage};
  // Packing includes presentation metadata. Drop whole results rather than silently cutting evidence.
  while(response.results.length&&Buffer.byteLength(JSON.stringify(response))/3>(options.budget??2000)) {response.results.pop();response.omitted++;}
  response.estimated_tokens=Math.ceil(Buffer.byteLength(JSON.stringify(response))/3);
  return response;
}
