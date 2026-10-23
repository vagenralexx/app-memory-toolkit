import { join, dirname, resolve } from 'node:path';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { safeFile, readBounded, assertSafeMemory } from './safety.js';
import { hash } from './store.js';
import { documentDrift } from './document-drift.js';
import { scanProject } from './projects.js';

async function codeFingerprint(store, project) {
  const scan=await scanProject(project.root,store.directory);
  return hash(scan.sources.filter(s=>s.kind==='code').map(s=>`${s.path}:${s.hash}`).join('\n'));
}

export async function analyzeDrift(store,projectId,{limit=30,offset=0}={}) {
  const project=store.project(projectId);
  const rows=store.db.prepare("SELECT * FROM records WHERE project_id=? AND source_path IS NOT NULL AND status!='removed' ORDER BY source_path LIMIT ? OFFSET ?").all(projectId,limit,offset);
  const results=[];
  for(const row of rows) {
    try {
      const file=await safeFile(project.root,join(project.root,row.source_path),{maxBytes:100000});
      const content=await readBounded(file.path,100000);
      const current=hash(content);
      results.push({id:row.id,path:row.source_path,state:current===row.source_hash?'CURRENT':'SOURCE_CHANGED',indexed_hash:row.source_hash,current_hash:current,
        action:current===row.source_hash?'none':'Reindexar; mudança de código não autoriza reescrever requisitos ou ADRs.'});
    }catch{results.push({id:row.id,path:row.source_path,state:'SOURCE_UNAVAILABLE',action:'Verificar caminho/permissões; não inferir recurso ausente só pela falha de leitura.'});}
  }
  const total=store.db.prepare("SELECT count(*) AS n FROM records WHERE project_id=? AND source_path IS NOT NULL AND status!='removed'").get(projectId).n;
  return {results,total,next_offset:offset+rows.length<total?offset+rows.length:null,semantic_consistency_verified:false,
    limits:'Detecta mudanças de fontes por hash. Não é um detector semântico completo de divergências entre requisitos e implementação.'};
}

export async function proposePatch(store,{projectId,path,before,after,reason,driftId}) {
  const project=store.project(projectId);
  if(!/\.md$/i.test(path)||/(^|\/|\\)(?:ADR[-_]|AGENTS\.md$|CLAUDE\.md$)/i.test(path)) throw new Error('Propostas automáticas são limitadas a Markdown comum. ADRs e regras de agentes precisam de edição humana explícita.');
  if(!before?.trim()||before===after||!reason?.trim()) throw new Error('Informe trecho atual, alteração e motivo.');
  assertSafeMemory(before+'\n'+after);
  const file=await safeFile(project.root,join(project.root,path));
  const content=await readBounded(file.path);
  if(content.split(before).length!==2) throw new Error('O trecho precisa existir exatamente uma vez na fonte atual.');
  let drift=null;
  if(driftId){
    let offset=0;
    do {const page=await documentDrift(store,projectId,{limit:100,offset});drift=page.items.find(item=>item.id===driftId);if(drift||page.next_offset===null)break;offset=page.next_offset;}while(offset<50000);
    if(!drift||drift.document!==path||!drift.patch_allowed||drift.classification!=='PATH_MOVED')throw new Error('Drift não permite patch automático localizado; exige revisão.');
    if(!before.includes(drift.reference.path)||!after.includes(drift.candidate))throw new Error('A alteração precisa corresponder ao caminho comprovadamente movido.');
  }
  const proposal={path,before,after,reason,base_hash:hash(content),classification:'PROPOSED_NOT_APPLIED',drift:drift?{id:drift.id,classification:drift.classification,candidate:drift.candidate}:null,code_fingerprint:drift?await codeFingerprint(store,project):null};
  const row=store.write({projectId,kind:'proposal',title:`Reconciliação: ${path}`,content:JSON.stringify(proposal),status:'proposed'});
  return {id:row.id,revision:row.revision,...proposal,next:'Use validate_knowledge_patch; aplicação somente pelo comando patch-apply --apply.'};
}

export async function validatePatch(store,projectId,id) {
  const row=store.get(projectId,id);
  if(row.kind!=='proposal') throw new Error('ID não é uma proposta.');
  const proposal=JSON.parse(row.content),project=store.project(projectId);
  const file=await safeFile(project.root,join(project.root,proposal.path));
  const content=await readBounded(file.path);
  const codeCurrent=!proposal.code_fingerprint||proposal.code_fingerprint===await codeFingerprint(store,project);
  const valid=row.status==='proposed'&&hash(content)===proposal.base_hash&&content.split(proposal.before).length===2&&codeCurrent;
  return {id,valid,path:proposal.path,base_hash:proposal.base_hash,current_hash:hash(content),applied:row.status==='applied',
    code_evidence_current:codeCurrent,reason:valid?'Fonte e trecho conferidos.':!codeCurrent?'Código mudou desde a proposta.':'Fonte mudou, trecho divergiu ou proposta já foi aplicada.',preview:valid?{before:proposal.before,after:proposal.after}:null};
}

export async function applyPatch(store,projectId,id,{apply=false}={}) {
  const check=await validatePatch(store,projectId,id);
  if(!check.valid) throw new Error(check.reason);
  if(!apply) return {...check,dry_run:true};
  const row=store.get(projectId,id),proposal=JSON.parse(row.content),project=store.project(projectId);
  const file=await safeFile(project.root,join(project.root,proposal.path));
  const content=await readBounded(file.path);
  if(hash(content)!==proposal.base_hash) throw new Error('Fonte mudou durante a validação.');
  if(proposal.code_fingerprint&&proposal.code_fingerprint!==await codeFingerprint(store,project))throw new Error('Código mudou durante a validação.');
  const backupDirectory=join(store.directory,'file-backups',projectId);
  await mkdir(backupDirectory,{recursive:true});
  const backupPath=join(backupDirectory,`${id}.md`);
  try{const backup=await open(backupPath,'wx');try{await backup.writeFile(content,'utf8');}finally{await backup.close();}}
  catch(error){if(error.code!=='EEXIST'||hash(await readBounded(backupPath))!==proposal.base_hash)throw error;}
  const temp=join(dirname(file.path),`.app-memory-${randomUUID()}.tmp`);
  try {
    const handle=await open(temp,'wx',file.stat.mode);
    try{await handle.writeFile(content.replace(proposal.before,proposal.after),'utf8');await handle.sync();}finally{await handle.close();}
    if(hash(await readBounded(file.path))!==proposal.base_hash) throw new Error('Fonte mudou antes de aplicar.');
    await rename(temp,file.path);
  }catch(error){await unlink(temp).catch(()=>{});throw error;}
  store.write({projectId,id:row.id,expectedRevision:row.revision,kind:'proposal',title:row.title,content:row.content,status:'applied'});
  return {id,applied:true,path:file.path,backup_path:backupPath,next:'Execute project_index para atualizar a fonte derivada.'};
}
