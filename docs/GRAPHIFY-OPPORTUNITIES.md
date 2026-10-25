# Oportunidades Graphify e estado nos dois MCPs

Implementação independente inspirada em https://github.com/Graphify-Labs/graphify, arquitetura v8. Não há código upstream copiado ou runtime instalado. Os três módulos compartilhados possuem SHA256 e transpilação reproduzível em graph-port.json. Primeiro original, depois derivada. Licenciamento/distribuição continuam sob decisão do responsável.

| Oportunidade | Implementado/reutilizado | Limite real |
| --- | --- | --- |
| Memória e navegação pelo grafo | Nós de arquivos/símbolos/docs/registros e ligações com hashes | Recorte observado; cobertura parcial explícita |
| Caminhos e blast radius | BFS direcionado, impacto incoming, profundidade/paginação | Estático, sem prova de execução |
| Perguntas por assunto | Busca existente como sementes + vizinhos atuais; semântica opt-in | Sem síntese por LLM ou GraphRAG de corpus inteiro |
| Explain | Relações de entrada/saída com evidência | Explicação por fontes, sem causalidade automática |
| Comunidades | Modularidade por movimentos locais + partições conexas | Não é Leiden ou Louvain multinível |
| Topologia | Pontes, articulações, PageRank, concentração e ciclos existentes | Análise limitada às arestas elegíveis observadas |
| Perguntas estruturais | Pontes, nós isolados e inferências | Sugestões; não cria backlog |
| Atualização incremental | Índices incrementais existentes + cache SQL por conteúdo | Sem watcher novo/cache global de grafo/TypeChecker |
| Schema de dados | DDL SQL explícito, entidades e REFERENCES resolvido sem ambiguidade | Sem colunas, migrations/dialetos completos ou SQL dinâmico |
| Código em linguagens adicionais | Scanners existentes preservados, JS/TS/Python conforme adapter | Não instalados os40+ parsers AST de Graphify |
| Semântica docs/decisões/código | Link fornecido pelo host com hash/linha/trecho e inferência explícita | Sem chamada de modelo embutida ou importador irrestrito de dumps |
| Justificativas | NOTE/WHY e decisões canônicas existentes | Candidato não vira ADR aceita |
| Visualização | Mermaid existente; HTML autocontido interativo e SVG | Layout circular simples; conferência visual não concluída nesta sessão |
| Exportação | JSON, GraphML, Markdown, wiki, Obsidian, Cypher parametrizado | Até500 nós/1000 arestas; sem escrita automática |
| Versionamento do conhecimento | Snapshot/diff com escopo, filtro e digest | Remoção observada não comprova exclusão do código |
| Neo4j/FalkorDB | Exportação parametrizada reutilizável | Sem conexão, instalação ou sincronização automática |
| PDF/imagem/áudio/vídeo | O host pode converter e indexar documentação textual pelo fluxo existente | Nenhum extrator multimodal nativo adicionado; não acessa mídia por inferência |
| Cloud, incidentes, prova formal | Sem equivalente local implementado | Exigem outro serviço/instrumentação, integração e validação próprias |

Próximas oportunidades dependentes de implementação específica: parsers AST adicionais, extração SQL mais completa, importação de entidades externas, extração multimodal, watcher e cache estrutural amplo. Não estão ocultas sob o contrato de enrichment. Não é correto declarar100% reaproveitado.
