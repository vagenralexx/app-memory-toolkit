import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,readdir,symlink } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/store.js';
import { setupClient } from '../src/setup.js';
import { startProject } from '../src/startup.js';
import { prepareProject } from '../src/organization.js';
import { registerProject } from '../src/projects.js';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
const answers={purpose:'Organizar pedidos',audience:'Lojistas',platforms:'Web',mvp:'Pedidos e clientes'};
async function fixture(t){const root=await mkdtemp(join(process.env.APP_MEMORY_TEST_TMP??tmpdir(),'app-memory-activation-'));const app=join(root,'app');await mkdir(app);const store=new Store(join(root,'data'));t.after(()=>store.close());return {root,app,store};}

test('setup instala conexão e ativação preservando instruções, com prévia, backup e idempotência',async t=>{
 const {app,store}=await fixture(t);await writeFile(join(app,'AGENTS.md'),'# Minhas regras\nPreservar a arquitetura.\n');await writeFile(join(app,'CLAUDE.md'),'# Contexto Claude\n');
 const options={root:app,cli:resolve('src/cli.js')};
 const preview=await setupClient(store,'claude-code',options);assert.equal(preview.dry_run,true);assert.equal(await readFile(join(app,'AGENTS.md'),'utf8'),'# Minhas regras\nPreservar a arquitetura.\n');assert.deepEqual((await readdir(app)).sort(),['AGENTS.md','CLAUDE.md']);
 const installed=await setupClient(store,'claude-code',{...options,apply:true});assert.equal(installed.instructions.length,2);assert.equal(await readFile(installed.instructions[0].backup_path,'utf8'),'# Minhas regras\nPreservar a arquitetura.\n');
 const content=await readFile(join(app,'AGENTS.md'),'utf8');assert.ok(content.startsWith('# Minhas regras'));assert.match(content,/start_project/);assert.match(await readFile(join(app,'CLAUDE.md'),'utf8'),/AGENTS.md/);
 assert.equal((await setupClient(store,'claude-code',{...options,apply:true})).instructions.length,0);
 const state=await startProject(store,{root:app});assert.equal(state.phase,'configured_workspace');assert.equal(state.project,null);
 const project=await registerProject(store,{name:'Novo app com configuração',root:app,mode:'existing',answers});
 const plan=await prepareProject(store,project.id);assert.equal(plan.dry_run,true);assert.ok(plan.files['docs/data/README.md']);assert.equal(plan.files['AGENTS.md'],undefined);assert.equal((await readdir(app)).includes('docs'),false);
 const applied=await prepareProject(store,project.id,{apply:true});assert.ok(applied.created.includes('APP_MEMORY.md'));assert.equal(await readFile(join(app,'AGENTS.md'),'utf8'),content);
 const again=await prepareProject(store,project.id,{apply:true});assert.equal(again.created.length,0);assert.ok(again.preserved.includes('APP_MEMORY.md'));
 assert.equal((await startProject(store,{root:app})).phase,'registered');
});
test('start distingue pasta vazia, ausente e app existente sem criar arquivos nem cadastrar',async t=>{
 const {app,store,root}=await fixture(t);
 assert.equal((await startProject(store,{root:app})).phase,'new');assert.equal((await startProject(store,{root:join(root,'ainda-nao-existe')})).root_exists,false);assert.equal(store.projects().length,0);
 await assert.rejects(startProject(store,{root:'relative'}),/absoluta/);
 await writeFile(join(app,'package.json'),JSON.stringify({name:'base',dependencies:{react:'19'}}));
 const state=await startProject(store,{root:app});assert.equal(state.phase,'existing');assert.equal(state.observed.declared_technologies[0].name,'React');assert.equal(state.observed.execution_verified,false);assert.equal(state.database.application.engine,'A decidir após requisitos e inventário');
 assert.ok(state.questions.some(q=>q.key==='dataModel'));assert.deepEqual(await readdir(app),['package.json']);assert.equal(store.projects().length,0);
});
test('bloco de instruções inválido é recusado antes de instalar conexão; preparação preserva docs existentes',async t=>{
 const {app,store}=await fixture(t);await writeFile(join(app,'AGENTS.md'),'<!-- app-memory:start -->\nIncompleto');
 await assert.rejects(setupClient(store,'codex',{root:app,cli:resolve('src/cli.js'),apply:true}),/inválido/);assert.deepEqual(await readdir(app),['AGENTS.md']);
 await mkdir(join(app,'docs'));await writeFile(join(app,'docs','specs'),'não é pasta');
 const project=await registerProject(store,{name:'Base',root:app,mode:'existing',answers});await assert.rejects(prepareProject(store,project.id),/Pasta de conhecimento/);assert.equal((await readdir(app)).includes('APP_MEMORY.md'),false);
});
test('MCP oferece entrada real start_project e preparação aditiva após onboarding', {timeout:30000},async t=>{
 const {app,root}=await fixture(t);await writeFile(join(app,'README.md'),'# Meu app existente');
 const client=new Client({name:'activation-tests',version:'1'});await client.connect(new StdioClientTransport({command:process.execPath,args:[resolve('src/cli.js'),'serve','--data',join(root,'mcp-data')],stderr:'pipe'}));t.after(()=>client.close());
 async function call(name,args){const r=await client.callTool({name,arguments:args});assert.ok(!r.isError,JSON.stringify(r));return JSON.parse(r.content[0].text);}
 assert.match(client.getInstructions(),/start_project/);assert.equal((await client.listTools()).tools.length,65);
 const state=await call('start_project',{root:app});assert.equal(state.phase,'existing');
 const project=await call('project_register',{name:'Base',root:app,mode:'existing',answers});
 const plan=await call('project_prepare',{project_id:project.id});assert.equal(plan.dry_run,true);
 await call('project_prepare',{project_id:project.id,apply:true});assert.equal(await readFile(join(app,'README.md'),'utf8'),'# Meu app existente');
 const registered=await call('start_project',{root:app});assert.equal(registered.project.id,project.id);assert.ok(registered.rules.base.length);
});
