import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { runWizard } from '../src/wizard.js';
import { questions } from '../src/questions.js';
import { Store } from '../src/store.js';

test('assistente cria app por perguntas, confirma prévia e salva contexto sem stack imposta',async()=>{
  const root=await mkdtemp(join(process.env.APP_MEMORY_TEST_TMP??tmpdir(),'app-memory-wizard-')),app=join(root,'app'),data=join(root,'memory');
  const replies=['','1','Meu app',app,...questions.map(q=>({purpose:'Organizar pedidos',audience:'Equipe',platforms:'Web',mvp:'Criar pedido'}[q.key]??'')),'s','0'];
  const outputs=[];
  await runWizard({directory:data,cli:resolve('src/cli.js'),ask:async()=>{assert.ok(replies.length);return replies.shift();},write:message=>outputs.push(message)});
  assert.match(await readFile(join(app,'APP_MEMORY.md'),'utf8'),/Organizar pedidos/);
  assert.match(await readFile(join(app,'CLAUDE.md'),'utf8'),/@AGENTS.md/);
  assert.ok(outputs.some(text=>text.includes('Estrutura criada')));
  const store=new Store(data);
  try{assert.equal(store.projects()[0].answers.platforms,'Web');assert.ok(store.list(store.projects()[0].id,'inventory').length);}finally{store.close();}
});
