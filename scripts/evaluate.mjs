import { parseArgs } from 'node:util';
import { resolve,join } from 'node:path';
import { mkdtemp,mkdir,writeFile } from 'node:fs/promises';
import { Store } from '../src/store.js';
import { readBounded } from '../src/safety.js';
import { embed,rerank,indexEmbeddings } from '../src/semantic.js';
import { searchKnowledge } from '../src/retrieval.js';
const {values:args}=parseArgs({options:{data:{type:'string'},input:{type:'string',default:'examples/rag-corpus.json'},output:{type:'string'}}});
const source=new Store(resolve(args.data??process.env.APP_MEMORY_HOME??'.app-memory'));
let store;
try{
  const config=source.setting('semantic');if(!config?.enabled)throw new Error('Prepare semantic-setup antes de executar a avaliação real.');
  const corpus=JSON.parse(await readBounded(resolve(args.input),5_000_000));
  if(!Array.isArray(corpus.documents)||!Array.isArray(corpus.queries)||corpus.documents.length>1000||corpus.queries.length>1000)throw new Error('Corpus inválido.');
  const directory=join(source.directory,'evaluations');await mkdir(directory,{recursive:true});
  const run=await mkdtemp(join(directory,'run-')),app=join(run,'fixture');await mkdir(app);
  store=new Store(join(run,'data'));store.setting('semantic',config);
  const p=store.createProject({name:'Avaliação controlada',root:app,mode:'existing'}),ids=new Map();
  for(const document of corpus.documents){if(ids.has(document.id))throw new Error('Documento duplicado.');ids.set(document.id,store.write({projectId:p.id,kind:'spec',title:document.title,content:document.content}).id);}
  const embedder=(_,texts,options)=>embed(source.directory,texts,options),reranker=(_,query,texts)=>rerank(source.directory,query,texts);
  await indexEmbeddings(store,p.id,{embedder});
  const results=[];
  for(const item of corpus.queries){
    const started=performance.now();
    const lexical=await searchKnowledge(store,p.id,item.query,{semantic:false,limit:3,budget:3000});
    const hybrid=await searchKnowledge(store,p.id,item.query,{embedder,reranker,limit:3,budget:3000});
    const documentId=item.expected===null?null:ids.get(item.expected);if(item.expected!==null&&!documentId)throw new Error('Resposta esperada desconhecida.');
    const map=result=>[...ids].find(([,id])=>id===result.parent_id)?.[0];
    results.push({...item,lexical:lexical.results.map(map),hybrid:hybrid.results.map(result=>({document:map(result),retrieval:result.retrieval})),
      lexical_hit:documentId?lexical.results.some(r=>r.parent_id===documentId):lexical.results.length===0,
      hybrid_hit:documentId?hybrid.results.some(r=>r.parent_id===documentId):hybrid.results.length===0,
      hybrid_top1:documentId?hybrid.results[0]?.parent_id===documentId:hybrid.results.length===0,
      bytes:Buffer.byteLength(JSON.stringify(hybrid)),latency_ms:Math.round(performance.now()-started),warnings:hybrid.search.warnings});
  }
  const summarize=items=>({answerable:items.filter(i=>i.expected!==null).length,lexical_hits_at_3:items.filter(i=>i.expected!==null&&i.lexical_hit).length,
    hybrid_hits_at_3:items.filter(i=>i.expected!==null&&i.hybrid_hit).length,hybrid_hits_at_1:items.filter(i=>i.expected!==null&&i.hybrid_top1).length,
    unanswerable:items.filter(i=>i.expected===null).length,empty_for_unanswerable:items.filter(i=>i.expected===null&&i.hybrid_hit).length});
  const report={version:'1.0.0-rc.1',created_at:new Date().toISOString(),model:config,documents:ids.size,queries:results.length,
    calibration:summarize(results.filter(r=>r.split==='calibration')),validation:summarize(results.filter(r=>r.split!=='calibration')),results,
    limits:'Corpus pequeno e controlado; as consultas dos dois grupos foram inspecionadas durante o desenvolvimento e não constituem avaliação cega independente. Não são métricas de produção nem garantia de economia de tokens. Resultados são candidatos e precisam de validação pelo agente.'};
  const output=resolve(args.output??join(run,'report.json'));const handle=await (await import('node:fs/promises')).open(output,'wx');try{await handle.writeFile(JSON.stringify(report,null,2)+'\n');}finally{await handle.close();}
  console.log(JSON.stringify({output,calibration:report.calibration,validation:report.validation,queries:report.queries},null,2));
}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}finally{store?.close();source.close();}
