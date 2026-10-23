import { join } from 'node:path';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
const MODEL = 'Xenova/multilingual-e5-small';
const RERANKER = 'SugoLabs/mmarco-mMiniLMv2-L12-H384-v1';
const extractors = new Map();
const rankers = new Map();
export const modelId = MODEL;
export const embeddingKey=config=>config.fingerprint?`${config.model}#${config.fingerprint}`:config.model;

async function fingerprint(directory,model) {
  const digest=createHash('sha256');
  for(const file of ['config.json','tokenizer.json','onnx/model_quantized.onnx']){
    digest.update(file);
    for await(const bytes of createReadStream(join(directory,'models',model,file)))digest.update(bytes);
  }
  return digest.digest('hex');
}

async function extractor(directory, download) {
  const key = directory;
  if (!extractors.has(key)) extractors.set(key, (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = true;
    env.localModelPath = join(directory, 'models');
    env.cacheDir = join(directory, 'models');
    env.logLevel = 40;
    return pipeline('feature-extraction', MODEL, { dtype: 'q8', device: 'cpu', local_files_only: !download,
      session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 } });
  })().catch(error => { extractors.delete(key); throw new Error(`Embedding local indisponível: ${error.message}. Execute app-memory semantic-setup para preparar o modelo, ou use busca lexical.`); }));
  return extractors.get(key);
}

export async function embed(directory, texts, { query = false, download = false } = {}) {
  const pipe = await extractor(directory, download);
  const output = await pipe(texts.map(text => `${query ? 'query' : 'passage'}: ${text}`), { pooling: 'mean', normalize: true, truncation: true, max_length: 512 });
  return output.tolist();
}

export async function rerank(directory,query,documents,{download=false}={}) {
  if(!documents.length)return [];
  if(!rankers.has(directory))rankers.set(directory,(async()=>{
    const {AutoTokenizer,AutoModelForSequenceClassification,env}=await import('@huggingface/transformers');
    env.allowLocalModels=true;env.localModelPath=join(directory,'models');env.cacheDir=join(directory,'models');env.logLevel=40;
    const [tokenizer,model]=await Promise.all([
      AutoTokenizer.from_pretrained(RERANKER,{local_files_only:!download}),
      AutoModelForSequenceClassification.from_pretrained(RERANKER,{dtype:'q8',device:'cpu',local_files_only:!download,session_options:{intraOpNumThreads:2,interOpNumThreads:1}})
    ]);
    return {tokenizer,model};
  })().catch(error=>{rankers.delete(directory);throw new Error(`Reranker local indisponível: ${error.message}`);}));
  const {tokenizer,model}=await rankers.get(directory),scores=[];
  for(let at=0;at<documents.length;at+=8){
    const docs=documents.slice(at,at+8);
    const inputs=tokenizer(Array(docs.length).fill(query),{text_pair:docs,padding:true,truncation:true,max_length:512});
    const output=await model(inputs);
    for(const row of output.logits.tolist())scores.push(1/(1+Math.exp(-row[0])));
  }
  return scores;
}

export async function semanticSetup(store) {
  const result = await embed(store.directory, ['Preparação do modelo de memória.'], { download: true });
  const config = { enabled: true, model: MODEL, dimensions: result[0].length, dtype: 'q8', local: true,fingerprint:await fingerprint(store.directory,MODEL) };
  await rerank(store.directory,'Como retomar uma tarefa?',['O handoff permite retomar a tarefa.'],{download:true});
  config.reranker={enabled:true,model:RERANKER,min_score:0.004,min_similarity:0.83,max_candidates:24,fingerprint:await fingerprint(store.directory,RERANKER)};
  store.setting('semantic', config);
  return { ...config, next: 'Execute index --semantic para gerar os vetores do projeto. Somente o modelo é baixado; documentos não são enviados.' };
}

export async function indexEmbeddings(store, projectId, { embedder = embed, progress = () => {} } = {}) {
  store.project(projectId);
  const config = store.setting('semantic');
  if (!config?.enabled) return { enabled: false, indexed: 0, next: 'Execute semantic-setup para ativar a busca semântica local.' };
  const identity=embeddingKey(config);
  const chunks = store.db.prepare(`SELECT c.* FROM chunks c LEFT JOIN embeddings e ON e.chunk_id=c.id AND e.model=? AND e.digest=c.digest
    WHERE c.project_id=? AND e.chunk_id IS NULL ORDER BY c.id`).all(identity,projectId);
  let indexed = 0;
  for (let at = 0; at < chunks.length; at += 12) {
    const batch = chunks.slice(at, at + 12);
    const vectors = await embedder(store.directory,batch.map(row => `${row.title}\n${row.content}`));
    if (vectors.length !== batch.length) throw new Error('Quantidade de embeddings inválida.');
    store.transaction(() => {
      for (let i=0; i<batch.length; i++) {
        const row=batch[i],vector=vectors[i];
        if (vector.length !== config.dimensions || vector.some(value => !Number.isFinite(value))) throw new Error('Dimensão ou conteúdo de embedding inválido.');
        // Another client may have reindexed this source while the model was running.
        const current=store.db.prepare('SELECT digest FROM chunks WHERE id=? AND project_id=?').get(row.id,projectId);
        if (!current || current.digest!==row.digest) continue;
        store.db.prepare('INSERT INTO embeddings VALUES(?,?,?,?) ON CONFLICT(chunk_id,model) DO UPDATE SET digest=excluded.digest,vector=excluded.vector')
          .run(row.id,identity,row.digest,JSON.stringify(vector));
        indexed++;
      }
    });
    progress({ indexed, total: chunks.length });
  }
  store.db.prepare('DELETE FROM retrieval_cache WHERE project_id=?').run(projectId);
  return { enabled:true,model:config.model,embedding_identity:identity,indexed,remaining:store.db.prepare(`SELECT count(*) AS n FROM chunks c LEFT JOIN embeddings e ON e.chunk_id=c.id AND e.model=? WHERE c.project_id=? AND e.chunk_id IS NULL`).get(identity,projectId).n };
}

export function cosine(a,b) {
  if (a.length!==b.length) return -1;
  let dot=0,aa=0,bb=0;
  for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}
  return aa&&bb ? dot/Math.sqrt(aa*bb) : 0;
}
