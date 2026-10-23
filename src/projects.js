import { readdir, readFile, lstat, realpath, mkdir, open, unlink, rmdir } from 'node:fs/promises';
import { resolve, relative, join, extname, isAbsolute, dirname } from 'node:path';
import { hash, now } from './store.js';
import { questions, validateAnswers } from './questions.js';
import { agentInstructions } from './policy.js';
import ignore from 'ignore';
import { analyzeSources } from './analysis.js';
import { containsSecret, readBounded } from './safety.js';

const excluded = new Set(['.git', '.svn', 'node_modules', 'vendor', 'dist', 'build', 'coverage', '.next', '.nuxt', '.venv', 'venv', '__pycache__', '.app-memory', '.mcp-memory', '.idea', '.vscode', 'logs', 'secrets', 'credentials']);
const extensions = new Set(['.md', '.txt', '.json', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.py', '.rs', '.go', '.java', '.cs', '.css', '.scss', '.html', '.vue', '.svelte', '.toml', '.yaml', '.yml', '.sql', '.prisma', '.graphql', '.sh', '.ps1','.kt','.kts','.swift','.dart','.php','.rb','.c','.cpp','.h','.hpp','.csproj','.xml','.gradle','.ini','.cfg']);
const denied = /(^\.env(?:\.|$)|(?:secret|credential|token|password)|(?:^|\.)id_(?:rsa|ed25519)|(?:package-lock|npm-shrinkwrap|pnpm-lock|yarn\.lock)|\.min\.)/i;
const MAX_FILES = 5000;
const MAX_TOTAL_BYTES = 12_000_000;
const MAX_FILE_BYTES = 100_000;

function within(root, target) {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith(`..`) && !isAbsolute(rel));
}

export async function scanProject(root, dataDirectory) {
  const canonical = await realpath(root);
  const sources = [];
  const skipped = {};
  let bytes = 0;
  let visited = 0;
  let complete = true;
  const skip = reason => { skipped[reason] = (skipped[reason] ?? 0) + 1; };
  let configuration={exclude:[]};
  try {
    const configPath=join(canonical,'.app-memory.json');
    const stat=await lstat(configPath);
    if(!stat.isSymbolicLink()&&stat.size<64000) {
      const parsed=JSON.parse(await readFile(configPath,'utf8'));
      if(parsed.exclude!==undefined&&(!Array.isArray(parsed.exclude)||parsed.exclude.some(value=>typeof value!=='string'))) throw new Error('exclude precisa ser uma lista de padrões.');
      configuration={exclude:parsed.exclude??[]};
    }
  } catch(error) { if(error.code!=='ENOENT') throw new Error(`Configuração .app-memory.json inválida: ${error.message}`); }
  const customIgnore=ignore().add(configuration.exclude);
  async function walk(directory,parents=[]) {
    const rules=[...parents];
    try {
      const path=join(directory,'.gitignore'),stat=await lstat(path);
      if(!stat.isSymbolicLink()&&stat.size<64000) rules.push({directory,matcher:ignore().add(await readFile(path,'utf8'))});
    } catch(error) { if(error.code!=='ENOENT'){skip('unreadable_ignore');complete=false;} }
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch { skip('unreadable_directory'); complete = false; return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (++visited > 30_000 || sources.length >= MAX_FILES || bytes >= MAX_TOTAL_BYTES) { complete = false; return; }
      const path = join(directory, entry.name);
      const rel = relative(canonical, path).replaceAll('\\', '/');
      if (entry.isSymbolicLink()) { skip('symlink'); continue; }
      if (excluded.has(entry.name) || denied.test(entry.name)) { skip('excluded_name'); continue; }
      if (dataDirectory && within(resolve(dataDirectory), resolve(path))) { skip('memory_directory'); continue; }
      let ignored=customIgnore.ignores(rel+(entry.isDirectory()?'/':''));
      if(!ignored) for(const rule of rules) {
        const result=rule.matcher.test(relative(rule.directory,path).replaceAll('\\','/')+(entry.isDirectory()?'/':''));
        if(result.ignored) ignored=true; else if(result.unignored) ignored=false;
      }
      if (ignored) { skip('gitignore'); continue; }
      if (entry.isDirectory()) { await walk(path,rules); continue; }
      if (!entry.isFile() || (!extensions.has(extname(entry.name).toLowerCase()) && !['Dockerfile', 'Makefile'].includes(entry.name))) continue;
      try {
        const stat = await lstat(path);
        if (stat.isSymbolicLink() || !within(canonical, await realpath(path))) { skip('escaped_path'); continue; }
        if (stat.size > MAX_FILE_BYTES || bytes + stat.size > MAX_TOTAL_BYTES) { skip('size'); continue; }
        const content = await readBounded(path,MAX_FILE_BYTES);
        if (content.includes('\0')) { skip('binary'); continue; }
        if (containsSecret(content)) { skip('possible_secret'); continue; }
        bytes += Buffer.byteLength(content);
        sources.push({ path: rel, content, hash: hash(content), kind: /\.(md|txt)$/i.test(rel) ? 'spec' : 'code' });
      } catch { skip('unreadable_file'); complete = false; }
    }
  }
  await walk(canonical);
  return { root: canonical, sources, skipped, bytes, complete, gitignore: '.gitignore',configuration };
}

export function scaffoldFiles(name, answers, projectId) {
  validateAnswers(answers);
  return {
    'APP_MEMORY.md': `# ${name}\n\nEstado: planejamento inicial, não implementação comprovada.\n\n${questions.map(question => `## ${question.label}\n\n${answers[question.key]?.trim() || 'A definir.'}\n`).join('\n')}\n## Fontes de verdade\n\nRequisitos: este documento e docs/specs. Decisões: docs/architecture. Tarefas: docs/tasks. Implementação: código e testes. Índice MCP é derivado.\n`,
    'AGENTS.md': agentInstructions(projectId),
    'CLAUDE.md': '# Instruções do projeto\n\n@AGENTS.md\n\nAGENTS.md é o contrato compartilhado. Consulte get_operating_rules do MCP app-memory para regras vigentes.\n',
    '.app-memory.json': JSON.stringify({version:1,project_id:projectId,knowledge_roots:['APP_MEMORY.md','AGENTS.md','CLAUDE.md','docs/','src/'],exclude:['node_modules/','dist/','build/','coverage/','.env*'],notes:'Identidade e exclusões; não contém instruções executáveis. A base SQLite deve ficar fora desta pasta. knowledge_roots documenta as fontes principais; a varredura permanece limitada pela raiz e pelas exclusões.'},null,2)+'\n',
    'README.md': `# ${name}\n\nProjeto iniciado pelo App Memory Toolkit.\n\nLeia APP_MEMORY.md e AGENTS.md antes de implementar. A stack ainda deve ser confirmada de acordo com os requisitos.\n`,
    '.gitignore': '.env\n.env.*\n!.env.example\nnode_modules/\n.app-memory/\n.mcp-memory/\n',
    'docs/architecture/README.md': '# Arquitetura e decisões\n\nADRs: contexto, alternativas, decisão, consequências, estado e referências. Nenhuma stack imposta pelo gerador.\n',
    'docs/data/README.md': '# Dados do app\n\nDocumentar entidades, relacionamentos, permissões, retenção, migrações, seeds sem segredos e recuperação. A tecnologia depende dos requisitos confirmados; o SQLite do MCP não define o banco do app.\n',
    'docs/rules/README.md': '# Regras do projeto\n\nConfirmar e registrar regras por project_rule_set. Preservar AGENTS.md/CLAUDE.md existentes; referências indexadas não viram regras automaticamente.\n',
    'docs/specs/README.md': '# Especificações\n\nRequisitos e critérios de aceite. Diferenciar planejado de implementado.\n',
    'docs/tasks/README.md': '# Backlog\n\nO backlog operacional fica no MCP: task_list e task_update. Esta pasta recebe exportações; não manter uma segunda lista concorrente.\n',
    'docs/handoffs/README.md': '# Continuidade\n\nRegistrar no MCP a tarefa ativa, alterações, validações, limitações e próximos passos. Exportações podem ser salvas aqui.\n',
    'docs/learnings/README.md': '# Aprendizados\n\nRegistrar descobertas com evidências e escopo de validade.\n',
    'docs/research/README.md': '# Pesquisa\n\nHipóteses e referências externas, separadas dos fatos confirmados.\n',
    'src/.gitkeep': ''
  };
}

export async function registerProject(store, { name, root, mode, answers = {} }) {
  if (!name?.trim() || name.length > 120) throw new Error('Nome obrigatório, máximo de 120 caracteres.');
  if (!['new', 'existing'].includes(mode)) throw new Error('Modo inválido.');
  validateAnswers(answers, mode);
  const canonical = await realpath(root);
  if (!(await lstat(canonical)).isDirectory()) throw new Error('A raiz deve ser uma pasta.');
  if (mode === 'new' && within(canonical, store.directory)) throw new Error('Guarde a memória fora da pasta do novo app: use --data em outra pasta.');
  if (mode === 'new' && (await readdir(canonical)).length) throw new Error('Projeto novo exige pasta vazia. Use adopt para app existente.');
  if (store.projects().some(project => project.root.toLowerCase() === canonical.toLowerCase())) throw new Error('Pasta já cadastrada. Use project_list.');
  return store.transaction(()=>{
    const project = store.createProject({ name, root: canonical, mode, answers });
    store.write({ projectId: project.id, kind: 'spec', title: 'Briefing inicial', status: mode === 'new' ? 'planned' : 'draft', content: JSON.stringify({ answers, unknowns: questions.filter(q => !answers[q.key]).map(q => q.key) }, null, 2) });
    return project;
  });
}

export async function indexProject(store, projectId) {
  const project = store.project(projectId);
  const scan = await scanProject(project.root, store.directory);
  const result = store.replaceSources(projectId, scan.sources, scan.complete);
  const manifests = scan.sources.filter(file => /(^|\/)(package\.json|Cargo\.toml|pyproject\.toml|go\.mod|requirements\.txt)$/.test(file.path)).map(file => file.path);
  const inventory = {
    ...result, skipped: scan.skipped, bytes: scan.bytes, gitignore: scan.gitignore,
    manifests, observed_at: now(),analysis:analyzeSources(scan.sources),
    facts: ['Arquivos foram observados, não executados.', 'Dependências declaradas não comprovam funcionalidade implementada.'],
    pending: ['Confirmar propósito e escopo com o responsável.', 'Executar testes e validar fluxos críticos em uma etapa posterior.']
  };
  const old = store.list(projectId, 'inventory', 1)[0];
  store.write({ projectId, id: old?.id, expectedRevision: old?.revision, kind: 'inventory', title: 'Inventário observado do projeto', status: 'observed', content: JSON.stringify(inventory, null, 2) });
  return inventory;
}

export async function applyScaffold(store, projectId, { dryRun = true } = {}) {
  const project = store.project(projectId);
  if (project.mode !== 'new') throw new Error('Geração de estrutura permitida apenas para projetos novos.');
  const entries = await readdir(project.root);
  if (entries.length) throw new Error('A pasta precisa estar vazia. Nenhum arquivo será sobrescrito.');
  const files = scaffoldFiles(project.name, project.answers,project.id);
  if (dryRun) return { dry_run: true, root: project.root, files };
  const created = [];
  const directories = new Set();
  try {
    for (const [path, content] of Object.entries(files)) {
      const target = join(project.root, path);
      const dir = dirname(target);
      if (dir !== project.root) {
        const made = await mkdir(dir, { recursive: true });
        if (made) { let current = dir; while (within(made, current)) { directories.add(current); if (current === made) break; current = dirname(current); } }
      }
      const handle = await open(target, 'wx');
      created.push(target);
      try { await handle.writeFile(content, 'utf8'); } finally { await handle.close(); }
    }
  } catch (error) {
    for (const path of created.reverse()) await unlink(path).catch(() => {});
    for (const dir of [...directories].sort((a, b) => b.length - a.length)) await rmdir(dir).catch(() => {});
    throw error;
  }
  return { dry_run: false, root: project.root, files: Object.keys(files) };
}
