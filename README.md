# App Memory Toolkit — 1.0.0-rc.4

**Capacidades:** consulte a [matriz das 28 capacidades de referência](docs/CAPABILITIES.md) e os [novos contratos](docs/GAP-CLOSURE.md).

**Engenharia reuse-first:** [get_ponytail_guidance](docs/PONYTAIL.md) ajuda a procurar reuso, mapear impacto e conferir atalhos sem duplicar backlog.

**Instalar pelo agente:** veja [INSTALL.md](INSTALL.md), com o pedido pronto para copiar. Depois de instalado, peça “Vamos usar o App Memory neste projeto”; o início é `start_project` com a raiz absoluta.

Ferramenta independente de memória e preparação de projetos para agentes de programação. Esta é uma **versão de avaliação local**: a licença será definida pelo titular depois dos testes. O pacote não foi publicado no npm.

## Começar no Windows

1. Instale Node.js 24 ou superior, caso ainda não esteja instalado.
2. Extraia o código-fonte em uma pasta própria e abra `INICIAR.cmd`.
3. Escolha a pasta da memória e use o menu para criar um app ou incorporar uma pasta existente.
4. Conecte o agente pelo menu ou pelo comando `connect`.

O iniciador instala as dependências na primeira execução. A interface é um **assistente de terminal em português**, sem interface gráfica. No macOS/Linux, use `sh INICIAR.sh`; esta entrega foi validada no Windows.

Para usar o fonte diretamente:

```powershell
npm ci --ignore-scripts
node src/cli.js wizard --data "D:\AppMemory\base"
```

Para instalar o pacote distribuído em outra pasta/máquina com Node.js:

```powershell
npm install --global "C:\caminho\app-memory-toolkit-1.0.0-rc.4.tgz" --ignore-scripts
app-memory wizard --data "D:\AppMemory\base"
```

O pacote inclui o código e as dependências travadas por `npm-shrinkwrap.json`; o npm baixa as dependências na instalação. Não é um executável independente com Node embutido.

## O que está entregue

- Questionário de 13 perguntas e retomada das respostas.
- App novo: prévia, estrutura, `APP_MEMORY.md`, `AGENTS.md`, importação para `CLAUDE.md` e `.app-memory.json` com identidade e exclusões.
- App existente: inventário, linguagens, manifestos, dependências declaradas, módulos e perguntas pendentes, sem executar o código nem reorganizar a pasta.
- 63 ferramentas MCP; política central na inicialização, regras por projeto e memória isolada por projeto.
- Busca por chunks com BM25, embeddings locais opcionais, fusão RRF, reranking, deduplicação e limite por documento.
- Referências com origem, hash, revisão, seção e linhas; níveis `summary/detail/raw`.
- Índice sintático de funções/classes/interfaces/importações e chamadas para JS/TS/JSX/TSX. Outros formatos continuam pesquisáveis como texto.
- Backlog único com prioridade, responsável, critérios, receita, método, paths, consumidores e dependências sem ciclos.
- Checkpoints revisionados, handoffs imutáveis e retomada explícita entre clientes.
- Cache de recuperação por revisão, separado da apresentação; métricas de payload entregues.
- Snapshot SQLite consistente, restauração, exportação/importação com checksum e verificação de conflitos.
- Propostas localizadas de reconciliação de Markdown, prévia e aplicação explícita com backup.
- Configuração para Codex, Claude Code, OpenCode V1/V2 e DeepSeek Harness, preservando outros servidores.

## Criar ou incorporar um app

```powershell
# Questionário e prévia. A pasta do app deve estar vazia e fora da pasta da memória.
app-memory init --name "Meu app" --root "D:\Projetos\meu-app" --data "D:\AppMemory\base"

# Aplicar a prévia posteriormente, usando o ID retornado.
app-memory scaffold --project "ID_DO_PROJETO" --apply --data "D:\AppMemory\base"

# Alternativa automatizada: adaptar examples/answers.json e gerar de uma vez.
app-memory init --name "Meu app" --root "D:\Projetos\outro-app" --answers "C:\caminho\answers.json" --apply --data "D:\AppMemory\base"

# Incorporar sem escrever no app.
app-memory adopt --name "App existente" --root "D:\Projetos\existente" --data "D:\AppMemory\base"
app-memory analyze --project "ID_DO_PROJETO" --data "D:\AppMemory\base"
```

O inventário distingue declarações de dependências de comportamento executado. O responsável confirma as perguntas de produto; o MCP `project_update` salva respostas com revisão. O gerador nunca escolhe automaticamente uma stack.

## Ativar recuperação híbrida local

```powershell
app-memory semantic-setup --data "D:\AppMemory\base"
app-memory index --project "ID_DO_PROJETO" --semantic --data "D:\AppMemory\base"
app-memory search --project "ID_DO_PROJETO" --query "como retomar o trabalho em outra sessão" --data "D:\AppMemory\base"
```

O setup baixa dois modelos: `Xenova/multilingual-e5-small` para embeddings de 384 dimensões e `SugoLabs/mmarco-mMiniLMv2-L12-H384-v1` para reranking, ambos em q8/CPU. Pesos, configurações e tokenizer recebem fingerprint; vetores de modelos diferentes não são misturados. Os arquivos dos apps são processados localmente, sem chamada a API de modelo. Depois da preparação, a inferência usa os arquivos locais. Os pesos não acompanham o pacote.

