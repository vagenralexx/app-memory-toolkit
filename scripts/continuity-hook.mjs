import {resolve} from 'node:path';
import {Store} from '../src/store.js';
import {projectContinuityBackend} from '../src/continuity-context.js';
import {hookArguments,runContinuityHook,hookFailure} from '../src/continuity-hook.js';
let store;
try{const args=hookArguments();if(!args.project||!args.data)throw Error('--project e --data absolutos são obrigatórios para hooks');if(resolve(args.data)!==args.data&&resolve(args.data).replaceAll('\\','/')!==args.data)throw Error('--data precisa ser absoluto');store=new Store(args.data);console.log(JSON.stringify(await runContinuityHook(projectContinuityBackend(store,args.project),args.client,args.normalized)));}
catch(error){console.error(JSON.stringify(hookFailure(error)));}
finally{store?.close();}
