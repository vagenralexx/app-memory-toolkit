import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store, estimateTokens } from '../src/store.js';
import { splitRecord } from '../src/chunks.js';
import { searchKnowledge } from '../src/retrieval.js';
import { indexEmbeddings } from '../src/semantic.js';

async function fixture(t) {
  const root=await mkdtemp(join(process.env.APP_MEMORY_TEST_TMP??tmpdir(),'app-memory-retrieval-'));
  const app=join(root,'app');await mkdir(app);
  const store=new Store(join(root,'data'));t.after(()=>store.close());
  const project=store.createProject({name:'Busca',root:app,mode:'existing'});
  return {root,store,project};
}
test('chunks preservam trechos longos e referências sem descartar conteúdo de linhas minificadas',()=>{
  const content='# Seção\n'+('x'.repeat(5000))+'\n# Outra\nNão executar antes de confirmar.';
  const chunks=splitRecord({id:'a',project_id:'p',title:'Teste',content,source_path:'docs/auth/login.md'});
  assert.equal(chunks.filter(c=>c.content.startsWith('x')).map(c=>c.content).join('').length,5000);
  assert.ok(chunks.some(c=>c.content.includes('Não executar')));
  assert.ok(chunks.every(c=>c.start_line>0&&c.end_line>=c.start_line));
  assert.equal(chunks[0].module,'auth');
});

test('BM25 por chunk, cache por revisão e apresentação independente, sem mistura entre projetos',async t=>{
  const {store,project,root}=await fixture(t),p=project.id;
  const row=store.write({projectId:p,kind:'spec',title:'Acesso',content:'# Login\nNão renovar sessão sem permissão.\n'+('Contexto de autenticação.\n'.repeat(180))});
  const otherApp=join(root,'other');await mkdir(otherApp);
  const other=store.createProject({name:'Outro',root:otherApp,mode:'existing'});
  store.write({projectId:other.id,kind:'spec',title:'Segredo do outro app',content:'Não renovar sessão sem permissão.'});
  const first=await searchKnowledge(store,p,'renovar sessão',{semantic:false,budget:1600});
  assert.ok(first.results.length>0&&first.results.length<=2);
  assert.equal(first.results[0].parent_id,row.id);
  assert.match(first.results[0].content,/Não renovar/);
  const again=await searchKnowledge(store,p,'renovar sessão',{semantic:false,budget:3000,mode:'raw'});
  assert.equal(again.search.cache_hit,true);
  assert.equal(again.results[0].truncated,false);
  assert.ok(estimateTokens(JSON.stringify(again))<=3000);
  const ref=store.get(p,first.results[0].id);assert.equal(ref.parent_id,row.id);
  assert.throws(()=>store.write({projectId:p,id:ref.id,expectedRevision:1,kind:'spec',title:'Clonar',content:'Não permitido'}),/parent_id/);
  assert.throws(()=>store.get(other.id,ref.id),/neste projeto/);
  store.write({projectId:p,id:row.id,expectedRevision:1,kind:'spec',title:'Acesso',content:'Nova política de acesso.'});
  const changed=await searchKnowledge(store,p,'renovar sessão',{semantic:false});
  assert.equal(changed.search.cache_hit,false);assert.equal(changed.results.length,0);
  assert.equal((await searchKnowledge(store,p,'" OR * )',{semantic:false})).results.length,0);
});

test('fusão semântica recupera conceito sem termo exato e filtra projetos/estados antes do ranking',async t=>{
  const {store,project}=await fixture(t),p=project.id;
  const auth=store.write({projectId:p,kind:'spec',title:'Sessões',content:'Login seguro com autenticação e renovação de sessão.'});
  store.write({projectId:p,kind:'spec',title:'Financeiro',content:'Pedidos, cobrança e recebimentos.'});
  store.write({projectId:p,kind:'decision',title:'Antiga',content:'Login seguro com autenticação antiga.',status:'superseded'});
  store.setting('semantic',{enabled:true,model:'fixture-embedding',dimensions:2});
  const embedder=async(_,texts,options)=>texts.map(text=>options?.query?[1,0]:/Login/.test(text)?[1,0]:[0,1]);
  const indexed=await indexEmbeddings(store,p,{embedder});assert.equal(indexed.indexed,3);
  const result=await searchKnowledge(store,p,'como proteger entrada',{embedder});
  assert.equal(result.results[0].parent_id,auth.id);
  assert.ok(result.search.channels.includes('semantic'));
  assert.equal(result.results.length,1);
  const second=await indexEmbeddings(store,p,{embedder});assert.equal(second.indexed,0);
});

test('falha de embeddings mantém evidência lexical e não persiste falha em cache',async t=>{
  const {store,project}=await fixture(t),p=project.id;
  store.write({projectId:p,kind:'spec',title:'Login',content:'Renovar sessão com login.'});
  store.setting('semantic',{enabled:true,model:'fixture',dimensions:2});
  await indexEmbeddings(store,p,{embedder:async()=>[[1,0]]});
  const result=await searchKnowledge(store,p,'login',{embedder:async()=>{throw new Error('modelo indisponível');}});
  assert.ok(result.results.length);assert.match(result.search.warnings[0],/indisponível/);
  const recovered=await searchKnowledge(store,p,'login',{embedder:async()=>[[1,0]]});
  assert.equal(recovered.search.cache_hit,false);assert.equal(recovered.search.warnings.length,0);
});

test('reranking recusa candidatos fracos e preserva símbolo exato mesmo com score semântico baixo',async t=>{
  const {store,project}=await fixture(t),p=project.id;
  store.write({projectId:p,kind:'spec',title:'Implementação',content:'A função renewSession atualiza a conta.'});
  store.setting('semantic',{enabled:true,model:'fixture',dimensions:2,reranker:{enabled:true,min_score:0.004,min_similarity:0.83,max_candidates:24}});
  await indexEmbeddings(store,p,{embedder:async()=>[[1,0]]});
  const unknown=await searchKnowledge(store,p,'fotossíntese tropical',{embedder:async()=>[[0.75,Math.sqrt(1-0.75**2)]],reranker:async()=>[0.0001]});
  assert.equal(unknown.results.length,0);
  const exact=await searchKnowledge(store,p,'renewSession',{embedder:async()=>[[0.75,Math.sqrt(1-0.75**2)]],reranker:async()=>[0.0001]});
  assert.equal(exact.results.length,1);assert.equal(exact.results[0].retrieval.exact_match,true);
});
