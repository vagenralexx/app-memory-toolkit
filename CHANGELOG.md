# Histórico

## 1.0.0-rc.4 — 2026-10-23

- get_ponytail_guidance: planejamento por reutilização, roteiro de revisão e dívida por comentários, somente leitura e sem hooks.
- Núcleo portátil implementado e validado primeiro no MCP original; adaptador novo reutiliza scanner e backlog do App Memory.
- Candidatos com arquivo/linha/hash, escopo, paginação e cobertura explícita. Nenhuma aprovação automática ou fila paralela.
- Teste de proveniência e transpilação evita divergência silenciosa do núcleo portado. Total63 ferramentas MCP.

## 1.0.0-rc.3 — 2026-10-23

- Cobertura das 28 capacidades do catálogo de referência, com contratos próprios e matriz verificável.
- Auditoria estática de superfície MCP/hooks/permissões, segredos redigidos e configurações pessoais opt-in.
- Perfis portáveis de workers e roteamento consultivo por fase/risco/raciocínio/disponibilidade.
- TypeChecker JS/TS resolve aliases, reexports, imports locais, tipos e chamadas; Python parcial explícito.
- Corpus próprio UI e cinco padrões React ViewTransition com exemplos e fontes.
- Memória com lista/status, feedback idempotente, reforço declarado, destilação, retirada e purge com snapshot.
- Cache opt-in de resposta por sessão, referências recuperáveis e invalidação por revisão.
- Restrições verificáveis de arquitetura, claims documentais, classificação de referências e patches ligados à evidência de código.
- Contexto de projeto/ecossistema/dependências e expansão de relações aprimorados; total 62 ferramentas.

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
