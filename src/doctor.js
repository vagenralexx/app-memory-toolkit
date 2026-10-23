import { access, open, unlink, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { clientConfig, CLIENTS } from './integrations.js';
import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';
import { VERSION } from './version.js';

export async function doctor(store,{cli,projectId}={}) {
  const checks=[];
  const add=(name,ok,detail)=>checks.push({name,status:ok?'PASS':'FAIL',detail});
  add('node',Number(process.versions.node.split('.')[0])>=24,process.versions.node);
  const integrity=store.db.prepare('PRAGMA quick_check').get().quick_check;
  add('sqlite',integrity==='ok',integrity);
  const probe=join(store.directory,`.doctor-${randomUUID()}`);
  try{const handle=await open(probe,'wx');await handle.close();await unlink(probe);add('data_writable',true,store.directory);}catch(error){add('data_writable',false,error.code);}
  if(cli){try{await access(resolve(cli));add('entrypoint',true,resolve(cli));}catch{add('entrypoint',false,'Arquivo de entrada não encontrado.');}}
  for(const client of CLIENTS) {
    try {
      const config=clientConfig(client,{cli:cli??new URL('./cli.js',import.meta.url).pathname,directory:store.directory});
      if(client==='codex')parseToml(config);else if(client==='deepseek-harness')parseYaml(config);else JSON.parse(JSON.stringify(config));
      add(`config:${client}`,true,'Formato gerado e parseado; aplicativo final não foi iniciado.');
    }catch(error){add(`config:${client}`,false,error.message);}
  }
  const require=createRequire(import.meta.url);
  let installed=true;try{require.resolve('@huggingface/transformers');}catch{installed=false;}
  const semantic=store.setting('semantic')??{enabled:false};
  const weights=join(store.directory,'models','Xenova','multilingual-e5-small','onnx','model_quantized.onnx');
  let modelCached=false;try{modelCached=(await stat(weights)).size>1_000_000;}catch{}
  const project=projectId?store.project(projectId):null;
  if(project){try{const s=await stat(project.root);add('project_root',s.isDirectory(),project.root);}catch{add('project_root',false,project.root);}}
  return {version:VERSION,platform:process.platform,ok:checks.every(check=>check.status==='PASS'),checks,
    ready_modes:['lexical',...(installed&&modelCached&&semantic.enabled?['hybrid']:[])],
    semantic:{...semantic,runtime_installed:installed,weights_cached:modelCached,optional:true},
    project:projectId?store.health(projectId):undefined,
    limits:'Diagnóstico local. Não autentica clientes, não executa testes do app e não atesta segurança integral.'};
}
