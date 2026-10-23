import { scanProject } from './projects.js';
import { engineeringGuidance,validateEngineeringArgs } from './ponytail-core.js';

export async function ponytailGuidance(store,projectId,raw) {
  const project=store.project(projectId);
  const {project_id, ...input}=raw;
  const args=validateEngineeringArgs(input);
  const scan=await scanProject(project.root,store.directory);
  const result=engineeringGuidance(scan.sources,args);
  return {...result,project_id:projectId,
    coverage:{enumeration:'existing_project_scanner',enumeration_complete:scan.complete,bytes_read:scan.bytes,skipped:scan.skipped},
    next_tools:args.mode==='debt'?['task_list: buscar antes de duplicar','task_update: usar somente se a pendência for confirmada']:['get_symbol_context','get_code_references','get_dependency_context','check_architecture_conflicts'],
    validation:{tests_executed:false,review_completed:false,working_tree_modified:false},
    note:'Adaptação do núcleo validado primeiro no MCP original. Usa as exclusões e os limites do scanner existente; não grava backlog nem ativa hooks.'};
}
