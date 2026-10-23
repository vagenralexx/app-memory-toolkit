import { questions, validateAnswers } from './questions.js';
import { parseCode } from './structure.js';
import { realpath, lstat } from 'node:fs/promises';

const languages = { '.js':'JavaScript','.jsx':'JavaScript','.mjs':'JavaScript','.cjs':'JavaScript','.ts':'TypeScript','.tsx':'TypeScript','.py':'Python','.rs':'Rust','.go':'Go','.cs':'C#','.java':'Java','.kt':'Kotlin','.swift':'Swift','.dart':'Dart','.php':'PHP','.rb':'Ruby','.c':'C','.cpp':'C++' };
export function analyzeSources(sources) {
  const counts={},modules=new Set(),manifests=[],dependencies=[],commands=[],rules=[],imports=new Set();
  for(const source of sources) {
    const extension=source.path.match(/\.[^.\/]+$/)?.[0]?.toLowerCase();
    if(languages[extension]) counts[languages[extension]]=(counts[languages[extension]]??0)+1;
    const parts=source.path.split('/');
    if(parts.length>2&&['src','app','lib','packages','services','apps'].includes(parts[0])) modules.add(parts.slice(0,2).join('/'));
    if(/(^|\/)(AGENTS|CLAUDE|APP_MEMORY)\.md$/.test(source.path)) rules.push({path:source.path,hash:source.hash,state:'reference_only'});
    if(/(^|\/)package\.json$/.test(source.path)) {
      try {
        const data=JSON.parse(source.content);
        manifests.push({path:source.path,ecosystem:'node',name:data.name??null,version:data.version??null});
        for(const [name,version] of Object.entries({...data.dependencies,...data.devDependencies})) dependencies.push({name,declared:String(version),source:source.path});
        for(const [name,script] of Object.entries(data.scripts??{})) commands.push({name,declared_script:String(script).slice(0,1000),source:source.path,executed:false});
      } catch { manifests.push({path:source.path,error:'JSON inválido'}); }
    } else if(/(^|\/)(Cargo\.toml|pyproject\.toml|go\.mod|requirements\.txt|composer\.json|Gemfile|pubspec\.yaml)$/.test(source.path)||/\.csproj$/.test(source.path)) manifests.push({path:source.path,ecosystem:'declared_manifest',parsed:false});
    if(/\.[cm]?[jt]sx?$/.test(source.path)) for(const name of parseCode({id:source.path,source_path:source.path,content:source.content}).imports) imports.add(name);
  }
  const known={react:'React',next:'Next.js',vue:'Vue',svelte:'Svelte',express:'Express',fastify:'Fastify',electron:'Electron','@tauri-apps/api':'Tauri','@supabase/supabase-js':'Supabase',prisma:'Prisma',vite:'Vite',vitest:'Vitest',jest:'Jest',playwright:'Playwright'};
  return {languages:counts,modules:[...modules].sort(),manifests,dependencies:dependencies.slice(0,500),
    declared_technologies:dependencies.filter(item=>known[item.name]).map(item=>({name:known[item.name],evidence:item.source,classification:'dependency_declared_not_execution'})),
    declared_commands:commands.slice(0,100),rule_sources:rules,imports:[...imports].slice(0,300),
    execution_verified:false,limits:'Dependências e referências sintáticas não comprovam implementação, testes aprovados nem arquitetura operacional.'};
}

export function onboardingState(store,projectId,{detail=false}={}) {
  const project=store.project(projectId);
  const inventory=store.list(projectId,'inventory',1)[0];
  const {answers,...identity}=project;
  return {project:detail?project:identity,questions:questions.map(question=>{const answer=project.answers[question.key]??'';return {...question,answer:detail?answer:answer.slice(0,500),truncated:!detail&&answer.length>500,answered:Boolean(answer.trim())};}),
    inventory_ref:inventory?.id??null,missing_required:questions.filter(q=>q.required&&!project.answers[q.key]?.trim()).map(q=>q.key),
    next:'Confirmar com o responsável o propósito e as escolhas; salvar respostas por project_update. Arquivos não respondem automaticamente às decisões de produto.'};
}

export async function updateProject(store,projectId,{expectedRevision,name,root,answers={}}) {
  const canonical=root ? await realpath(root) : null;
  if(canonical&&!(await lstat(canonical)).isDirectory()) throw new Error('A raiz precisa ser uma pasta.');
  return store.transaction(()=>{
    const project=store.project(projectId);
    if(project.revision!==expectedRevision) throw new Error('Conflito de revisão do projeto. Releia project_list.');
    const merged=validateAnswers({...project.answers,...answers},project.mode);
    if(name!==undefined&&(!name.trim()||name.length>120)) throw new Error('Nome inválido.');
    store.db.prepare('UPDATE projects SET name=?,root=?,answers=? WHERE id=?').run(name??project.name,canonical??project.root,JSON.stringify(merged),projectId);
    store.db.prepare('INSERT INTO project_revisions VALUES(?,?) ON CONFLICT(project_id) DO UPDATE SET revision=excluded.revision').run(projectId,expectedRevision+1);
    const current=store.project(projectId);
    const briefing=store.db.prepare("SELECT * FROM records WHERE project_id=? AND kind='spec' AND source_path IS NULL AND title='Briefing inicial' ORDER BY updated_at DESC LIMIT 1").get(projectId);
    store.write({projectId,id:briefing?.id,expectedRevision:briefing?.revision,kind:'spec',title:'Briefing inicial',status:project.mode==='new'?'planned':'confirmed_by_user',content:JSON.stringify({answers:merged,unknowns:questions.filter(q=>!merged[q.key]).map(q=>q.key)},null,2)});
    return current;
  });
}
