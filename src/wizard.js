import { createInterface } from 'node:readline/promises';
import { stdin,stdout } from 'node:process';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { Store } from './store.js';
import { questions } from './questions.js';
import { registerProject,applyScaffold,indexProject } from './projects.js';
import { updateProject } from './analysis.js';
import { connectClient } from './connect.js';
import { semanticSetup,indexEmbeddings } from './semantic.js';
import { searchKnowledge } from './retrieval.js';
import { backupStore } from './portability.js';
import { doctor } from './doctor.js';
import { VERSION } from './version.js';

export async function runWizard({directory,cli,ask,write=message=>stdout.write(message+'\n')}={}) {
  let rl;
  if(!ask){if(!stdin.isTTY)throw new Error('O assistente exige terminal interativo. Use os comandos/JSON para automação.');rl=createInterface({input:stdin,output:stdout});ask=question=>rl.question(question);}
  let store;
  try{
    write(`App Memory Toolkit ${VERSION} — avaliação local\nMemória, regras e contexto para seus agentes.`);
    const selected=await ask(`Pasta da memória [${resolve(directory)}]: `);
    store=new Store(resolve(selected.trim()||directory));
    async function selectProject(){
      const projects=store.projects();if(!projects.length)throw new Error('Cadastre um projeto primeiro.');
      projects.forEach((p,i)=>write(`${i+1}. ${p.name} — ${p.root}`));
      const choice=Number(await ask('Número do projeto: '));
      if(!Number.isInteger(choice)||!projects[choice-1])throw new Error('Projeto inválido.');
      return projects[choice-1];
    }
    while(true){
      write('\n1. Novo app\n2. Incorporar app existente\n3. Consultar projetos\n4. Atualizar índice\n5. Preparar busca semântica local\n6. Conectar agente\n7. Diagnosticar\n8. Buscar conhecimento\n9. Fazer backup\n0. Sair');
      const choice=(await ask('Escolha: ')).trim();if(choice==='0')break;
      try{
        if(choice==='1'||choice==='2'){
          const mode=choice==='1'?'new':'existing';
          const name=(await ask('Nome do app: ')).trim(),root=resolve((await ask('Pasta do app: ')).trim());
          if(mode==='new')await mkdir(root,{recursive:true});
          let project=store.projects().find(p=>p.root.toLocaleLowerCase()===root.toLocaleLowerCase());
          if(project&&project.mode!==mode)throw new Error('Esta pasta já está cadastrada com outro modo. Use o projeto existente.');
          if(mode==='existing'&&!project)project=await registerProject(store,{name,root,mode});
          if(mode==='existing'){
            const inventory=await indexProject(store,project.id);
            write(JSON.stringify({files:inventory.indexed,languages:inventory.analysis.languages,technologies:inventory.analysis.declared_technologies,verified_runtime:false},null,2));
            write('Confirme os requisitos. As tecnologias acima foram apenas observadas nos arquivos.');
          }
          const answers={...project?.answers};
          for(const question of questions){
            const current=answers[question.key];let answer;
            do{answer=(await ask(`${question.label}${current?` [${current}]`:''}${question.required?' (obrigatório)':''}\n> `)).trim()||current||'';}while(question.required&&!answer);
            answers[question.key]=answer;
          }
          if(project)project=await updateProject(store,project.id,{expectedRevision:project.revision,answers});
          else project=await registerProject(store,{name,root,mode,answers});
          if(mode==='new'){
            const preview=await applyScaffold(store,project.id);write(JSON.stringify(preview,null,2));
            if((await ask('Criar estes arquivos na pasta vazia? [s/N] ')).trim().toLowerCase()==='s'){
              await applyScaffold(store,project.id,{dryRun:false});await indexProject(store,project.id);write('Estrutura criada e indexada.');
            }else write('Projeto salvo com estrutura pendente; use scaffold --project com o ID abaixo.');
          }
          write(`Projeto cadastrado: ${project.id}\nMemória: ${store.directory}`);
        }else if(choice==='3')write(JSON.stringify(store.projects(),null,2));
        else if(choice==='4'){
          const project=await selectProject();write(JSON.stringify(await indexProject(store,project.id),null,2));
          if(store.setting('semantic')?.enabled)write(JSON.stringify(await indexEmbeddings(store,project.id),null,2));
        }else if(choice==='5'){
          write('Esta etapa baixa dois modelos públicos para inferência local. Os documentos não são enviados.');
          if((await ask('Preparar os modelos agora? [s/N] ')).trim().toLowerCase()==='s')write(JSON.stringify(await semanticSetup(store),null,2));
        }else if(choice==='6'){
          const clients=['codex','claude-code','opencode-v1','opencode','deepseek-harness'];clients.forEach((name,i)=>write(`${i+1}. ${name}`));
          const client=clients[Number(await ask('Cliente: '))-1];if(!client)throw new Error('Cliente inválido.');
          const configPath=client==='deepseek-harness'?(await ask('Caminho do perfil Cordis YAML: ')).trim():undefined;
          const root=client!=='deepseek-harness'?(await selectProject()).root:undefined;
          const options={root,configPath,cli};write(JSON.stringify(await connectClient(store,client,options),null,2));
          if((await ask('Adicionar somente esta nova conexão, com backup do arquivo atual? [s/N] ')).trim().toLowerCase()==='s')write(JSON.stringify(await connectClient(store,client,{...options,apply:true}),null,2));
        }else if(choice==='7')write(JSON.stringify(await doctor(store,{cli}),null,2));
        else if(choice==='8'){const project=await selectProject(),query=await ask('Busca: ');write(JSON.stringify(await searchKnowledge(store,project.id,query),null,2));}
        else if(choice==='9'){const path=await ask('Caminho de um novo arquivo .sqlite: ');write(JSON.stringify(await backupStore(store,path.trim()),null,2));}
        else write('Opção inválida.');
      }catch(error){write(`Não foi concluído: ${error.message}`);}
    }
    write('Memória salva. Você pode retomar pelo mesmo caminho em outro cliente MCP.');
  }finally{store?.close();rl?.close();}
}
