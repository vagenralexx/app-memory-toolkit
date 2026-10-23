import { mkdir, lstat, realpath, open, unlink, rmdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { scaffoldFiles } from './projects.js';
import { isWithin } from './safety.js';

export async function prepareProject(store,projectId,{apply=false}={}) {
  const project=store.project(projectId),root=await realpath(project.root);
  const templates=scaffoldFiles(project.name,project.answers,projectId);
  const files={},preserved=[];
  // Existing client configuration and rules are always preserved; setup manages its own instruction block.
  for(const [path,content] of Object.entries(templates)) {
    if(!['APP_MEMORY.md','.app-memory.json'].includes(path)&&!path.startsWith('docs/'))continue;
    const target=join(root,path);let parent=root;
    for(const part of path.split('/').slice(0,-1)) {
      parent=join(parent,part);
      try{const stat=await lstat(parent);if(stat.isSymbolicLink()||!stat.isDirectory()||!isWithin(root,await realpath(parent)))throw new Error('Pasta de conhecimento precisa ficar dentro do projeto, sem symlink.');}catch(error){if(error.code!=='ENOENT')throw error;}
    }
    try{await lstat(target);preserved.push(path);}catch(error){if(error.code!=='ENOENT')throw error;files[path]=content;}
  }
  if(!apply)return {dry_run:true,root,files,preserved,next:'Revisar os arquivos propostos e chamar project_prepare(apply=true) quando autorizado.'};
  const created=[],directories=new Set();
  try {
    for(const [path,content] of Object.entries(files)) {
      const target=join(root,path),dir=dirname(target),made=await mkdir(dir,{recursive:true});
      if(made){let p=dir;while(isWithin(made,p)){directories.add(p);if(p===made)break;p=dirname(p);}}
      const canonical=await realpath(dir);if(!isWithin(root,canonical)||canonical!==dir)throw new Error('Diretório mudou durante preparação.');
      const handle=await open(target,'wx');created.push(target);try{await handle.writeFile(content,'utf8');}finally{await handle.close();}
    }
  }catch(error){for(const p of created.reverse())await unlink(p).catch(()=>{});for(const p of [...directories].sort((a,b)=>b.length-a.length))await rmdir(p).catch(()=>{});throw error;}
  return {dry_run:false,root,created:Object.keys(files),preserved,next:'project_index; decisões de banco e regras são registradas explicitamente, sem executar migrações do app.'};
}
