#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { clientConfig, exportIntegrations } from './integrations.js';
import { VERSION } from './version.js';
import { Store, pack } from './store.js';
import { questions } from './questions.js';
import { registerProject, applyScaffold, indexProject } from './projects.js';
import { searchKnowledge } from './retrieval.js';
import { semanticSetup, indexEmbeddings } from './semantic.js';
import { doctor } from './doctor.js';
import { connectClient } from './connect.js';
import { backupStore, restoreStore, writeExport, importProject } from './portability.js';
import { applyPatch } from './reconciliation.js';
import { setupClient } from './setup.js';
import { startProject } from './startup.js';
import { onboardingState } from './analysis.js';

const help = `App Memory Toolkit ${VERSION} — Node.js 24+

  app-memory init      --root <pasta nova> --name <nome> [--answers <json>] [--apply]
  app-memory adopt     --root <app existente> --name <nome> [--answers <json>]
  app-memory projects
  app-memory scaffold  --project <id> [--apply]
  app-memory index     --project <id>
  app-memory search    --project <id> --query <texto> [--mode summary|detail|raw] [--budget 2000]
  app-memory health    --project <id>
  app-memory serve
  app-memory config --client generic|codex|claude-code|opencode|opencode-v1|deepseek-harness
  app-memory integration-export --output <pasta vazia> [--project <id>]
  app-memory questions
  app-memory wizard
  app-memory setup     --client <cliente> --root <projeto> [--config <arquivo>] [--apply]
  app-memory begin     --root <projeto>
  app-memory analyze   --project <id>
  app-memory semantic-setup
  app-memory index     --project <id> --semantic
  app-memory doctor    [--project <id>]
  app-memory connect   --client <cliente> --root <app> [--config <arquivo>] [--apply]
  app-memory export    --project <id> --output <arquivo.json>
  app-memory import    --input <arquivo.json> --root <app>
  app-memory backup    --output <arquivo.sqlite>
  app-memory restore   --input <arquivo.sqlite> --data <pasta vazia>
  app-memory patch-apply --project <id> --id <proposta> [--apply]

Opções comuns: --data <pasta da memória> (padrão: APP_MEMORY_HOME ou ./.app-memory)
init sem --answers abre questionário; com --answers exige --name e --root.
init gera prévia; --apply grava a estrutura somente em pasta vazia.
adopt lê o app, sem alterar seus arquivos. serve usa stdio exclusivamente para MCP.
config imprime exemplo de conexão; não altera configurações de outros MCPs.
`;

