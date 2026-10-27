# Instalar e começar pelo agente

**Versão de avaliação rc.12:** instale pela tag `v1.0.0-rc.12` ou pelos arquivos da [release no GitHub](https://github.com/vagenralexx/app-memory-toolkit/releases/tag/v1.0.0-rc.12). O pacote não está publicado no npm.

Repositório: https://github.com/vagenralexx/app-memory-toolkit
Versão de avaliação: 1.0.0-rc.12. Node.js 24+, npm e Git. A licença ainda não foi decidida. Confira a visibilidade e as permissões do repositório antes de distribuir ou instalar. Não informe tokens na conversa.

## Pedido pronto para copiar

> Instale o MCP App Memory deste repositório: https://github.com/vagenralexx/app-memory-toolkit . Leia INSTALL.md e use a versão v1.0.0-rc.12. Configure no agente que estou usando, para este projeto, preservando outros MCPs e regras. Guarde a ferramenta e a base de memória fora da pasta do app. Depois confira a conexão e inicie start_project com a pasta absoluta deste projeto. Se a sessão precisar recarregar, me diga o passo exato.

O agente precisa executar comandos locais e editar a configuração do cliente. Os controles normais do cliente continuam valendo. A instalação não acontece só por citar o nome de um servidor ainda não instalado.

## Procedimento para o agente instalador

1. Identifique o cliente e a pasta absoluta do app a partir do contexto autorizado. Pergunte apenas se faltarem. Localize Node 24+, npm e Git. Escolha uma pasta estável para a ferramenta fora do app e uma base estável fora do repositório; todos os clientes que vão compartilhar memória devem usar essa mesma base.
2. Clone pela autenticação GitHub já disponível (exemplo: `gh repo clone vagenralexx/app-memory-toolkit PASTA_DA_FERRAMENTA`). Em repositório privado, confirme acesso. Não tente contornar autenticação e não peça credenciais na conversa.
3. Entre na pasta clonada, execute `git checkout v1.0.0-rc.12` e `npm ci --ignore-scripts`. Não use npx com o nome do pacote no registro: ele não foi publicado no npm.
4. Execute a prévia abaixo, substituindo caminhos e cliente. Depois aplique a instalação autorizada pelo usuário. Preserve os outros servidores e instruções.

```text
node src/cli.js setup --client CLIENTE --root PASTA_ABSOLUTA_DO_APP --data PASTA_ABSOLUTA_DA_MEMORIA
node src/cli.js setup --client CLIENTE --root PASTA_ABSOLUTA_DO_APP --data PASTA_ABSOLUTA_DA_MEMORIA --apply
node src/cli.js doctor --data PASTA_ABSOLUTA_DA_MEMORIA
```

Clientes: `codex`, `claude-code`, `opencode-v1`, `opencode` (V2), `deepseek-harness`. Se houver dúvida de versão OpenCode, leia a configuração existente antes de escolher. Para arquivo específico, acrescente `--config CAMINHO_ABSOLUTO`; Harness exige o perfil YAML explicitamente. Se OpenCode usa opencode.json, indique esse arquivo. DeepSeek como modelo utiliza o MCP do cliente que executa o modelo.

`setup` adiciona a conexão e um bloco delimitado em AGENTS.md; Claude Code recebe também um bloco em CLAUDE.md. Preserva o restante e salva backup de arquivos alterados. Blocos inválidos e conexão app-memory diferente são recusados. A instalação pode precisar de recarregamento da sessão/confiança normal do cliente; não autoriza permissões globais.

5. Recarregue a conexão/sessão se necessário. Confira `tools/list`: start_project e project_prepare devem estar presentes (65 ferramentas nesta versão). Chame `start_project(root=PASTA_ABSOLUTA_DO_APP)` pelo MCP. Não declare a conexão validada somente porque a CLI doctor passou. Se as ferramentas não aparecerem, informe o passo de recarga em vez de fingir que chamou o MCP.

## Pedido depois de instalado

> Vamos usar o App Memory neste projeto. Faça a verificação inicial e me conduza pelo que falta definir antes de começar a implementação.

O agente chama start_project, identifica o caso e segue:

- Pasta vazia: perguntas necessárias, criação da pasta se ausente, project_register(mode=new), prévia/applicação de project_scaffold.
- Pasta que já contém configurações de agentes: project_register(mode=existing), respostas e project_prepare. A preparação adiciona somente conhecimento ausente; não exige apagar configurações para criar um app novo.
- App existente: inventário e regras encontradas, project_register(mode=existing), project_analyze, perguntas pendentes, project_update revisionado e project_prepare para organização aditiva.
- Projeto cadastrado: regras, inventário, perguntas ainda pendentes e briefing. Retomar tarefa apenas com task_id explícito.

Primeiro confirme propósito, público, plataforma, MVP e fluxo. Depois dados, entidades/relacionamentos, permissões, offline, retenção, migrações e backup, integrações e restrições. Considere a base existente antes de propor stack/pastas. Documentos encontrados não definem decisões automaticamente. Salve respostas, decisões e regras nas ferramentas apropriadas e reindexe após mudanças.

A base SQLite é a memória do MCP, não o banco do produto. Este fluxo não provisiona serviços remotos nem executa migrações por conta própria. O agente constrói o app conforme os requisitos e a autorização do usuário.

## Escopo da hospedagem

GitHub guarda o código instalável. O servidor é local por stdio; não há endpoint HTTP público. Os projetos e a memória permanecem na máquina que instala, fora do Git. A referência técnica de conexão está em docs/INTEGRATIONS.md.

A ativação depende de o agente seguir as instruções e ter as ferramentas disponíveis; o servidor não controla a conversa do cliente. Licença pendente: avaliação local, sem liberação pública ou publicação npm.

## Atualizar uma instalação anterior

Localize a pasta estável da ferramenta e a base já usadas na conexão. Preserve ambas. Na pasta da ferramenta, confira git status; não apague mudanças locais. Execute git fetch --tags, git checkout v1.0.0-rc.12 e npm ci --ignore-scripts. Reexecute setup com os mesmos caminhos de cliente/projeto/base; revise a prévia antes de aplicar. Recarregue a sessão e confira as 65 ferramentas e start_project.

A base continua no schema 3. A atualização do parser recompõe os símbolos derivados sem recriar chunks, vetores ou histórico canônico. Faça backup antes de atualizar uma base importante; não restaure uma cópia por cima da base em uso.
