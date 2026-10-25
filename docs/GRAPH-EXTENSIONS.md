# Extensões de grafo — rc.9

## Instalação

O pacote mantém Node.js24+, o mesmo MCP e a mesma base canônica. `npm install --omit=optional` entrega a base sem as extensões pesadas. A instalação normal inclui as dependências opcionais fixadas no shrinkwrap. Nenhuma consulta instala dependências, gramáticas ou pesos. `get_graph_context` com mode=help informa os parsers disponíveis; `manage_graph_context` com action=status informa provedores e watcher sem retornar segredos.

Dependências opcionais: web-tree-sitter0.25.10, tree-sitter-wasms0.1.13, node-sql-parser5.4.0, PDF.js6.4.299, Tesseract.js7.0.0, neo4j-driver6.2.0 e redis6.3.0. ASR reutiliza a dependência opcional Transformers.js existente. Gramáticas são instaladas pelo npm; o parser executa somente código fixo da ferramenta, com a fonte do projeto como dados em subprocesso isolado. Limites:250 fontes por chamada,50mil nós AST por arquivo,5s por subprocesso,128MB de heap JS no subprocesso e cache de500 entradas.

## Análise e importação

```json
{"project_id":"ID","mode":"overview","parsers":true,"sql_dialect":"Postgresql"}
{"project_id":"ID","mode":"query","query":"como estoque é atualizado?","direction":"both","max_depth":2}
```

parsers=true é o padrão; false conserva apenas os extratores anteriores. SQL aceita Postgresql, MySQL, TransactSQL, Sqlite, MariaDB, DB2 ou BigQuery. Falha de parse é declarada; não executa DDL. Metadados de coluna entram no nó. Quando o AST não fornece linha exata de SQL, a evidência é de arquivo, sem inventar uma linha de declaração. O cache do TypeChecker lê e valida fontes/configuração atuais antes de reutilizar a análise.

```json
{"project_id":"ID","mode":"overview","include_inferred":true,"extraction":{"schema":"mcp-graph-extraction/v1","provider":"Graphify-host","nodes":[{"id":"orders","label":"Pedidos","kind":"concept","path":"docs/orders.md","line":3,"quote":"trecho literal","source_hash":"HASH_ATUAL"}],"edges":[{"source":"file:docs/orders.md","target":"orders","relation":"explains","path":"docs/orders.md","line":3,"quote":"trecho literal","source_hash":"HASH_ATUAL"}]}}
```

Envelope até500KB,200 entidades e500 arestas. Kinds: concept,service,endpoint,entity,topic,symbol,person. Entidades externas recebem IDs próprios; arestas aceitam IDs externos do envelope ou chaves atuais. Hash/citação só confirmam a proveniência. Todas as relações externas são INFERRED e exigem opt-in para navegação; nada é aceito como regra/ADR ou persistido automaticamente. Um dump arbitrário precisa ser convertido para esse contrato; o MCP não executa o extrator externo.

## Mídia local

```json
{"project_id":"ID","mode":"query","query":"regras de pedidos","media":[{"path":"docs/manual.pdf","method":"pdf","text_offset":0,"text_limit":2000}]}
{"project_id":"ID","mode":"overview","media":[{"path":"docs/diagram.png","method":"ocr","language":"por"}]}
{"project_id":"ID","mode":"overview","media":[{"path":"docs/meeting.wav","method":"transcribe"}]}
{"project_id":"ID","mode":"overview","media":[{"path":"docs/demo.mp4","method":"video_frame","language":"eng"}]}
```

Até8 arquivos e30MB por chamada;20MB por arquivo. A mídia precisa passar a mesma política de enumeração/exclusão das fontes textuais; links simbólicos e caminhos externos são recusados. No original, a enumeração Git/indexada continua sendo a autoridade: não se amplia a raiz para buscar um arquivo ausente. Na derivada, gitignore e .app-memory.json continuam aplicáveis. Texto extraído com segredo detectável é omitido. O conteúdo é retornado em trechos pagináveis de100–10000 caracteres (padrão2000), até50mil caracteres por mídia; a consulta também pode encontrar termos no texto atual. Hash binário e hash do texto derivado são distintos; snapshots detectam mudanças em captions/transcrições mesmo se o binário permanecer igual.

Perfis do host, sem alteração automática das configurações dos agentes:

- MCP_GRAPH_OCR_DATA_DIR: diretório absoluto com por.traineddata ou eng.traineddata já instalado. gzip=false; não baixa idioma durante a consulta.
- MCP_GRAPH_ASR_MODEL: diretório absoluto de modelo Whisper compatível com Transformers.js, com arquivos de tokenizer/configuração e ONNX quantizado. local_files_only=true; os pesos não acompanham o pacote.
- MCP_GRAPH_FFMPEG: caminho absoluto do FFmpeg confiável já instalado. video_frame extrai o primeiro frame; video_audio extrai até60s para ASR. Só bytes de entrada/saída em pipe; nenhum script de shell ou projeto é executado.

`method=provided` recebe text e source_hash de um provedor do host (caption ou transcrição). O hash deve corresponder ao arquivo binário atual. É uma inferência relatada pelo provedor; não é reconhecimento independente. PDF com texto embutido é suportado; PDF só com páginas escaneadas precisa ser convertido para imagens/OCR pelo host.

## Monitoramento e réplica

```json
{"project_id":"ID","action":"status"}
{"project_id":"ID","action":"watch_start","seconds":120}
{"project_id":"ID","action":"watch_stop"}
{"project_id":"ID","action":"sync","target":"neo4j","paths":["src/orders"]}
```

Usar manage_graph_context. A derivada observa alterações e chama project_index existente com debounce de800ms e execução serial por assinatura. O original reutiliza o watcher já pertencente ao servidor/daemon, com suas configurações, fila e lock; watch_stop não encerra esse watcher global nem sessões compartilhadas. O estado retorna stopped=false e explica a propriedade. Não há um segundo watcher ou fila de tarefas. A observação temporária da derivada não é persistida após encerrar o processo.

Sync é opt-in: MCP_GRAPH_SYNC_ENABLED=1 e perfil no host. Neo4j usa MCP_GRAPH_NEO4J_URI, MCP_GRAPH_NEO4J_USER, MCP_GRAPH_NEO4J_PASSWORD. FalkorDB usa MCP_GRAPH_FALKORDB_URI (redis:// ou rediss://). Nunca passe segredos nos argumentos MCP ou no Git. O conector usa uma réplica derivada limitada a500 nós/1000 arestas, com escopo por projeto. Upsert somente: não remove itens ausentes nem substitui memória/tarefas. Neo4j usa transação e parâmetros; FalkorDB usa parâmetros Cypher e um nome de grafo derivado do escopo, com possibilidade explícita de falha parcial entre as duas consultas. O serviço deve estar configurado pelo responsável antes da chamada. Nenhuma conexão externa é iniciada no boot ou em consultas read-only.

## Respostas, incidentes e regras

O próprio agente já conectado ao MCP sintetiza as fontes retornadas por query/explain, cita caminho/hash/evidência e distingue extração de inferência. Isso evita outro LLM e outro armazenamento. Incidentes podem usar as notas/tarefas canônicas e os mesmos vínculos; regras verificáveis continuam em check_architecture_conflicts e nos testes existentes. Essas verificações locais não constituem prova formal geral nem instrumentação de produção.
