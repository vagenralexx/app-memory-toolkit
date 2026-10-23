import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { clientConfig, exportIntegrations } from '../src/integrations.js';

const options = { executable: 'C:\\Program Files\\nodejs\\node.exe', cli: resolve('src/cli.js'), directory: resolve('../../work/integration-test-data') };
test('configurações por cliente preservam o mesmo comando/base e formatos distintos', () => {
  const generic = clientConfig('generic', options).mcpServers['app-memory'];
  assert.deepEqual(clientConfig('claude-code', options).mcpServers['app-memory'].args, generic.args);
  assert.deepEqual(clientConfig('opencode', options).mcp.servers['app-memory'].command, [options.executable, ...generic.args]);
  assert.equal(clientConfig('opencode', options).mcp.servers['app-memory'].disabled, false);
  assert.equal(clientConfig('opencode-v1', options).mcp['app-memory'].enabled, true);
  assert.match(clientConfig('codex', options), /\[mcp_servers\.app-memory\]/);
  assert.match(clientConfig('codex', options), /Program Files/);
  assert.match(clientConfig('deepseek-harness', options), /@deepseek-ai\/dsh-mcp-client/);
  assert.throws(() => clientConfig('deepseek-api', options), /Cliente inválido/);
});

test('exportação cria snippets de instruções sem sobrescrever destino e sem instalar no host', async () => {
  const root = await mkdtemp(join(process.env.APP_MEMORY_TEST_TMP ?? tmpdir(), 'app-memory-integrations-'));
  const result = await exportIntegrations(root, options, 'project-explicit-id');
  assert.equal(result.files.length, 9);
  assert.equal(result.installed_in_clients, false);
  assert.match(await readFile(join(root, 'AGENTS.snippet.md'), 'utf8'), /project-explicit-id/);
  assert.match(await readFile(join(root, 'CLAUDE.snippet.md'), 'utf8'), /get_operating_rules/);
  await assert.rejects(exportIntegrations(root, options), /vazio/);
});