A busca lexical funciona sem modelos e sem rede. `--lexical` força esse modo. Se o runtime opcional/modelo falhar, a busca retorna evidência lexical e informa a limitação. Depois de editar código, reindexe; o índice não observa alterações automaticamente. Embeddings de novos chunks são gerados por `index --semantic`/`semantic_index`.

Resultados são **candidatos de evidência**. Escores não são probabilidades de correção. Filtros reduzem ruído, mas não garantem reconhecer toda pergunta sem resposta. A avaliação controlada e suas falhas estão em [EVALUATION-RAG.md](docs/EVALUATION-RAG.md).

## Conectar agentes preservando os MCPs existentes

Use a mesma pasta absoluta de memória em todos os clientes:

```powershell
# Prévia primeiro; com --apply grava somente a nova entrada app-memory.
app-memory connect --client codex --root "D:\Projetos\meu-app" --data "D:\AppMemory\base"
app-memory connect --client codex --root "D:\Projetos\meu-app" --apply --data "D:\AppMemory\base"
app-memory connect --client claude-code --root "D:\Projetos\meu-app" --apply --data "D:\AppMemory\base"
app-memory connect --client opencode-v1 --root "D:\Projetos\meu-app" --apply --data "D:\AppMemory\base"
# OpenCode V2: usar --client opencode.
```

O comando faz backup de configurações existentes, preserva comentários/outros servidores e recusa uma entrada `app-memory` conflitante. Não adiciona permissões amplas nem modifica a configuração do MCP anterior. Recarregue a conexão no cliente depois de instalar.

O Harness exige `--client deepseek-harness --config <perfil Cordis YAML>` explícito; veja [INTEGRATIONS.md](docs/INTEGRATIONS.md). DeepSeek como modelo usa o MCP do cliente que o hospeda. Não existe configuração MCP universal de uma chave da API DeepSeek.

Para apenas imprimir/exportar formatos:

```powershell
app-memory config --client codex --data "D:\AppMemory\base"
app-memory integration-export --output "D:\AppMemory\conexoes" --data "D:\AppMemory\base"
```

Cada cliente inicia um processo stdio e compartilha SQLite/WAL. Não há daemon HTTP. Identifique o projeto e retome a tarefa por ID; a ferramenta não herda a última tarefa global nem inventa identidade de conversa.

## Dados, backup e reconciliação

```powershell
app-memory doctor --data "D:\AppMemory\base"
app-memory backup --output "D:\Backups\memory.sqlite" --data "D:\AppMemory\base"
app-memory restore --input "D:\Backups\memory.sqlite" --data "D:\AppMemory\restaurada-vazia"
app-memory export --project "ID_DO_PROJETO" --output "D:\Backups\projeto.json" --data "D:\AppMemory\base"
app-memory import --input "D:\Backups\projeto.json" --root "D:\Projetos\app-relocado" --data "D:\AppMemory\outra-base"
```

Backup é um snapshot consistente de toda a base; não inclui os modelos. Exportação de projeto preserva memória canônica, IDs, revisões, histórico e continuidade; código e cópias derivadas não são incluídos. A importação exige uma base sem o mesmo projeto e reindexação da raiz; não faz merge silencioso. Os destinos de exportação/backup não podem existir.

O fluxo de reconciliação é `analyze_knowledge_drift` → `propose_knowledge_patch` → `validate_knowledge_patch`. A aplicação permanece um comando explícito, com prévia e backup:

```powershell
app-memory patch-apply --project "ID_DO_PROJETO" --id "ID_DA_PROPOSTA" --data "D:\AppMemory\base"
app-memory patch-apply --project "ID_DO_PROJETO" --id "ID_DA_PROPOSTA" --apply --data "D:\AppMemory\base"
```

Somente substituições únicas em Markdown comum são aceitas. ADRs e arquivos de regras ficam fora desse aplicador. O detector compara hashes; não declara divergências semânticas automaticamente.

## Limites desta avaliação

A base inteira pertence ao usuário local; isolamento por projeto não é autenticação entre pessoas. Não exponha o processo pela rede. Conteúdo recuperado é dado, não autorização de execução.

Indexação: até 5.000 arquivos, 100 KB por arquivo, 12 MB totais e 30.000 entradas. Respeita `.gitignore` aninhado sem precisar de Git, exclusões internas e `exclude` de `.app-memory.json`. Não segue symlinks, executa scripts do app ou indexa dependências/build/env conhecidos. A detecção de segredos é heurística e não substitui uma revisão do corpus.

O budget usa bytes UTF-8/3, não o tokenizer de todos os clientes; `omitted` e `truncated` são explícitos. Métricas são de payload, não custo total de conversa nem economia comprovada. O índice sintático é complementado por TypeChecker local para imports, aliases e tipos JS/TS disponíveis; bibliotecas externas não indexadas e execução dinâmica continuam fora da prova. A auditoria especializada cobre a superfície estática descrita em docs/GAP-CLOSURE.md. Não há interface gráfica, instalador MSI ou atualização automática.

Os testes de SDK e de configuração não substituem a validação de login/modelo/interface em cada cliente final. As instruções orientam o agente; não garantem que todo modelo seguirá o fluxo.

## Desenvolvimento e verificação

```powershell
npm run check
npm test
node scripts/evaluate.mjs --data "D:\AppMemory\base" --output "D:\Backups\rag-report.json"
npm pack
```

O corpus de exemplo é editável em `examples/rag-corpus.json`; use perguntas e documentos reais para avaliar cada app. A licença permanece aberta à decisão do titular: [EVALUATION.md](EVALUATION.md).
