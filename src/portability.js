import { backup, DatabaseSync } from 'node:sqlite';
import { open, unlink, mkdir, realpath, readdir, copyFile, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { constants } from 'node:fs';
import { hash, now, RECORD_KINDS } from './store.js';
import { assertSafeMemory, readBounded } from './safety.js';
import { validateAnswers } from './questions.js';

export function exportProject(store,projectId) {
  return store.transaction(()=>{
    const project=store.project(projectId);
    const records=store.db.prepare('SELECT * FROM records WHERE project_id=? AND source_path IS NULL ORDER BY id').all(projectId);
    const ids=new Set(records.map(row=>row.id));
    const data={format:'app-memory-project',format_version:1,exported_at:now(),project,records,
      history:store.db.prepare('SELECT * FROM history WHERE project_id=? ORDER BY sequence').all(projectId).filter(row=>ids.has(row.record_id)).map(({sequence,...row})=>row),
      memory_keys:store.db.prepare('SELECT * FROM memory_keys WHERE project_id=?').all(projectId),
      task_checkpoints:store.db.prepare('SELECT * FROM task_checkpoints WHERE project_id=?').all(projectId),
      task_handoffs:store.db.prepare('SELECT * FROM task_handoffs WHERE project_id=?').all(projectId),
      relations:store.db.prepare('SELECT * FROM relations WHERE project_id=?').all(projectId).filter(row=>ids.has(row.source_id)&&ids.has(row.target_id)),
      derived_sources_included:false,next:'Código e fontes permanecem no repositório. Após importar com a nova raiz, executar project_index.'};
    return {...data,checksum:hash(JSON.stringify(data))};
  });
}

export async function writeExport(store,projectId,path) {
  const data=exportProject(store,projectId);
  const handle=await open(resolve(path),'wx');
  try{await handle.writeFile(JSON.stringify(data,null,2)+'\n','utf8');}finally{await handle.close();}
  return {path:resolve(path),records:data.records.length,history:data.history.length,checksum:data.checksum};
}

export async function importProject(store,path,root) {
  const text=await readBounded(resolve(path),50_000_000);
  const parsed=JSON.parse(text),{checksum,...data}=parsed;
  if(data.format!=='app-memory-project'||data.format_version!==1||checksum!==hash(JSON.stringify(data))) throw new Error('Exportação inválida ou checksum divergente.');
  if(!Array.isArray(data.records)||data.records.length>20000||!Array.isArray(data.history)||data.history.length>100000) throw new Error('Quantidade de registros inválida.');
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const project=data.project;
  if(!uuid.test(project?.id)||typeof project.name!=='string'||!project.name.trim()||project.name.length>120) throw new Error('Identidade de projeto inválida.');
  validateAnswers(project.answers,'existing');
  const canonical=await realpath(root);
  if(!(await lstat(canonical)).isDirectory()) throw new Error('A raiz importada precisa ser uma pasta.');
  const ids=new Set();
  for(const row of data.records) {
    if(!uuid.test(row.id)||ids.has(row.id)||row.project_id!==project.id||!RECORD_KINDS.includes(row.kind)||row.source_path!==null||typeof row.title!=='string'||!row.title.trim()||row.title.length>240||typeof row.status!=='string'||typeof row.updated_at!=='string'||typeof row.content!=='string'||Buffer.byteLength(row.content)>128000||!Number.isInteger(row.revision)||row.revision<1) throw new Error('Registro inválido na exportação.');
    assertSafeMemory(row.title+'\n'+row.content);ids.add(row.id);
  }
  for(const row of data.history) {
    if(row.project_id!==project.id||!ids.has(row.record_id)||typeof row.snapshot!=='string'||Buffer.byteLength(row.snapshot)>150000) throw new Error('Histórico inválido.');
    assertSafeMemory(row.snapshot);
    const snapshot=JSON.parse(row.snapshot);
    if(snapshot.project_id!==project.id||snapshot.id!==row.record_id||typeof snapshot.content!=='string')throw new Error('Snapshot histórico fora do projeto.');
    assertSafeMemory(snapshot.content);
  }
  for(const name of ['memory_keys','task_checkpoints','task_handoffs','relations']) if(!Array.isArray(data[name])) throw new Error('Vínculos inválidos.');
  for(const row of [...data.memory_keys,...data.task_checkpoints,...data.task_handoffs]) {
    if(row.project_id!==project.id||!ids.has(row.record_id)||(row.task_id&&!ids.has(row.task_id))) throw new Error('Vínculo fora do projeto.');
  }
  for(const row of data.memory_keys) if(!['patterns','notes'].includes(row.namespace)||typeof row.key!=='string'||row.key.length>160) throw new Error('Namespace/chave inválidos.');
  for(const row of data.relations) if(row.project_id!==project.id||!ids.has(row.source_id)||!ids.has(row.target_id)) throw new Error('Relação fora do projeto.');
  return store.transaction(()=>{
    if(store.db.prepare('SELECT id FROM projects WHERE id=? OR root=?').get(project.id,canonical)) throw new Error('Projeto ou raiz já existente. Importe em outra base; mesclagem automática não é permitida.');
    store.db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run(project.id,project.name,canonical,'existing',JSON.stringify(project.answers),now());
    store.db.prepare('INSERT INTO project_revisions VALUES(?,?)').run(project.id,1);
    for(const row of data.records) {
      if(store.db.prepare('SELECT id FROM records WHERE id=?').get(row.id)) throw new Error('ID de memória já existe nesta base.');
      store.db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?,?,?,?,?)').run(row.id,project.id,row.kind,row.title,row.content,row.status,null,null,row.revision,row.updated_at);
      store.syncDerived(row);
    }
    for(const row of data.history) store.db.prepare('INSERT INTO history(record_id,project_id,revision,snapshot,created_at) VALUES(?,?,?,?,?)').run(row.record_id,project.id,row.revision,row.snapshot,row.created_at);
    for(const row of data.records) store.audit(row);
    for(const row of data.memory_keys) store.db.prepare('INSERT INTO memory_keys VALUES(?,?,?,?)').run(project.id,row.namespace,row.key,row.record_id);
    for(const row of data.task_checkpoints) store.db.prepare('INSERT INTO task_checkpoints VALUES(?,?,?)').run(project.id,row.task_id,row.record_id);
    for(const row of data.task_handoffs) store.db.prepare('INSERT INTO task_handoffs VALUES(?,?,?)').run(project.id,row.task_id,row.record_id);
    for(const row of data.relations) store.db.prepare('INSERT INTO relations VALUES(?,?,?,?)').run(project.id,row.source_id,row.target_id,row.relation);
    return {project:store.project(project.id),records:data.records.length,history:data.history.length,next:'Execute project_index para atualizar o código e os documentos da nova raiz.'};
  });
}

export async function backupStore(store,path) {
  const target=resolve(path),handle=await open(target,'wx');await handle.close();
  try { await backup(store.db,target); }
  catch(error){await unlink(target).catch(()=>{});throw error;}
  return {path:target,format:'sqlite-snapshot',consistent:true,models_included:false};
}

export async function restoreStore(source,directory) {
  const target=resolve(directory);
  await mkdir(target,{recursive:true});
  if((await readdir(target)).length) throw new Error('Restauração exige pasta de destino vazia.');
  const db=new DatabaseSync(resolve(source),{readOnly:true});
  try {
    if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok') throw new Error('Backup SQLite inválido.');
    const version=db.prepare('PRAGMA user_version').get().user_version;
    if(version<1||version>3||!db.prepare("SELECT name FROM sqlite_master WHERE name='projects'").get()) throw new Error('Backup incompatível.');
  }finally{db.close();}
  await copyFile(resolve(source),join(target,'memory.sqlite'),constants.COPYFILE_EXCL);
  return {directory:target,restored:true,next:'Execute doctor para verificar a base. Modelos semânticos podem ser preparados novamente.'};
}