async function main() {
  const { values: args, positionals } = parseArgs({ allowPositionals: true, options: {
    root: { type: 'string' }, name: { type: 'string' }, answers: { type: 'string' },
    data: { type: 'string' }, project: { type: 'string' }, query: { type: 'string' },
    client: { type: 'string', default: 'generic' }, output: { type: 'string' },
    input:{type:'string'},config:{type:'string'},id:{type:'string'},semantic:{type:'boolean',default:false},lexical:{type:'boolean',default:false},
    mode: { type: 'string', default: 'summary' }, budget: { type: 'string', default: '2000' },
    apply: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h' }
  } });
  const command = positionals[0];
  if (args.help || !command) { stdout.write(help); return; }
  const directory = resolve(args.data ?? process.env.APP_MEMORY_HOME ?? '.app-memory');
  const print = value => stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  if (command === 'questions') { print(questions); return; }
  if(command==='wizard'){const {runWizard}=await import('./wizard.js');await runWizard({directory,cli:fileURLToPath(import.meta.url)});return;}
  if (command === 'config') {
    const config = clientConfig(args.client, { cli: fileURLToPath(import.meta.url), directory });
    if (typeof config === 'string') stdout.write(config); else print(config);
    return;
  }
  if (command === 'integration-export') {
    if (!args.output) throw new Error('--output é obrigatório.');
    if (args.project) { const store = new Store(directory); try { store.project(args.project); } finally { store.close(); } }
    print(await exportIntegrations(args.output, { cli: fileURLToPath(import.meta.url), directory }, args.project));
    return;
  }
  if (command === 'serve') { const { startServer } = await import('./server.js'); startServer(directory); return; }
  if(command==='restore'){if(!args.input)throw new Error('--input é obrigatório.');print(await restoreStore(args.input,directory));return;}
  if (!['init', 'adopt', 'projects', 'scaffold', 'index', 'search', 'health','setup','begin','analyze','semantic-setup','doctor','connect','export','import','backup','patch-apply'].includes(command)) throw new Error(`Comando desconhecido: ${command}`);
  let answers = args.answers ? JSON.parse(await readFile(resolve(args.answers), 'utf8')) : {};
  if (command === 'init' && !args.answers) {
    if (!stdin.isTTY) throw new Error('Use --answers arquivo.json para execução não interativa.');
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      args.name ||= await rl.question('Nome do projeto: ');
      args.root ||= await rl.question('Pasta nova do projeto: ');
      for (const question of questions) {
        let answer;
        do { answer = await rl.question(`${question.label}${question.required ? ' (obrigatório)' : ''}\n> `); }
        while (question.required && !answer.trim());
        answers[question.key] = answer.trim();
      }
    } finally { rl.close(); }
  }
  if (['init', 'adopt'].includes(command) && (!args.root || !args.name)) throw new Error('--root e --name são obrigatórios.');
  if (['scaffold', 'index', 'search', 'health','analyze','export','patch-apply'].includes(command) && !args.project) throw new Error('--project é obrigatório.');
  if (command === 'search' && !args.query) throw new Error('--query é obrigatório.');
  if (!['summary', 'detail', 'raw'].includes(args.mode)) throw new Error('--mode inválido.');
  const budget = Number(args.budget);
  if (!Number.isInteger(budget) || budget < 300 || budget > 50000) throw new Error('--budget deve ser inteiro entre 300 e 50000.');
  if (command === 'init') {
    const { validateAnswers } = await import('./questions.js');
    validateAnswers(answers);
    await mkdir(resolve(args.root), { recursive: true });
  }
  const store = new Store(directory);
  try {
    if(command==='setup')print(await setupClient(store,args.client,{root:args.root,configPath:args.config,cli:fileURLToPath(import.meta.url),apply:args.apply}));
    else if(command==='begin'){if(!args.root)throw new Error('--root é obrigatório.');print(await startProject(store,{root:args.root}));}
    else if(command==='doctor')print(await doctor(store,{cli:fileURLToPath(import.meta.url),projectId:args.project}));
    else if(command==='semantic-setup')print(await semanticSetup(store));
    else if(command==='connect')print(await connectClient(store,args.client,{root:args.root,configPath:args.config,cli:fileURLToPath(import.meta.url),apply:args.apply}));
    else if(command==='backup'){if(!args.output)throw new Error('--output é obrigatório.');print(await backupStore(store,args.output));}
    else if(command==='export'){if(!args.output)throw new Error('--output é obrigatório.');print(await writeExport(store,args.project,args.output));}
    else if(command==='import'){if(!args.input||!args.root)throw new Error('--input e --root são obrigatórios.');print(await importProject(store,args.input,args.root));}
    else if(command==='patch-apply'){if(!args.id)throw new Error('--id é obrigatório.');print(await applyPatch(store,args.project,args.id,{apply:args.apply}));}
    else if(command==='analyze')print({inventory:await indexProject(store,args.project),onboarding:onboardingState(store,args.project)});
    else if (command === 'projects') print(store.projects());
    else if (command === 'scaffold') print(await applyScaffold(store, args.project, { dryRun: !args.apply }));
    else if (command === 'init' || command === 'adopt') {
      const project = await registerProject(store, { name: args.name, root: args.root, mode: command === 'init' ? 'new' : 'existing', answers });
      if (command === 'init') {
        print({ project, scaffold: await applyScaffold(store, project.id, { dryRun: !args.apply }), next: args.apply ? 'Estrutura criada; execute index após editar o projeto.' : `Prévia gerada. Para aplicar: project_scaffold pelo MCP com project_id=${project.id}, apply=true.` });
      } else print({ project, inventory: await indexProject(store, project.id) });
    } else if (command === 'index') {const result=await indexProject(store,args.project);if(args.semantic)result.semantic=await indexEmbeddings(store,args.project,{progress:value=>process.stderr.write(`Embeddings: ${value.indexed}/${value.total}\n`)});print(result);}
    else if (command === 'search') {
      const result = await searchKnowledge(store,args.project,args.query,{mode:args.mode,budget,semantic:!args.lexical});
      const text = JSON.stringify(result, null, 2);
      try{store.metric(args.project,'cli_search',text);}catch{process.stderr.write('Resultado entregue; métrica indisponível.\n');}
      stdout.write(`${text}\n`);
    } else if (command === 'health') print(store.health(args.project));
  } finally { store.close(); }
}

main().catch(error => { process.stderr.write(`Erro: ${error.message}\n`); process.exitCode = 1; });
