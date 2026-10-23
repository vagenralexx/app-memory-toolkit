import { scanProject } from './projects.js';
import { validateEngineeringArgs } from './ponytail-core.js';
import { engineeringWorkflow,engineeringHelp,resolveEngineeringLevel,summarizeEngineeringObservations,ENGINEERING_MEMORY_KEY } from './ponytail-workflow.js';
import { selectEngineeringChanges } from './ponytail-git.js';
import { memoryRetrieve } from './lifecycle.js';

export async function ponytailGuidance(store,projectId,raw) {
  const project=store.project(projectId),{project_id,...input}=raw;
  validateEngineeringArgs(input);
  const row=memoryRetrieve(store,projectId,'notes',ENGINEERING_MEMORY_KEY)[0];
  let stored=null;try{stored=row?JSON.parse(row.content).value:null;}catch{/* malformed legacy preference falls back */}
  const effective=resolveEngineeringLevel(input.level,stored),args={...input,level:effective.level};
  const persistence={namespace:'notes',key:ENGINEERING_MEMORY_KEY,write_tool:'memory_store existente; value JSON string; expected_revision ao atualizar',value_example:JSON.stringify({level:'full'}),revision:row?.revision??null,scope:'explicit_project_id'};
  const common={project_id:projectId,effective_level:effective,persistence};
  if(args.mode==='help')return {...engineeringHelp(),...common};
  if(args.mode==='gain'){
    const rows=store.db.prepare(`SELECT r.content FROM task_checkpoints c JOIN records r ON r.id=c.record_id WHERE c.project_id=? ORDER BY r.updated_at DESC LIMIT 201`).all(projectId);
    const observations=rows.slice(0,200).flatMap(r=>{try{return [JSON.parse(r.content).engineering];}catch{return [];}});
    return {...common,mode:'gain',source:'existing_metrics_and_checkpoints',usage:store.health(projectId).usage,observations:{...summarizeEngineeringObservations(observations),sample_limit_reached:rows.length>200},note:'Tokens das respostas MCP são estimados e não são consumo/faturamento do LLM. Sem dados do host, custo/tempo/testes são desconhecidos. Nenhum histórico ou dashboard paralelo.'};
  }
  if(args.level==='off'&&(args.mode??'plan')==='plan')return {...engineeringWorkflow([],args),...common};
  const scan=await scanProject(project.root,store.directory),change=args.mode==='review'?selectEngineeringChanges(project.root,args):undefined;
  const result=engineeringWorkflow(scan.sources,args,change);
  if(result.report&&!scan.complete){result.report.coverage_complete=false;result.report.ready_for_host_decision=false;}
  const debtPaths=[...new Set(args.mode==='debt'?result.results.map(r=>r.path):[])].slice(0,8);
  const tasks=[];for(const path of debtPaths)tasks.push(...store.db.prepare(`SELECT id,title,status,revision FROM records WHERE project_id=? AND kind='task' AND status NOT IN ('removed','done') AND instr(content,?)>0 LIMIT 8`).all(projectId,path).map(t=>({...t,matched_path:path})));
  return {...result,...common,coverage:{enumeration:'existing_project_scanner',enumeration_complete:scan.complete,bytes_read:scan.bytes,skipped:scan.skipped},
    backlog:args.mode==='debt'?{checked:true,candidates:tasks,match:'exact_path_candidate_not_semantic_duplicate_proof',next:'Conferir task_list antes de criar ou atualizar; nenhuma escrita automática.'}:undefined,
    next_tools:args.mode==='debt'?['task_list','task_update somente após conferir equivalência']:['get_symbol_context','get_code_references','get_dependency_context','check_architecture_conflicts',...(args.mode==='audit'?['security_audit']:[])],
    validation:{tests_executed:false,review_completed:false,working_tree_modified:false},note:'O agente conduz a análise e os checks; o MCP prepara fontes atuais, seleciona alterações e valida âncoras. Usa scanner, memória, backlog e métricas existentes.'};
}
