import * as z from 'zod/v4';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pack } from './store.js';
import { indexProject } from './projects.js';
import { updateProject, onboardingState } from './analysis.js';
import { indexEmbeddings, semanticSetup } from './semantic.js';
import { analyzeDrift, proposePatch, validatePatch } from './reconciliation.js';
import { writeExport, importProject, backupStore } from './portability.js';
import { doctor } from './doctor.js';
import { getRules } from './policy.js';
import { designGuidance } from './design-corpus.js';
import { architectureConflicts } from './architecture.js';
import { documentDrift } from './document-drift.js';
import { scanProject } from './projects.js';
import { parseCode } from './structure.js';

export function registerExtendedTools(tool,store) {
  const project=z.string().uuid(),budget=z.number().int().min(300).max(50000).default(2000);
  tool('project_update','Atualiza respostas, nome ou raiz explicitamente, com revisão do projeto. Não reescreve arquivos do app.',{
    project_id:project,expected_revision:z.number().int().positive(),name:z.string().min(1).max(120).optional(),root:z.string().min(1).optional(),answers:z.record(z.string(),z.string()).default({})
  },false,args=>updateProject(store,args.project_id,{expectedRevision:args.expected_revision,name:args.name,root:args.root,answers:args.answers}));
  tool('project_analyze','Atualiza inventário, linguagens, dependências declaradas, módulos e perguntas pendentes. Não executa o app nem assume decisões de produto.',{
    project_id:project
  },false,async args=>({inventory:await indexProject(store,args.project_id),onboarding:onboardingState(store,args.project_id)}));
  tool('onboarding_resume','Retorna perguntas e resumos das respostas pendentes. detail expande respostas; origens ficam referenciadas no inventário.',{project_id:project,detail:z.boolean().default(false)},true,args=>onboardingState(store,args.project_id,{detail:args.detail}));
  tool('semantic_setup','Baixa e prepara o modelo multilíngue fixo para embeddings locais. Só baixa pesos/configuração; não envia documentos. Operação explícita, opcional.',{},false,()=>semanticSetup(store));
  tool('semantic_index','Gera embeddings locais dos chunks pendentes do projeto. Exige semantic_setup prévio; não modifica o app.',{project_id:project},false,args=>indexEmbeddings(store,args.project_id));
  tool('get_module_context','Mostra módulos observados ou retorna contexto de um módulo específico. Informações indexadas não comprovam execução.',{
    project_id:project,module:z.string().max(300).optional(),budget
  },true,args=>{
    const modules=store.db.prepare('SELECT module,count(*) AS chunks FROM chunks WHERE project_id=? GROUP BY module ORDER BY module').all(args.project_id);
    store.project(args.project_id);
    if(!args.module)return {modules,next:'Escolha o módulo exato e use search_knowledge com module.'};
    const rows=store.db.prepare(`SELECT r.*,c.id,c.record_id AS parent_id,c.content,c.start_line,c.end_line,c.module,c.section FROM chunks c JOIN records r ON r.id=c.record_id
      WHERE c.project_id=? AND c.module=? AND r.status NOT IN ('removed','superseded','retired') ORDER BY c.title LIMIT 12`).all(args.project_id,args.module);
    return {...pack(rows,{budget:args.budget}),modules};
  });
  tool('get_dependency_context','Manifestos atuais, dependências declaradas e arquivos consumidores por imports sintáticos. Não afirma versão carregada ou CVEs.',{project_id:project,name:z.string().max(200).optional(),budget},true,async args=>{
    const project=store.project(args.project_id),scan=await scanProject(project.root,store.directory);
    const {analyzeSources}=await import('./analysis.js');const data=analyzeSources(scan.sources);
    return {manifests:data.manifests,dependencies:data.dependencies.filter(d=>!args.name||d.name===args.name).slice(0,80),consumers:args.name?scan.sources.flatMap(s=>parseCode({id:s.path,source_path:s.path,content:s.content}).imports.filter(spec=>spec===args.name||spec.startsWith(args.name+'/')).map(spec=>({path:s.path,specifier:spec,source_hash:s.hash}))).slice(0,100):[],verified_runtime:false,scan_complete:scan.complete,skipped:scan.skipped};
  });
  tool('check_architecture_conflicts','Avalia regras estruturadas contra fontes atuais e mudanças propostas; retorna conflitos com evidência e decisões relacionadas. Não aprova arquitetura por ausência de matches.',{
    project_id:project,intent:z.string().min(1).max(1000),budget,changes:z.object({dependencies:z.array(z.string()).max(100).default([]),paths:z.array(z.string()).max(100).default([]),imports:z.array(z.object({path:z.string(),specifier:z.string()})).max(100).default([])}).default({})
  },true,args=>architectureConflicts(store,args));
  tool('record_link','Liga duas referências canônicas do mesmo projeto, com relação explícita. Não altera estados silenciosamente.',{
    project_id:project,source_id:z.string().uuid(),target_id:z.string().uuid(),relation:z.enum(['depends_on','related_to','supersedes','implemented_by','verified_by'])
  },false,args=>{
    const source=store.get(args.project_id,args.source_id),target=store.get(args.project_id,args.target_id);
    const from=source.parent_id??source.id,to=target.parent_id??target.id;
    if(from===to)throw new Error('Relação precisa de duas referências diferentes.');
    store.db.prepare('INSERT OR IGNORE INTO relations VALUES(?,?,?,?)').run(args.project_id,from,to,args.relation);
    store.db.prepare('DELETE FROM retrieval_cache WHERE project_id=?').run(args.project_id);
    return {source_id:from,target_id:to,relation:args.relation,linked:true};
  });
  tool('find_related_knowledge','Expande relações explícitas nas duas direções, profundidade limitada e consultas inferidas opcionais marcadas como candidatas.',{
    project_id:project,id:z.string().uuid(),budget,depth:z.number().int().min(1).max(2).default(1),direction:z.enum(['outgoing','incoming','both']).default('outgoing'),include_inferred:z.boolean().default(false)
  },true,async args=>{
    const row=store.get(args.project_id,args.id),id=row.parent_id??row.id,seen=new Set([id]),links=[],rows=[];let frontier=[id];
    for(let depth=1;depth<=args.depth&&frontier.length;depth++){const next=[];for(const current of frontier){
      const edges=store.db.prepare('SELECT source_id,target_id,relation FROM relations WHERE project_id=? AND (source_id=? OR target_id=?) ORDER BY source_id,target_id,relation LIMIT 30').all(args.project_id,current,current);
      for(const edge of edges){const outgoing=edge.source_id===current;if(args.direction==='outgoing'&&!outgoing||args.direction==='incoming'&&outgoing)continue;const target=outgoing?edge.target_id:edge.source_id;if(seen.has(target)||rows.length>=8)continue;const record=store.get(args.project_id,target);if(['retired','removed','superseded'].includes(record.status))continue;seen.add(target);rows.push(record);links.push({...edge,direction:outgoing?'outgoing':'incoming',depth,classification:'EXPLICIT'});next.push(target);}
    }frontier=next;}
    if(args.include_inferred&&rows.length<8){const {retrieve}=await import('./retrieval.js');const found=await retrieve(store,args.project_id,row.title,{limit:8});for(const candidate of found.rows){const parent=candidate.parent_id??candidate.id;if(seen.has(parent)||rows.length>=8)continue;seen.add(parent);rows.push(candidate);links.push({source_id:id,target_id:parent,relation:'retrieval_candidate',classification:'INFERRED_NOT_CONFIRMED',depth:1});}}
    return {...pack(rows,{budget:args.budget}),relations:links,depth:args.depth};
  });
  tool('get_design_guidance','Corpus próprio de padrões de UI, fontes oficiais, exemplos e regras do projeto; referência sem afirmar implementação ou conformidade.',{
    project_id:project,topic:z.string().min(1).max(1000),detail:z.enum(['standard','full']).default('standard')
  },true,args=>designGuidance(store,args.project_id,args.topic,args.detail));
  tool('analyze_knowledge_drift','Classifica drift de fontes, referências documentais, movimentos, símbolos e afirmações estruturadas. Preserva requisitos futuros e ADRs; não reescreve fontes.',{
    project_id:project,limit:z.number().int().min(1).max(100).default(30),offset:z.number().int().min(0).default(0),other_project_ids:z.array(z.string().uuid()).max(5).default([])
  },true,async args=>({...await analyzeDrift(store,args.project_id,args),documents:await documentDrift(store,args.project_id,args)}));
  tool('propose_knowledge_patch','Salva proposta de alteração localizada em Markdown comum. Sem escrita no app; ADRs e regras de agentes ficam fora da aplicação automática.',{
    project_id:project,path:z.string().min(1).max(1000),before:z.string().min(1).max(30000),after:z.string().max(30000),reason:z.string().min(1).max(4000),drift_id:z.string().max(100).optional()
  },false,args=>proposePatch(store,{projectId:args.project_id,path:args.path,before:args.before,after:args.after,reason:args.reason,driftId:args.drift_id}));
  tool('validate_knowledge_patch','Confere revisão por hash e trecho único da proposta. Não aplica; a aplicação explícita é pelo comando patch-apply --apply.',{
    project_id:project,id:z.string().uuid()
  },true,args=>validatePatch(store,args.project_id,args.id));
  tool('project_export','Exporta memória canônica, tarefas, handoffs e histórico para arquivo na base local. Código/índices derivados ficam no repositório.',{
    project_id:project
  },false,async args=>{const dir=join(store.directory,'exports');await mkdir(dir,{recursive:true});return writeExport(store,args.project_id,join(dir,`${args.project_id}-${randomUUID()}.json`));});
  tool('project_import','Importa uma exportação com checksum numa base sem o mesmo projeto. root é a raiz explicitamente autorizada; não modifica código.',{
    file:z.string().min(1),root:z.string().min(1)
  },false,args=>importProject(store,args.file,args.root));
  tool('memory_backup','Cria snapshot SQLite consistente de toda a base, em backups. Não copia pesos do modelo nem configurações externas.',{},false,async()=>{
    const dir=join(store.directory,'backups');await mkdir(dir,{recursive:true});return backupStore(store,join(dir,`memory-${Date.now()}-${randomUUID()}.sqlite`));
  });
  tool('diagnose','Diagnóstico local de runtime, SQLite, formatos de conexão e disponibilidade opcional do modelo. Não é atestado de segurança.',{
    project_id:project.optional()
  },true,args=>doctor(store,{projectId:args.project_id}));
}
