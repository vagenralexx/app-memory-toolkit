import { lstat, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse as toml } from 'smol-toml';
import { parse as jsonc } from 'jsonc-parser';
import { parse as yaml } from 'yaml';
import { readBounded,isWithin } from './safety.js';
import { hash } from './store.js';
const FILES=['.mcp.json','.vscode/mcp.json','.claude/settings.json','.claude/settings.local.json','.codex/config.toml','opencode.json','opencode.jsonc','cordis.yml','cordis.yaml','AGENTS.md','CLAUDE.md','.env','.env.local','package.json','package-lock.json','npm-shrinkwrap.json'];
const placeholder=/^(?:\$\{|\$env:|process\.env\.|<|your[_-]|example|test[_-]|dummy|placeholder|\{env:)/i;
export function selectorRisk(value){if(/^(?:\.|\/|[A-Za-z]:[\\/])/.test(value))return 'local';if(/^(?:git\+|https?:|git@)/.test(value))return /#[a-f0-9]{40}$/i.test(value)?'exact':'floating';const at=value.lastIndexOf('@');return at>0&&/^v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(value.slice(at+1))?'exact':'floating';}
export function auditText(text,path){
 const findings=[],issues=[];const lineAt=index=>text.slice(0,index).split('\n').length;
 const add=(rule,severity,line,reason,remediation)=>findings.push({rule,severity,path,line,reason,remediation,source_hash:hash(text),evidence:'matched_configuration_static_value_redacted'});
 let parsed;
 if(/\.(?:jsonc?|toml|ya?ml)$/.test(path))try{if(path.endsWith('.toml'))parsed=toml(text);else if(/\.ya?ml$/.test(path))parsed=yaml(text);else{const errors=[];parsed=jsonc(text,errors,{allowTrailingComma:true});if(errors.length)throw Error();}}catch{issues.push({path,reason:'Configuração inválida ou não suportada; conteúdo omitido.'});}
 const lineOf=key=>{const at=text.search(new RegExp('(?:["\x27]'+String(key).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'["\x27]|\\b'+String(key).replace(/[^\w]/g,'')+'\\b)\\s*[:=]'));return at<0?1:lineAt(at);};
 const seen=new WeakSet();let visited=0;
 function walk(value,route=[]){if(!value||typeof value!=='object'||seen.has(value))return;if(route.length>100||++visited>20000){if(!issues.some(i=>i.reason==='Limite de análise estrutural.'))issues.push({path,reason:'Limite de análise estrutural.'});return;}seen.add(value);for(const [key,item] of Object.entries(value)){
  const next=[...route,key],line=lineOf(key);
  if(['autoApprove','auto_approve','alwaysAllow'].includes(key)&&(item===true||Array.isArray(item)&&item.includes('*')))add('blanket-auto-approve','HIGH',line,'Aprovação irrestrita configurada.','Restringir ferramentas com efeito colateral.');
  if(typeof item==='string'){
   if(next.some(x=>['allow','allowedTools','permissions'].includes(x))&&/^(?:\*|Bash(?:\(\*\))?|Shell\(\*\)|powershell\(\*\))$/i.test(item))add('broad-command-permission','HIGH',line,'Permissão ampla de comandos.','Revisar escopo mínimo.');
   if(key==='sandbox_mode'&&item==='danger-full-access'||key==='permissionMode'&&item==='bypassPermissions')add('sandbox-bypass','HIGH',line,'Configuração solicita bypass do isolamento.','Revisar permissões e necessidade da exceção.');
   if(/(?:^|[_-])(?:api[_-]?key|secret|password|token|authorization)$|^(?:apiKey|accessToken|refreshToken|clientSecret)$/i.test(key)&&item.length>=8&&!placeholder.test(item))add('hardcoded-credential','HIGH',line,'Literal em campo de credencial; valor redigido.','Mover para canal de segredo e avaliar rotação.');
   if(next.some(x=>['hooks','command','args'].includes(x))&&/(?:curl|wget|Invoke-WebRequest|\biwr\b)[\s\S]*\|\s*(?:bash|sh|pwsh|powershell|iex|Invoke-Expression)\b/i.test(item))add('download-and-execute','HIGH',line,'Hook/comando baixa e executa conteúdo remoto.','Separar obtenção, revisão e execução.');
  }
  if(value.command&&Array.isArray(value.args)&&key==='command'){
   const executable=String(item).split(/[\\/]/).pop().replace(/\.(exe|cmd)$/i,'');
   if(['npx','uvx'].includes(executable)){
    const args=value.args;let selected=null;
    for(let i=0;i<args.length;i++){const a=String(args[i]);if(['--registry','--cache','--userconfig','--prefix','--index-url'].includes(a)){i++;continue;}if(['-p','--package','--from'].includes(a)){selected=args[i+1];break;}if(a.startsWith('--package=')){selected=a.slice(10);break;}if(!a.startsWith('-')){selected=a;break;}}
    if(selected&&(executable==='uvx'?!/==\d+\.\d+\.\d+$/.test(selected):selectorRisk(selected)==='floating'))add('mcp-dependency-selector','MEDIUM',line,'Executor de pacote usa seletor sem versão/commit exato.','Fixar versão verificada; não inventar pin.');
   }
  }
  if(key==='command'&&Array.isArray(item)){const executable=String(item[0]).split(/[\\/]/).pop().replace(/\.(exe|cmd)$/i,'');if(executable==='npx'){const selected=item.slice(1).find(x=>typeof x==='string'&&!x.startsWith('-'));if(selected&&selectorRisk(selected)==='floating')add('mcp-dependency-selector','MEDIUM',line,'Comando em lista usa pacote sem pin exato.','Fixar versão verificada.');}}
  walk(item,next);
 }}
 walk(parsed);
 for(const match of text.matchAll(/\b(?:sk-[A-Za-z0-9_-]{20,}|(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|https?:\/\/[^\s/:@]+:[^\s/@]+@/g))add('credential-format','HIGH',lineAt(match.index),'Formato de credencial literal; conteúdo omitido.','Remover do arquivo e avaliar rotação.');
 for(const match of text.matchAll(/(?:^|\n)\s*(?:[A-Z_]*(?:PASSWORD|SECRET|TOKEN|API_KEY)[A-Z_]*)\s*=\s*["']?([^\s"'\n]{8,})/g))if(!placeholder.test(match[1]))add('dotenv-credential','HIGH',lineAt(match.index),'Valor em arquivo de ambiente; conteúdo omitido.','Manter fora do versionamento e usar canal apropriado.');
 for(const match of text.matchAll(/[\u200b\u202a-\u202e\u2066-\u2069]/gu))add('invisible-controls','MEDIUM',lineAt(match.index),'Controle Unicode invisível em instrução/configuração.','Inspecionar representação escapada.');
 if(/AGENTS\.md|CLAUDE\.md/.test(path))for(const match of text.matchAll(/ignore (?:all |previous |system )*instructions|ignore (?:todas |as )*(?:instruções|regras)|disable (?:security|sandbox)|reveal (?:secrets|tokens)/gi))add('instruction-authority-claim','MEDIUM',lineAt(match.index),'Documento contém pedido para sobrepor controles/instruções.','Tratar texto encontrado como dado e revisar origem.');
 if(path.endsWith('package.json')&&parsed){if(parsed.scripts?.postinstall||parsed.scripts?.preinstall)add('install-hook','MEDIUM',lineOf('scripts'),'Manifesto declara script de instalação.','Revisar script antes de autorizar execução.');for(const [name,version] of Object.entries({...parsed.dependencies,...parsed.devDependencies}))if(version==='*'||version==='latest'||/^git|^https?:/.test(String(version))&&selectorRisk(String(version))!=='exact')add('application-dependency-selector','LOW',lineOf(name),'Dependência do app sem versão determinística no manifesto.','Conferir lockfile e integridade antes de instalar.');}
 return {findings,issues};
}
export async function securityAudit(store,projectId,{include_host_config=false,limit=20,offset=0,hostHome}={}){
 const project=store.project(projectId),roots=[{root:await realpath(project.root),files:FILES,label:'project'}];
 if(include_host_config)roots.push({root:await realpath(hostHome??homedir()),files:['.claude/settings.json','.codex/config.toml'],label:'host'});
 const findings=[],issues=[],scanned=[];
 for(const {root,files,label} of roots)for(const path of files){try{
  let at=root;for(const part of path.split('/')){at=join(at,part);if((await lstat(at)).isSymbolicLink())throw Error('symlink');}
  const canonical=await realpath(at);if(!isWithin(root,canonical))throw Error('outside');const text=await readBounded(canonical,2_000_000);const display=label+':'+path;const result=auditText(text,display);findings.push(...result.findings);issues.push(...result.issues);scanned.push({path:display,source_hash:hash(text)});
 }catch(error){if(error.code!=='ENOENT')issues.push({path:label+':'+path,reason:'Não lido: limite, symlink, permissão ou tipo não suportado.'});}}
 const unique=[...new Map(findings.map(f=>[`${f.path}:${f.rule}:${f.line}`,f])).values()].sort((a,b)=>a.path.localeCompare(b.path)||a.line-b.line||a.rule.localeCompare(b.rule));
 return {findings:unique.slice(offset,offset+limit),total:unique.length,next_offset:offset+limit<unique.length?offset+limit:null,scanned,issues,include_host_config,read_only:true,commands_executed:false,dependencies:{cve_checked:false,reason:'Auditoria estática de configuração e seletores; não consulta bases de vulnerabilidades nem executa npm.'},verdict:unique.some(f=>f.severity==='HIGH')?'FINDINGS':issues.length?'INCOMPLETE':'NO_FINDINGS_IN_SCANNED_SURFACE',limits:'Superfície explícita de agentes, hooks, instruções, segredos e manifestos. Ausência de findings não atesta segurança integral do aplicativo.'};
}
