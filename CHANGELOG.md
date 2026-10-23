# Histórico

## 1.0.0-rc.2 — 2026-10-23

- Instalação por agente: setup configura conexão e bloco de ativação no projeto, com prévia, preservação, backup e idempotência.
- start_project identifica pasta nova, app existente ou projeto cadastrado e orienta perguntas, dados e próximos passos.
- project_prepare organiza documentação de apps existentes e pastas com configuração de agentes, criando apenas arquivos ausentes.
- Perguntas explícitas sobre entidades, operações de dados, regras e pastas; sem impor banco ao app.
- Guia INSTALL.md para solicitar a instalação ao agente a partir do GitHub privado.
- 46 ferramentas MCP; testes de ativação e preservação adicionados.

## 1.0.0-rc.1 — 2026-10-23

- Assistente interativo em português, diagnóstico e instalador de conexão com prévia e backup.
- 44 ferramentas MCP; onboarding retomável, inventário de módulos/dependências, relações e verificações de arquitetura.
- Chunks com linhas e origem, BM25, embeddings multilíngues locais opcionais, fusão, reranking e cache por revisão.
- Análise sintática de símbolos JS/TS; propostas de atualização documental com validação de hash e aplicação explícita.
- Exportação/importação por projeto, backup/restauração SQLite e migração aditiva para schema 3.
- Contexto de tarefa somente por identificação explícita e paginação de projetos/tarefas.
- Avaliação real pequena com modelos locais e testes automatizados; limitações descritas em docs/EVALUATION-RAG.md.
- Candidata para testes locais, licença ainda não escolhida e publicação desabilitada.

## 0.2.0 — 2026-10-23

- Consulta real, somente leitura, ao catálogo e à regra de fila do MCP original; documentação da adaptação e das lacunas.
- Política central no initialize MCP, regras por projeto e contratos de agentes compartilhados.
- Checkpoint revisionado, handoff imutável e retomada por project_id/task_id.
- Memória por namespace/chave; busca de decisões vigentes e referências de código com hash atual.
- Backlog com prioridade, tamanho, receita, método, local, consumidores, responsável e dependências.
- Configurações próprias para Codex, Claude Code, OpenCode V1/V2 e DeepSeek Harness.
- Migração aditiva do schema SQLite 1 para 2, preservando registros anteriores.
- Testes com dois clientes simultâneos para continuidade, memória, regras e conflitos.

## 0.1.0 — 2026-10-23

- Criação independente do App Memory Toolkit.
- CLI com questionário, scaffold, incorporação de apps, consulta e configuração MCP.
- SQLite/FTS5, revisões, histórico, métricas e isolamento por projeto.
- Quinze ferramentas MCP por stdio com SDK oficial v2.
- Testes de núcleo e integração real cliente-servidor.
