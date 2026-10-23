import { resolve } from 'node:path';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { agentInstructions } from './policy.js';

export const CLIENTS = ['generic', 'codex', 'claude-code', 'opencode', 'opencode-v1', 'deepseek-harness'];
const quoteToml = value => JSON.stringify(value);
const quoteYaml = value => `'${String(value).replaceAll("'", "''")}'`;

export function clientConfig(client, { executable = process.execPath, cli, directory }) {
  if (!CLIENTS.includes(client)) throw new Error(`Cliente inválido. Use: ${CLIENTS.join(', ')}.`);
  const args = [resolve(cli), 'serve', '--data', resolve(directory)];
  const spec = { command: executable, args };
  if (client === 'codex') return `[mcp_servers.app-memory]\ncommand = ${quoteToml(executable)}\nargs = [${args.map(quoteToml).join(', ')}]\nstartup_timeout_sec = 30\ntool_timeout_sec = 60\n`;
  if (client === 'opencode') return { $schema: 'https://opencode.ai/config.json', mcp: { servers: { 'app-memory': { type: 'local', command: [executable, ...args], disabled: false } } } };
  if (client === 'opencode-v1') return { $schema: 'https://opencode.ai/config.json', mcp: { 'app-memory': { type: 'local', command: [executable, ...args], enabled: true } } };
  if (client === 'deepseek-harness') return `# Trecho para a lista plugins do perfil Cordis do DeepSeek Harness.\n# Formato observado na instalação local em 23/10/2026; confirmar na versão de destino.\n- id: mcp-app-memory\n  name: '@deepseek-ai/dsh-mcp-client'\n  config:\n    serverName: app-memory\n    transport: stdio\n    command: ${quoteYaml(executable)}\n    args:\n${args.map(arg => `      - ${quoteYaml(arg)}`).join('\n')}\n    failOnStartupError: false\n`;
  return { mcpServers: { 'app-memory': { ...(client === 'claude-code' ? { type: 'stdio' } : {}), ...spec } } };
}

export async function exportIntegrations(output, options, projectId) {
  const root = resolve(output);
  await mkdir(root, { recursive: true });
  if ((await readdir(root)).length) throw new Error('Destino da exportação precisa estar vazio. Não sobrescreveremos configurações.');
  const names = { generic: 'mcp.generic.json', codex: 'codex.toml', 'claude-code': 'claude.mcp.json', opencode: 'opencode-v2.json', 'opencode-v1': 'opencode-v1.json', 'deepseek-harness': 'deepseek-harness.patch.yml' };
  for (const [client, name] of Object.entries(names)) {
    const config = clientConfig(client, options);
    await writeFile(resolve(root, name), typeof config === 'string' ? config : JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
  }
  await writeFile(resolve(root, 'AGENTS.snippet.md'), agentInstructions(projectId), { flag: 'wx' });
  await writeFile(resolve(root, 'CLAUDE.snippet.md'), agentInstructions(projectId), { flag: 'wx' });
  await writeFile(resolve(root, 'LEIA-ME.md'), `# Conexões do App Memory\n\nTodos os exemplos apontam para a MESMA base: ${resolve(options.directory)}.\n\n- Codex: adicionar a seção de codex.toml ao config.toml do cliente.\n- Claude Code: incorporar a entrada app-memory no mcpServers de .mcp.json.\n- OpenCode: usar somente o formato correspondente à versão, V1 ou V2.\n- DeepSeek Harness: incorporar o item YAML à lista plugins do perfil Cordis, respeitando a indentação. Este formato foi observado na instalação local, sem teste no aplicativo.\n- DeepSeek como modelo no OpenCode/Claude Code: usar a conexão MCP do próprio cliente; não há configuração MCP genérica do modelo/API.\n\nIncorporar AGENTS.snippet.md/CLAUDE.snippet.md às instruções do projeto sem apagar regras existentes. Não manter cópias divergentes das regras: get_operating_rules é a referência operacional. Nenhum arquivo global nem servidor anterior foi alterado pela exportação.\n\nCada cliente inicia seu processo stdio; SQLite compartilha a memória e controla revisões. Não há daemon/HTTP nesta versão. Retomada requer project_id/task_id explícitos; não pressupõe variáveis de sessão de outros clientes.\n\nOs arquivos contêm caminhos desta máquina; gerar novamente após instalar em outro computador. Ver docs/INTEGRATIONS.md para fontes e diagnóstico.\n`, { flag: 'wx' });
  return { directory: root, files: [...Object.values(names), 'AGENTS.snippet.md', 'CLAUDE.snippet.md', 'LEIA-ME.md'], installed_in_clients: false };
}
