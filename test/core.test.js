import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { Store, pack, estimateTokens } from '../src/store.js';
import { registerProject, applyScaffold, indexProject } from '../src/projects.js';

const answers = { purpose: 'Pedidos da equipe', audience: 'Gestores', platforms: 'Web', mvp: 'Cadastrar pedidos' };
async function fixture(t, mode = 'existing') {
  const root = await mkdtemp(join(process.env.APP_MEMORY_TEST_TMP ?? tmpdir(), 'app-memory-test-'));
  const app = join(root, 'app');
  await mkdir(app);
  const store = new Store(join(root, 'memory'));
  t.after(() => store.close());
  const project = await registerProject(store, { name: 'Teste', root: app, mode, answers });
  return { root, app, store, project };
}

test('cadastro, persistência e isolamento de busca e referências por projeto', async t => {
  const { root, store, project } = await fixture(t);
  const otherApp = join(root, 'other'); await mkdir(otherApp);
  const other = await registerProject(store, { name: 'Outro', root: otherApp, mode: 'existing' });
  const row = store.write({ projectId: project.id, kind: 'decision', title: 'Decisão', content: 'Autenticação especial omega' });
  assert.equal(store.search(project.id, 'omega').length, 1);
  assert.equal(store.search(other.id, 'omega').length, 0);
  assert.throws(() => store.get(other.id, row.id), /neste projeto/);
  const reopened = new Store(store.directory);
  assert.equal(reopened.get(project.id, row.id).content, row.content);
  reopened.close();
});

test('controle de revisão impede atualização perdida e mantém histórico', async t => {
  const { store, project } = await fixture(t);
  const row = store.write({ projectId: project.id, kind: 'task', title: 'Tarefa', content: 'Inicial' });
  const changed = store.write({ projectId: project.id, id: row.id, kind: 'task', title: 'Tarefa', content: 'Atualizada', expectedRevision: 1 });
  assert.equal(changed.revision, 2);
  assert.throws(() => store.write({ projectId: project.id, id: row.id, kind: 'task', title: 'Tarefa', content: 'Obsoleta', expectedRevision: 1 }), /Conflito/);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM history WHERE record_id=?').get(row.id).n, 2);
});

test('projeto novo tem prévia, geração de arquivos e recusa sobrescrita', async t => {
  const { store, project, app } = await fixture(t, 'new');
  const preview = await applyScaffold(store, project.id);
  assert.ok(preview.files['APP_MEMORY.md']);
  assert.deepEqual(await readdir(app), []);
  await applyScaffold(store, project.id, { dryRun: false });
  assert.match(await readFile(join(app, 'APP_MEMORY.md'), 'utf8'), /Pedidos da equipe/);
  await assert.rejects(applyScaffold(store, project.id, { dryRun: false }), /vazia/);
  assert.match(await readFile(join(app, 'AGENTS.md'), 'utf8'), /expected_revision/);
});

test('requisitos mínimos obrigatórios e rejeição de scaffold em app existente', async t => {
  const { store, project, root } = await fixture(t);
  const fresh = join(root, 'fresh'); await mkdir(fresh);
  await assert.rejects(registerProject(store, { name: 'Vazio', root: fresh, mode: 'new' }), /obrigatória/);
  await assert.rejects(applyScaffold(store, project.id), /projetos novos/);
});

test('indexação incremental, remoções e busca exata sem modificar o app', async t => {
  const { store, project, app } = await fixture(t);
  await mkdir(join(app, 'src'));
  const path = join(app, 'src', 'session.ts');
  const content = 'export function renewSession() { return "omega"; }';
  await writeFile(path, content);
  const first = await indexProject(store, project.id);
  assert.equal(first.indexed, 1);
  assert.equal(await readFile(path, 'utf8'), content);
  const row = store.search(project.id, 'src/session.ts')[0];
  assert.equal(row.source_path, 'src/session.ts');
  assert.equal(row.status, 'observed');
  await indexProject(store, project.id);
  assert.equal(store.get(project.id, row.id).revision, 1);
  await writeFile(path, content + '\n// renewed');
  await indexProject(store, project.id);
  assert.equal(store.get(project.id, row.id).revision, 2);
  await unlink(path);
  await indexProject(store, project.id);
  assert.equal(store.search(project.id, 'omega').length, 0);
  assert.equal(store.get(project.id, row.id).status, 'removed');
});

test('não indexa env, credenciais, chaves, dependências ou arquivos ignorados pelo Git', async t => {
  const { store, project, app } = await fixture(t);
  await writeFile(join(app, '.gitignore'), 'private.txt\n');
  await writeFile(join(app, 'private.txt'), 'PRIVATE_OMEGA');
  await writeFile(join(app, '.env'), 'PASSWORD=hidden');
  await writeFile(join(app, 'credentials.json'), '{"value":"hidden"}');
  await writeFile(join(app, 'config.js'), 'const api_key = "real-long-secret";');
  await mkdir(join(app, 'node_modules'));
  await writeFile(join(app, 'node_modules', 'bad.js'), 'DEPENDENCY_OMEGA');
  await writeFile(join(app, 'safe.md'), 'Conhecimento seguro');
  const result = await indexProject(store, project.id);
  assert.equal(result.indexed, 1);
  assert.equal(store.search(project.id, 'PRIVATE_OMEGA').length, 0);
  assert.equal(result.skipped.possible_secret, 1);
  assert.equal(result.gitignore, '.gitignore');
});

test('resultados preservam negações, revisão e origem e respeitam orçamento estimado', async t => {
  const { store, project } = await fixture(t);
  for (let i = 0; i < 6; i++) store.write({ projectId: project.id, kind: 'spec', title: `Regra ${i}`, content: 'Não enviar mensagens automaticamente.\n' + 'Requisito de teste. '.repeat(100) });
  const rows = store.search(project.id, 'mensagens');
  const result = pack(rows, { budget: 650, query: 'mensagens' });
  assert.ok(result.results.length > 0);
  assert.ok(result.omitted > 0);
  assert.ok(estimateTokens(JSON.stringify(result)) <= 650);
  assert.match(result.results[0].content, /Não enviar/);
  const raw = pack([rows[0]], { mode: 'raw', budget: 5000 });
  assert.equal(raw.results[0].content, rows[0].content);
  assert.equal(raw.results[0].truncated, false);
});

test('CLI mostra ajuda, emite configuração com caminhos Windows válidos e falha em entrada inválida', () => {
  const cli = resolve('src/cli.js');
  const help = execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.match(help, /app-memory adopt/);
  const config = JSON.parse(execFileSync(process.execPath, [cli, 'config'], { encoding: 'utf8' }));
  assert.equal(config.mcpServers['app-memory'].args[0], cli);
  assert.throws(() => execFileSync(process.execPath, [cli, 'search'], { stdio: 'pipe' }), /Command failed/);
});
