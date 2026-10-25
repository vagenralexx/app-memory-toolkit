import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/store.js';
import { registerProject,indexProject } from '../src/projects.js';
import { updateProject,onboardingState } from '../src/analysis.js';
import { proposePatch,validatePatch,applyPatch,analyzeDrift } from '../src/reconciliation.js';
import { exportProject,writeExport,importProject,backupStore,restoreStore } from '../src/portability.js';
import { memoryStore,checkpoint,handoff,resume } from '../src/lifecycle.js';

async function fixture(t) {
  const root=await mkdtemp(join(process.env.APP_MEMORY_TEST_TMP??tmpdir(),'app-memory-governance-'));
  const app=join(root,'app');await mkdir(app);
  const store=new Store(join(root,'memory'));t.after(()=>store.close());
  const project=await registerProject(store,{name:'Base',root:app,mode:'existing'});
  return {root,app,store,project};
}

test('análise do app separa dependência declarada de execução e permite completar briefing com revisão',async t=>{
  const {store,project,app}=await fixture(t);
  await writeFile(join(app,'package.json'),JSON.stringify({name:'fixture',dependencies:{react:'19.0.0'},scripts:{test:'node --test'}}));
  await writeFile(join(app,'main.ts'),'export function login() {}');
  const inventory=await indexProject(store,project.id);
  assert.equal(inventory.analysis.languages.TypeScript,1);
  assert.equal(inventory.analysis.declared_technologies[0].classification,'dependency_declared_not_execution');
  assert.equal(inventory.analysis.execution_verified,false);
  assert.equal(onboardingState(store,project.id).missing_required.length,4);
  const updated=await updateProject(store,project.id,{expectedRevision:1,answers:{purpose:'Organizar dados'}});
  assert.equal(updated.revision,2);assert.equal(updated.answers.purpose,'Organizar dados');
  await assert.rejects(updateProject(store,project.id,{expectedRevision:1,answers:{purpose:'Obsoleto'}}),/Conflito/);
  assert.equal((await readFile(join(app,'main.ts'),'utf8')),'export function login() {}');
});

test('proposta de reconciliação exige fonte vigente, não escreve na prévia e aplica trecho com backup',async t=>{
  const {store,project,app,root}=await fixture(t),path=join(app,'guide.md');
  const original='# Guia\nFluxo antigo.\nPreservar esta linha.';
  await writeFile(path,original);await indexProject(store,project.id);
  const proposal=await proposePatch(store,{projectId:project.id,path:'guide.md',before:'Fluxo antigo.',after:'Fluxo revisado.',reason:'Confirmado pelo responsável.'});
  assert.equal((await validatePatch(store,project.id,proposal.id)).valid,true);
  assert.equal((await applyPatch(store,project.id,proposal.id)).dry_run,true);
  assert.equal(await readFile(path,'utf8'),original);
  const applied=await applyPatch(store,project.id,proposal.id,{apply:true});
  assert.equal(await readFile(applied.backup_path,'utf8'),original);
  assert.equal(await readFile(path,'utf8'),original.replace('antigo','revisado'));
  assert.equal((await analyzeDrift(store,project.id)).results[0].state,'SOURCE_CHANGED');
  assert.equal((await validatePatch(store,project.id,proposal.id)).valid,false);
  await writeFile(join(app,'ADR-001.md'),'Decisão');
  await assert.rejects(proposePatch(store,{projectId:project.id,path:'ADR-001.md',before:'Decisão',after:'Outra',reason:'Teste'}),/ADRs/);
  await writeFile(join(root,'outside.md'),'Fora');
  await assert.rejects(proposePatch(store,{projectId:project.id,path:'../outside.md',before:'Fora',after:'Mudou',reason:'Teste'}),/fora da pasta/);
});

test('alteração concorrente da fonte invalida patch e preserva o texto do usuário',async t=>{
  const {store,project,app}=await fixture(t);await writeFile(join(app,'readme.md'),'Antes');
  const proposal=await proposePatch(store,{projectId:project.id,path:'readme.md',before:'Antes',after:'Depois',reason:'Atualização'});
  await writeFile(join(app,'readme.md'),'Edição concorrente');
  await assert.rejects(applyPatch(store,project.id,proposal.id,{apply:true}),/Fonte mudou/);
  assert.equal(await readFile(join(app,'readme.md'),'utf8'),'Edição concorrente');
});

test('exportação/importação preserva tarefas, memória, histórico e retomada sem copiar o código',async t=>{
  const {store,project,app,root}=await fixture(t),p=project.id;
  await writeFile(join(app,'code.js'),'export const unrelated = 1;');await indexProject(store,p);
  const task=store.write({projectId:p,kind:'task',title:'Continuar',content:JSON.stringify({acceptance:['Validar'],priority:'P1'}),status:'in_progress'});
  checkpoint(store,{project_id:p,task_id:task.id,summary:'Estado',next_action:'Validar'});
  handoff(store,{project_id:p,task_id:task.id,goal:'Continuar',status:'in_progress',next_action:'Validar'});
  memoryStore(store,{project_id:p,namespace:'patterns',key:'retry',value:'Repetir após autenticar.',evidence:['Relato verificado'],status:'evidence_reported',applicability:'Sessões'});
  const exported=exportProject(store,p);assert.ok(exported.records.every(row=>row.source_path===null));
  const path=join(root,'project.json');await writeExport(store,p,path);
  const target=new Store(join(root,'imported'));t.after(()=>target.close());
  const otherApp=join(root,'relocated');await mkdir(otherApp);
  const imported=await importProject(target,path,otherApp);assert.equal(imported.project.id,p);
  assert.equal(target.project(p).root,await realpath(otherApp));
  assert.equal(resume(target,p,task.id).task.title,'Continuar');
  assert.ok(target.db.prepare('SELECT count(*) AS n FROM history').get().n>=exported.history.length);
  await assert.rejects(importProject(target,path,otherApp),/já existente/);
  const corrupted=JSON.parse(await readFile(path,'utf8'));corrupted.project.name='Corrompido';
  await writeFile(join(root,'bad.json'),JSON.stringify(corrupted));
  await assert.rejects(importProject(target,join(root,'bad.json'),otherApp),/checksum/);
});

test('backup consistente e restauração em destino vazio recuperam a base e recusam sobrescrita',async t=>{
  const {store,project,root}=await fixture(t);
  const row=store.write({projectId:project.id,kind:'learning',title:'Backup',content:'Conhecimento preservado'});
  const path=join(root,'backup.sqlite');await backupStore(store,path);
  await assert.rejects(backupStore(store,path),/EEXIST/);
  const directory=join(root,'restored');await restoreStore(path,directory);
  const restored=new Store(directory);t.after(()=>restored.close());
  assert.equal(restored.get(project.id,row.id).content,'Conhecimento preservado');
  await assert.rejects(restoreStore(path,directory),/vazia/);
});

test('segredos óbvios são recusados antes de qualquer gravação canônica',async t=>{
  const {store,project}=await fixture(t);
  assert.throws(()=>store.write({projectId:project.id,kind:'research',title:'Credencial',content:'password = "real-long-credential"'}),/segredo/);
  assert.equal(store.list(project.id,'research').length,0);
});
