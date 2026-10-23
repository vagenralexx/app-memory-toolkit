import { readFile, mkdir, lstat, realpath, open, rename, unlink } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parse as parseToml } from 'smol-toml';
import { parse as parseJsonc, modify, applyEdits } from 'jsonc-parser';
import { parseDocument, parse as parseYaml } from 'yaml';
import { clientConfig } from './integrations.js';
import { hash } from './store.js';
import { readBounded, isWithin } from './safety.js';

function pluginPath(value,path=[]) {
  if(Array.isArray(value)&&value.some(item=>item&&typeof item==='object'&&item.name==='@deepseek-ai/dsh-mcp-client')) return path;
  if(value&&typeof value==='object') for(const [key,item] of Object.entries(value)) { const found=pluginPath(item,[...path,Array.isArray(value)?Number(key):key]);if(found)return found; }
  return null;
}

export async function connectClient(store,client,{root,configPath,cli,apply=false}={}) {
  if(!['codex','claude-code','opencode','opencode-v1','deepseek-harness'].includes(client)) throw new Error('Selecione um cliente compatível.');
  if(!root&&!configPath) throw new Error('Informe --root para configuração de projeto ou --config para um arquivo específico.');
  if(client==='deepseek-harness'&&!configPath) throw new Error('DeepSeek Harness exige --config com o caminho explícito do perfil Cordis.');
  const target=resolve(configPath??join(root,client==='codex'?'.codex/config.toml':client==='claude-code'?'.mcp.json':'opencode.jsonc'));
  let original='',exists=false;
  try {const stat=await lstat(target);if(stat.isSymbolicLink()||!stat.isFile())throw new Error('Configuração precisa ser arquivo regular.');original=await readBounded(target,2_000_000);exists=true;}
  catch(error){if(error.code!=='ENOENT')throw error;}
  if(root&&!configPath) {
    const canonicalRoot=await realpath(root);
    let ancestor=dirname(target);
    while(true){try{const canonical=await realpath(ancestor);if(!isWithin(canonicalRoot,canonical))throw new Error('Configuração do projeto aponta para fora da raiz.');break;}catch(error){if(error.code!=='ENOENT')throw error;ancestor=dirname(ancestor);}}
  }
  const generated=clientConfig(client,{cli,directory:store.directory});
  let updated,previous,newEntry;
  if(client==='codex') {
    const parsed=original.trim()?parseToml(original):{};
    previous=parsed.mcp_servers?.['app-memory'];newEntry=parseToml(generated).mcp_servers['app-memory'];
    updated=original+(original.endsWith('\n')||!original?'':'\n')+'\n'+generated;
  } else if(client==='deepseek-harness') {
    const doc=parseDocument(original||'plugins: []\n');
    if(doc.errors.length)throw new Error('YAML do perfil inválido; nenhuma alteração aplicada.');
    const path=pluginPath(doc.toJS())??['plugins'];
    newEntry=parseYaml(generated)[0];
    const existing=doc.getIn(path,true);
    if(existing&&!Array.isArray(existing.toJSON())) throw new Error('Lista de plugins do perfil não reconhecida. Use o trecho exportado para adaptação manual.');
    const list=existing?.toJSON()??[];
    previous=list.find(item=>item.id==='mcp-app-memory');
    if(!existing)doc.setIn(path,[]);
    if(!previous)doc.addIn(path,newEntry);
    updated=doc.toString();
  } else {
    const errors=[],parsed=parseJsonc(original||'{}',errors,{allowTrailingComma:true,disallowComments:false});
    if(errors.length||!parsed||Array.isArray(parsed))throw new Error('Configuração JSON/JSONC inválida.');
    const path=client==='claude-code'?['mcpServers','app-memory']:client==='opencode'?['mcp','servers','app-memory']:['mcp','app-memory'];
    previous=path.reduce((value,key)=>value?.[key],parsed);
    newEntry=path.reduce((value,key)=>value[key],generated);
    if(client==='opencode'&&Object.values(parsed.mcp??{}).some(value=>value&&typeof value==='object'&&['local','remote'].includes(value.type)))throw new Error('Foi encontrado formato OpenCode V1. Use --client opencode-v1.');
    if(client==='opencode-v1'&&parsed.mcp?.servers)throw new Error('Foi encontrado formato OpenCode V2. Use --client opencode.');
    updated=applyEdits(original||'{}',modify(original||'{}',path,newEntry,{formattingOptions:{insertSpaces:true,tabSize:2,eol:'\n'}}));
  }
  if(previous) {
    const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value;
    const normalize=value=>JSON.stringify(ordered(value));
    if(normalize(previous)===normalize(newEntry))return {target,client,already_configured:true,changed:false};
    throw new Error('Já existe uma conexão app-memory diferente. Ela não será sobrescrita; remova/reconcilie essa entrada explicitamente.');
  }
  const result={target,client,changed:false,dry_run:!apply,entry:newEntry,preserves_existing_servers:true,source_hash:hash(original)};
  if(!apply)return result;
  await mkdir(dirname(target),{recursive:true});
  if(exists) {
    if(hash(await readBounded(target,2_000_000))!==hash(original))throw new Error('Configuração mudou após a prévia.');
    const backups=join(store.directory,'config-backups');await mkdir(backups,{recursive:true});
    result.backup_path=join(backups,`${Date.now()}-${randomUUID()}.txt`);
    const backup=await open(result.backup_path,'wx');try{await backup.writeFile(original,'utf8');}finally{await backup.close();}
  }
  const temp=join(dirname(target),`.app-memory-${randomUUID()}.tmp`);
  try {
    const handle=await open(temp,'wx');try{await handle.writeFile(updated,'utf8');await handle.sync();}finally{await handle.close();}
    if(exists&&hash(await readBounded(target,2_000_000))!==hash(original))throw new Error('Configuração mudou antes de gravar.');
    if(!exists){try{await lstat(target);throw new Error('Configuração criada por outro processo.');}catch(error){if(error.code!=='ENOENT')throw error;}}
    await rename(temp,target);
  }catch(error){await unlink(temp).catch(()=>{});throw error;}
  return {...result,changed:true,next:'Recarregue a conexão/sessão no cliente e confira project_list. Nenhuma permissão ampla foi adicionada.'};
}
