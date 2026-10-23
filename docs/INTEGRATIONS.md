# Conexões dos agentes — 1.0.0-rc.4

O cliente MCP inicia `node <caminho absoluto>/src/cli.js serve --data <base absoluta>`. Todos os clientes que precisam compartilhar conhecimento devem usar a mesma base. A ferramenta não altera o provedor de IA nem exige uma API de modelo para funcionar.

## Instalação pelo agente

Use [INSTALL.md](../INSTALL.md). O comando `setup` combina a conexão com instruções de ativação no projeto, preservando os blocos existentes. `connect` abaixo instala somente a conexão. Ao pedir “vamos usar o App Memory”, o agente deve chamar `start_project` com a raiz absoluta e seguir o diagnóstico.

## Instalação de conexão por projeto

```powershell
app-memory connect --client codex --root "D:\Projetos\app" --data "D:\AppMemory\base"
app-memory connect --client codex --root "D:\Projetos\app" --apply --data "D:\AppMemory\base"
```

Sem `--apply`, retorna somente a prévia. Com `--apply`, adiciona a entrada `app-memory`, mantém as demais configurações e grava backup do arquivo anterior na base local. Uma conexão idêntica é reconhecida; uma conexão `app-memory` diferente causa erro, sem ser sobrescrita. O instalador não configura auto-approve nem amplia permissões.

| Cliente | `--client` | Arquivo de projeto |
| --- | --- | --- |
| Codex | `codex` | `.codex/config.toml` |
| Claude Code | `claude-code` | `.mcp.json` |
| OpenCode V1 | `opencode-v1` | `opencode.jsonc` |
| OpenCode V2 | `opencode` | `opencode.jsonc` |
| DeepSeek Harness | `deepseek-harness` | Perfil YAML indicado por `--config` |

Para um arquivo de configuração específico, usar `--config <caminho>` explicitamente. Por padrão, o comando não procura nem altera configurações globais do usuário. Se seu OpenCode usa `opencode.json`, indique esse arquivo por `--config` para preservar uma única fonte de configuração.

## Formatos e fontes

Codex usa `[mcp_servers.app-memory]`, `command` e `args`: [documentação oficial](https://developers.openai.com/codex/mcp/). Configurações de projeto dependem da confiança/permissões normais do cliente.

Claude Code usa `mcpServers.app-memory` com transporte stdio: [documentação oficial](https://code.claude.com/docs/en/mcp). O cliente pode solicitar a aprovação normal de um servidor de projeto.

OpenCode V1 coloca o servidor diretamente em `mcp.app-memory` e usa `enabled`. V2 usa `mcp.servers.app-memory` e `disabled`: [V1](https://opencode.ai/docs/mcp-servers/), [V2](https://opencode.ai/v2/docs/mcp-servers). O instalador recusa misturar os dois formatos.

O Harness usa o plugin `@deepseek-ai/dsh-mcp-client`, conforme a estrutura observada no perfil Cordis local. Indique o arquivo do perfil explicitamente:

```powershell
app-memory connect --client deepseek-harness --config "C:\caminho\cordis.patch.yml" --data "D:\AppMemory\base"
app-memory connect --client deepseek-harness --config "C:\caminho\cordis.patch.yml" --apply --data "D:\AppMemory\base"
```

O parser preserva os plugins existentes. Se a estrutura não for reconhecida, use o snippet gerado por `config --client deepseek-harness` para revisão manual. Esse schema foi observado localmente e testado com fixtures; não constitui uma configuração universal de todas as versões do Harness.

DeepSeek como modelo em OpenCode/Claude Code usa a conexão MCP do cliente. Uma chave da API DeepSeek não é um cliente MCP. Fontes: [integrações de programação](https://api-docs.deepseek.com/guides/coding_agents/) e [execução de tool calls](https://api-docs.deepseek.com/guides/tool_calls/).

## Regras e continuidade

Projetos novos recebem `AGENTS.md` e `CLAUDE.md` importando o contrato compartilhado. Em projetos existentes, incorporar os snippets sem substituir regras próprias; o indexador não reescreve esses arquivos.

`get_operating_rules` é a referência operacional do projeto. Início: `project_list`, regras e briefing. Trabalho significativo: tarefa cedo, `task_resume`, checkpoints por unidade e handoff ao fechar. Outro cliente retoma pelos mesmos `project_id/task_id`.

Não se compartilha contexto privado/cache de conversa. Não se presume uma variável de sessão do Claude/OpenCode/Harness. O modelo não deve inventar `_meta` nem herdar uma tarefa global.

## Diagnóstico

```powershell
app-memory doctor --data "D:\AppMemory\base"
app-memory projects --data "D:\AppMemory\base"
```

Depois de instalar, recarregue a sessão/conexão no cliente. Verifique a presença das 63 ferramentas, `project_list`, leitura de um checkpoint escrito por outro cliente e recusa de revisão obsoleta. Código/configuração testados por SDK e parsers não substituem um teste de interface, login e modelo no aplicativo final.

Para gerar tudo sem instalar: `integration-export --output <pasta vazia>`. Os exemplos contêm caminhos da máquina atual; gere novamente em outra instalação.
