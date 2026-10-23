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
  tool('get_dependency_context','Recupera manifestos e dependências declaradas no último inventário; não valida instalação ou versão carregada em produção.',{project_id:project,budget},true,args=>{
    const row=store.list(args.project_id,'inventory',1)[0];
    if(!row)return {found:false,next:'Execute project_analyze.'};
    const data=JSON.parse(store.get(args.project_id,row.id).content).analysis;
    return {inventory_ref:row.id,manifests:data?.manifests??[],dependencies:(data?.dependencies??[]).slice(0,80),verified_runtime:false};
  });
  tool('check_architecture_conflicts','Recupera decisões aceitas relacionadas à intenção para revisão. Não deduz contradições semânticas nem aprova arquitetura automaticamente.',{
    project_id:project,intent:z.string().min(1).max(1000),budget
  },true,args=>({verdict:'REVIEW_REQUIRED',...pack(store.search(args.project_id,args.intent,12,'decision').filter(row=>row.status==='accepted'),{budget:args.budget,query:args.intent}),
    limits:'Candidatos de busca precisam ser conferidos com o código e requisitos. Nenhuma correspondência não significa aprovação.'}));
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
  tool('find_related_knowledge','Expande somente relações explícitas de uma referência, profundidade 1 e até 8 alvos.',{
    project_id:project,id:z.string().uuid(),budget
  },true,args=>{
    const row=store.get(args.project_id,args.id),id=row.parent_id??row.id;
    const links=store.db.prepare('SELECT target_id,relation FROM relations WHERE project_id=? AND source_id=? LIMIT 8').all(args.project_id,id);
    return {...pack(links.map(link=>store.get(args.project_id,link.target_id)),{budget:args.budget}),relations:links,depth:1};
  });
  tool('get_design_guidance','Orientação genérica de UI e regras do projeto. GUIDE/REFERENCE: não prova que o design existe nem substitui inspeção renderizada.',{
    project_id:project,topic:z.string().min(1).max(1000),detail:z.enum(['standard','full']).default('standard')
  },true,args=>({classification:'GUIDE_REFERENCE',topic:args.topic,detail:args.detail,rules:getRules(store,args.project_id,'ui'),
    checklist:['Confirmar jornadas e critérios de aceite.','Revisar ordem dos passos, mensagens e recuperação.','Validar teclado/foco e estados vazio/erro/loading.','Verificar textos longos, overflow e telas pequenas.','Testar os temas e plataformas exigidos pelo projeto.','Informar o que foi visto ao vivo e o que ficou pendente.'],
    limits:args.detail==='full'?'Não inclui corpus Apple HIG/skills de terceiros nem reviewer independente. Use as fontes e ferramentas autorizadas do projeto.':undefined}));
  tool('analyze_knowledge_drift','Compara hashes das fontes indexadas com arquivos atuais, em páginas. Não reescreve requisitos e não simula análise semântica.',{
    project_id:project,limit:z.number().int().min(1).max(100).default(30),offset:z.number().int().min(0).default(0)
  },true,args=>analyzeDrift(store,args.project_id,args));
  tool('propose_knowledge_patch','Salva proposta de alteração localizada em Markdown comum. Sem escrita no app; ADRs e regras de agentes ficam fora da aplicação automática.',{
    project_id:project,path:z.string().min(1).max(1000),before:z.string().min(1).max(30000),after:z.string().max(30000),reason:z.string().min(1).max(4000)
  },false,args=>proposePatch(store,{projectId:args.project_id,path:args.path,before:args.before,after:args.after,reason:args.reason}));
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
