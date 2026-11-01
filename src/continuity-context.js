import {continuityContext,manageContinuity} from './continuity-runtime.js';
import {scanProject} from './projects.js';
export function projectContinuityBackend(store,projectId){
 const project=store.project(projectId);
 return {scope:project.id,root:project.root,dataDirectory:store.directory,
 list:async()=>store.db.prepare("SELECT content FROM records WHERE project_id=? AND kind='research' AND title='continuity:v1' ORDER BY rowid LIMIT 10001").all(project.id).map(row=>JSON.parse(row.content)),
 append:async event=>{store.write({projectId:project.id,createId:event.id,kind:'research',title:'continuity:v1',content:JSON.stringify(event),status:'recorded'});},
 sources:async paths=>{const scan=await scanProject(project.root,store.directory,{paths});if(!scan.complete||Object.entries(scan.skipped).some(([k,v])=>v&&['size','possible_secret','unreadable_file','unreadable_directory','unreadable_ignore','escaped_path','symlink'].includes(k)))throw Error('Fontes incompletas; verificação exige escopo legível e atual');return scan.sources;}};
}
export const projectContinuityContext=(store,projectId,args)=>continuityContext(projectContinuityBackend(store,projectId),args);
export const manageProjectContinuity=(store,projectId,args)=>manageContinuity(projectContinuityBackend(store,projectId),args);
