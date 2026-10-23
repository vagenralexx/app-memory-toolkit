import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,access } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as parseToml } from 'smol-toml';
import { parse as parseJsonc } from 'jsonc-parser';
import { parse as parseYaml } from 'yaml';
import { Store } from '../src/store.js';
import { connectClient } from '../src/connect.js';
import { doctor } from '../src/doctor.js';

async function fixture(t){const root=await mkdtemp(join(process.env.APP_MEMORY_TEST_TMP??tmpdir(),'app-memory-connect-'));const app=join(root,'app');await mkdir(app);const store=new Store(join(root,'data'));t.after(()=>store.close());return {root,app,store};}
test('instalador Codex tem prévia sem escrita, preserva servidor existente e é idempotente',async t=>{
  const {store,app}=await fixture(t);await mkdir(join(app,'.codex'));
  const path=join(app,'.codex','config.toml'),original='[mcp_servers.existing]\ncommand = "node"\nargs = ["old.js"]\n';await writeFile(path,original);
  const options={root:app,cli:resolve('src/cli.js')};
  const preview=await connectClient(store,'codex',options);assert.equal(preview.dry_run,true);assert.equal(await readFile(path,'utf8'),original);
  const installed=await connectClient(store,'codex',{...options,apply:true});assert.equal(installed.changed,true);
  const contents=await readFile(path,'utf8');assert.ok(contents.startsWith(original));
  assert.deepEqual(parseToml(contents).mcp_servers.existing,parseToml(original).mcp_servers.existing);
  assert.equal(await readFile(installed.backup_path,'utf8'),original);
  assert.equal((await connectClient(store,'codex',{...options,apply:true})).already_configured,true);
});
test('Claude JSONC preserva comentários e servidores, sem alargar permissões',async t=>{
  const {store,app}=await fixture(t),path=join(app,'.mcp.json');
  const original='// Meu MCP\n{ "mcpServers": { "original": { "command": "old", "args": ["server"] } } }';await writeFile(path,original);
  await connectClient(store,'claude-code',{root:app,cli:resolve('src/cli.js'),apply:true});
  const text=await readFile(path,'utf8'),parsed=parseJsonc(text);
  assert.ok(text.includes('// Meu MCP'));assert.equal(parsed.mcpServers.original.command,'old');
  assert.equal(parsed.mcpServers['app-memory'].type,'stdio');assert.equal(parsed.permissions,undefined);
});
test('instalação OpenCode recusa misturar schemas V1/V2',async t=>{
  const {store,app}=await fixture(t),path=join(app,'opencode.jsonc');
  await writeFile(path,'{"mcp":{"existing":{"type":"local","command":["old"]}}}');
  await assert.rejects(connectClient(store,'opencode',{root:app,cli:resolve('src/cli.js'),apply:true}),/V1/);
  await connectClient(store,'opencode-v1',{root:app,cli:resolve('src/cli.js'),apply:true});
  assert.equal(parseJsonc(await readFile(path,'utf8')).mcp.existing.command[0],'old');
});
test('DeepSeek Harness preserva plugin e detecta configuração existente diferente em campos aninhados',async t=>{
  const {store,root}=await fixture(t),path=join(root,'profile.yml');
  await writeFile(path,'# perfil\nplugins:\n  - id: existing\n    name: "@deepseek-ai/dsh-mcp-client"\n    config:\n      serverName: old\n      command: old\n');
  const options={configPath:path,cli:resolve('src/cli.js'),apply:true};
  await connectClient(store,'deepseek-harness',options);
  let text=await readFile(path,'utf8');assert.ok(text.includes('# perfil'));
  const profile=parseYaml(text);assert.equal(profile.plugins[0].config.command,'old');assert.equal(profile.plugins.length,2);
  assert.equal((await connectClient(store,'deepseek-harness',options)).already_configured,true);
  profile.plugins[1].config.command='different';
  await writeFile(path,(await import('yaml')).stringify(profile));
  await assert.rejects(connectClient(store,'deepseek-harness',options),/diferente/);
});
test('configuração inválida é preservada e doctor verifica SQLite e formatos',async t=>{
  const {store,app}=await fixture(t),path=join(app,'.mcp.json');await writeFile(path,'{ broken');
  await assert.rejects(connectClient(store,'claude-code',{root:app,cli:resolve('src/cli.js'),apply:true}),/inválida/);
  assert.equal(await readFile(path,'utf8'),'{ broken');
  const report=await doctor(store,{cli:resolve('src/cli.js')});assert.equal(report.ok,true);
});
