import {founderGuidance,validateFounderArgs,validateContext,FOUNDER_MEMORY_KEY} from './founder-core.js';
import {memoryRetrieve} from './lifecycle.js';
import {containsSecret} from './safety.js';
export function projectFounderGuidance(store,projectId,raw){
 const project=store.project(projectId),{project_id,...input}=raw;validateFounderArgs(input);
 const row=memoryRetrieve(store,projectId,'notes',FOUNDER_MEMORY_KEY)[0];let saved={},status='not_stored';
 if(row)try{const value=JSON.parse(row.content).value;saved=validateContext(typeof value==='string'?JSON.parse(value):value);status='canonical_memory';}catch{status='invalid_memory_ignored';}
 const answers=project.answers??{},onboarding={business:project.name,...(answers.purpose?{purpose:answers.purpose}:{}),...(answers.audience?{audience:answers.audience}:{}),...(answers.constraints?{constraints:answers.constraints}:{}),...(answers.acceptance?{acceptance:answers.acceptance}:{}),...(answers.ui?{brand:answers.ui}:{})};
 const context={...onboarding,...saved,...input.context};if(containsSecret(JSON.stringify({...input,context})))throw Error('Possível segredo nos inputs Founder; remova antes de consultar.');
 return {...founderGuidance({...input,context}),project_id:projectId,context_origin:{onboarding_keys:Object.keys(onboarding),stored_keys:Object.keys(saved),override_keys:Object.keys(input.context??{}),precedence:'context explícito > memória canônica > respostas confirmadas do onboarding; fontes/claims são substituídos como unidade'},persistence:{namespace:'notes',key:FOUNDER_MEMORY_KEY,status,revision:row?.revision??null,write_tool:'memory_store existente; value JSON serializado; expected_revision na atualização',value:'Briefing:context. Inputs de projeção/painel não são gravados automaticamente.',scope:'explicit_project_id'},next_tools:['get_task_briefing','get_code_references','get_design_guidance','get_ponytail_guidance','memory_retrieve','memory_store','task_list'],backlog:'task_list/task_update únicos; sem founder/ paralelo obrigatório.'};
}
