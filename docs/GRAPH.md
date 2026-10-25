# Grafo de contexto — rc.8

get_graph_context reúne onze modos em uma ferramenta read-only, sem novo banco, MCP externo ou runtime Graphify. Primeiro implementado no original e depois portado o mesmo núcleo. Inspirado na [arquitetura Graphify](https://github.com/Graphify-Labs/graphify/blob/v8/ARCHITECTURE.md), com implementação independente e índices próprios existentes. REA não foi necessário: a referência possui código-fonte aberto.

| Modo | Uso |
| --- | --- |
| overview | Concentração por grau, módulos existentes, componentes fracos, ciclos de imports e ligações entre módulos |
| path | Caminho mínimo por número de ligações, dentro de direção/filtro/profundidade/limites |
| impact | Alcance transitivo estático; padrão incoming, consumidores diretos/indiretos |
| snapshot | Snapshot derivado determinístico com escopo/filtro/digest e tamanho compatível com memória |
| diff | Nós/ligações adicionados, removidos do grafo observado ou alterados frente a previous |
| query | Sementes da busca existente, com expansão de vizinhos atuais e evidências; query obrigatória |
| explain | Nó selecionado e suas relações com direção e fonte |
| communities | Melhoria local de modularidade e refinamento de partições conexas; resolution entre0.1 e4 |
| audit | Pontes estruturais, articulações, PageRank e perguntas sugeridas; não aprova arquitetura |
| export | JSON, GraphML, Cypher parametrizado, SVG, Markdown, wiki, Obsidian e HTML interativo |
| help | Contratos, sentidos de direção, proveniência e limites |

```json
{"project_id":"ID","mode":"path","focus":"src/ui.ts","to":"src/data.ts","relations":["imports"],"max_depth":4}
{"project_id":"ID","mode":"impact","focus":"src/data.ts","relations":["imports"],"direction":"incoming"}
{"project_id":"ID","mode":"snapshot","paths":["src/orders"]}
{"project_id":"ID","mode":"overview","include_inferred":true,"diagram":true}
```

## Direção, identidade e evidência

Importador/chamador→alvo. Outgoing segue dependências; incoming encontra consumidores; both indica conexão sem causalidade. Focus/to aceitam ID, key, caminho exato ou label único. Nomes duplicados retornam candidatos, nunca uma escolha silenciosa. File key usa file:caminho; símbolos têm identidade específica do extrator. IDs são hashes estáveis do tipo/chave, não nomes globais. Escopo impede comparar projetos/raízes diferentes.

Cada ligação traz relação, confiança e evidência (mecanismo, caminho/linha/hash quando aplicável). EXTRACTED: ligação explícita da fonte ou registro canônico. INFERRED: alvo resolvido estaticamente, opt-in com include_inferred=true. AMBIGUOUS: candidato incerto excluído das travessias, mesmo com opt-in. Import explícito com alvo resolvido não comprova que o módulo está carregado em runtime. Calls partem do arquivo chamador e chegam ao símbolo; não se afirma um call graph completo por função.

Original reutiliza índice de código, grafo documental e guardas de fonte do Ponytail (scanner extraído como helper compartilhado). Confere SHA1 do índice contra texto atual, e usa SHA256 no grafo. Fonte alterada/indisponível/excluída ou índice de outro workspace não produz ligações estruturais atuais. Wikilink com basename ambíguo não é ligado automaticamente. Documents externos/planejados não viram prova de implementação.

Derivada reutiliza scanProject, TypeChecker, relações record_link e docRefs do analisador de drift. Confere fonte atual contra índice; não reindexa automaticamente. Nós canônicos mostram o registro existente e sua revisão/hash, sem duplicar tarefa/decisão. Menção/link de documento não prova funcionalidade implementada. NOTE/WHY em comentário ancorado gera nó de justificativa candidata, não ADR aceita ou instrução de execução.

## Snapshot e comparação

Schema mcp-graph/v1 inclui scope,filter,complete,nodes,edges,digest. Pares guardam identidade/fingerprint e metadados mínimos para explicar remoções. Hash/digest são verificação de integridade, não assinatura de autenticidade. Recuperar snapshot salvo com memory_retrieve em mode=raw para evitar resumo/truncamento. Para diff, entregar previous completo, mesmo escopo/paths/relations/include_inferred. Campos de consulta, como direção/depth, não alteram o snapshot do grafo filtrado. Troca de fonte, evidência ou registro pode mudar fingerprints mesmo mantendo ligação.

Se snapshot_available=false, o escopo excedeu 1.5MB e precisa ser reduzido. Fits_memory=true significa payload até 28KB; só então usar memory_store existente (notes/graph:snapshot por project_id na derivada; chave retornada no original). Value JSON serializado e expected_revision na atualização da derivada. A ferramenta não grava snapshots. Não truncar payload manualmente: isso invalida digest e compara um subconjunto enganoso. Para escopo maior, reduzir paths e manter filtros iguais.

comparison_complete só é verdadeiro quando ambos snapshots têm cobertura completa. REMOVED_IN_OBSERVED_GRAPH não prova remoção do código: pode refletir reindexação, políticas de exclusão ou mudança de cobertura. Não infere rename/move automaticamente. Snapshot não substitui fontes canônicas nem o índice existente.

## Escala e limites

Até 3000 nós/10000 ligações; pré-limites 12000 definições/20000 conexões; BFS até 2000 nós e profundidade máxima 8. Resultados paginados por limit/offset. Ciclos/componentes/módulos têm amostras limitadas. Diagrama Mermaid opcional mostra até 30 nós/60 arestas e é uma amostra, não interface interativa com o grafo inteiro.

Agrupamento usa componentes fracos e módulos já existentes; não implementa Leiden nem promete descobrir subsistemas sem avaliação. Grau elevado é prioridade de leitura, não defeito. Rationale é comentário, não validação de decisão. Declara limites de varredura, fontes sem índice atual e cobertura parcial; ausência de caminho significa apenas ausência dentro do escopo/filtros/limites.

## Uso pelo agente

Em refactor/review, consultar path/impact para mapear candidatos e conferir código atual com get_code_references/get_symbol_context, arquitetura e get_ponytail_guidance existentes. Ler callers/testes/config; executar checks pertinentes pelo host. Manter tarefas/checkpoints/handoff no fluxo existente. Setup/boot incluem contrato compacto; recarregar clientes após atualização. O servidor não inicia agentes ou comandos do projeto, não pesquisa rede e não autoriza publicação.

Matriz: [GRAPH-MAPPING.md](GRAPH-MAPPING.md). Hash de origem/transpilação em graph-port.json. Não adiciona parsers de dezenas de linguagens, SQL, mídia, Cloud, conectores de incidente ou verificação formal nesta etapa. Esses recursos da referência não são capacidades entregues automaticamente.


## Ampliação rc.8: execução e limites

```json
{"project_id":"ID","mode":"query","query":"como pedidos usam o estoque?","direction":"both","max_depth":2}
{"project_id":"ID","mode":"communities","resolution":1}
{"project_id":"ID","mode":"explain","focus":"src/orders.ts"}
{"project_id":"ID","mode":"audit"}
{"project_id":"ID","mode":"export","format":"html","max_nodes":200}
```

Query usa retrieve no App Memory e searchKnowledge no original, ambos existentes. Só sementes presentes no recorte atual entram na expansão. Sem sementes válidas, usa correspondência lexical nos rótulos e informa esse fallback. Respostas retornam contexto/evidência, sem gerar uma conclusão por LLM. A direção padrão continua outgoing; both deve ser pedido quando se deseja contexto em ambos os sentidos. No máximo200 nós são visitados nesse modo.

O campo export retorna conteúdo e nome sugerido; wiki/Obsidian retornam uma lista de arquivos com nomes derivados de IDs. O agente pode salvar esses artefatos no destino autorizado. Nada é gravado automaticamente. Até500 nós e1000 ligações por exportação; truncated revela o recorte. Cypher é texto parametrizado com parâmetros separados: não conecta nem escreve em Neo4j/FalkorDB. HTML é autocontido, permite buscar rótulos, filtrar relações, selecionar nós, pan/zoom e redefinir; não usa serviços externos. SVG usa disposição circular simples.

SQL lê declarações explícitas CREATE TABLE/VIEW/INDEX/TRIGGER/FUNCTION/PROCEDURE e referências REFERENCES entre tabelas do recorte, com identificadores citados e qualificados. Comentários e valores literais não geram declarações. É um subconjunto conservador de DDL, não um parser AST de todos os dialetos; não extrai colunas, SQL dinâmico, SELECT completo ou impacto de migrations. Alvos ambíguos/ausentes são avisos. O cache incremental é somente dessa extração SQL, por escopo/caminho/conteúdo, em memória do processo e limitado a256 entradas. Mudanças invalidam a entrada; arquivos removidos são descartados. A varredura/hash atuais e os índices existentes continuam necessários; não há watcher ou cache global de TypeChecker novo.

## Vínculos semânticos fornecidos pelo host

O agente/modelo pode propor relações para arquivos, documentação, decisões ou símbolos já observados. Formato:

```json
{"mode":"overview","include_inferred":true,"enrichment":{"schema":"mcp-graph-enrichment/v1","links":[{"from":"file:docs/decision.md","to":"file:src/orders.ts","relation":"explains","path":"docs/decision.md","source_hash":"HASH_ATUAL","line":4,"quote":"trecho literal da linha4","provider":"agente-do-host"}]}}
```

O envelope aceita até200KB e200 links. Cada link exige caminho dentro das fontes atuais, hash exato, linha/trecho literal e alvos existentes; campos desconhecidos, fontes obsoletas e âncoras fora do recorte são rejeitados e contabilizados. Relações permitidas: mentions, explains, implements, related_to, depends_on, calls, imports, references. Todas permanecem INFERRED: conferir uma âncora não comprova a conclusão semântica nem a correção de um extrator externo. Não há execução automática do Graphify, leitura arbitrária de caminhos, upload, credencial, modelo ou subprocesso. Propostas duram a consulta; persistência exige as ferramentas canônicas de memória já existentes e sua revisão normal.

Comunidades e pontes são calculadas sobre projeção não direcionada, desconsiderando contains/rationale; PageRank preserva a direção das demais relações. A implementação usa melhoria local determinística de modularidade e separação de partições desconectadas. Não é Leiden nem Louvain multinível. Comunidades são hipóteses estruturais, pontes não provam falha em runtime e perguntas não são tarefas aceitas automaticamente.

Confira [o mapa auditável de oportunidades](GRAPHIFY-OPPORTUNITIES.md). O conjunto não equivale a100% do produto Graphify/Cloud.
