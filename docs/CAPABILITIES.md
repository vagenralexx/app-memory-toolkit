# Matriz de capacidades — 1.0.0-rc.3

Escopo: as 28 ferramentas observadas em tools/list do MCP de referência em 23/10/2026. Todas têm um equivalente funcional na ferramenta independente. Isso não significa cópia de contratos, bases, defaults específicos ou implementação interna. Total do produto novo: 62 ferramentas.

| Capacidade de referência | Adaptação implementada | Evidência de teste |
| --- | --- | --- |
| `search_knowledge` | BM25, embeddings locais, RRF, reranking e referências | retrieval.test.js |
| `get_task_briefing` | Contexto + recommend_task_dispatch consultivo; host executa | integration/continuity + gaps.test.js |
| `get_design_guidance` | Oito guias próprios, regras, fontes e exemplos; conteúdo é referência | gaps.test.js |
| `get_react_view_transitions` | Cinco padrões, exemplos, reduced motion e disponibilidade | gaps.test.js |
| `get_ecosystem_context` | Projetos/módulos paginados sem mesclar continuidade | gaps.test.js |
| `get_project_context` | Identidade, lacunas, módulos, decisões e contagens | gaps.test.js |
| `get_module_context` | Chunks filtrados por módulo com orçamento e origem | extended-mcp.test.js |
| `search_decisions` | Somente decisões aceitas por padrão; histórico explícito | mcp.test.js |
| `check_architecture_conflicts` | Restrições por projeto, propostas de alteração e violações com evidência | gaps.test.js |
| `find_related_knowledge` | Grafo nas duas direções, profundidade até 2 e inferência marcada opcional | extended-mcp.test.js |
| `get_code_references` | Hashes/linhas, símbolos e TypeChecker entre fontes locais atuais; Python parcial | continuity.test.js + gaps.test.js |
| `get_dependency_context` | Manifestos atuais e consumidores por imports | extended-mcp.test.js |
| `knowledge_status` | Alias explícito de saúde e métricas por projeto | gaps.test.js |
| `analyze_knowledge_drift` | Hashes + movimentos/referências/futuro/histórico/renomeação candidata + claims | gaps.test.js |
| `propose_knowledge_patch` | Proposta localizada; drift_id opcional exige movimento comprovado | governance.test.js + gaps.test.js |
| `validate_knowledge_patch` | Hash documental, trecho único e fingerprint de código quando ligado a drift | governance.test.js + gaps.test.js |
| `memory_store` | patterns/notes, chaves e revisão; tarefas têm ferramentas próprias | continuity.test.js |
| `memory_search` | BM25 filtrado e ajuste limitado por resultados de feedback declarado | continuity.test.js + gaps.test.js |
| `memory_retrieve` | Chave exata, leitura progressiva, orçamento e estatística de feedback | continuity.test.js + gaps.test.js |
| `memory_list` | Metadados por namespace com limit/offset | gaps.test.js |
| `memory_delete` | Retirada por revisão; purge=true exclui valor/histórico da base após snapshot | gaps.test.js |
| `memory_feedback` | Resultado por tarefa ou chave, idempotência, qualidade, fontes e destilação | gaps.test.js |
| `memory_status` | Contagens por namespace/estado e resultados de feedback | gaps.test.js |
| `task_checkpoint` | Estado por tarefa com revisão própria | continuity.test.js |
| `task_handoff` | Pacote imutável e prompt de retomada | continuity.test.js |
| `task_resume` | IDs explícitos, isolamento por projeto e estado mais recente | continuity.test.js |
| `security_audit` | Read-only: MCP/hooks/permissões/segredos/seletores; host opt-in | gaps.test.js |
| `resolve_cached_ref` | Resposta por sessão, orçamento, TTL/LRU e revisão; outro cliente não resolve | gaps.test.js |

A integração MCP em test/gaps.test.js confere todos os 28 nomes contra test/fixtures/original-capabilities.json. O teste de nomes confirma a superfície; os testes comportamentais listados são as evidências funcionais.

O roteamento do próprio original é advisoryOnly/changesHostModel:false; não se trata de lançar processos de outros agentes. A auditoria original também é inspeção estática de superfície, não um agente autônomo nem scanner universal de CVEs. A nova implementação preserva essas fronteiras.

As diferenças intencionais incluem projeto explícito, tarefas fora do namespace de memória, revisão em mutações, retirada reversível por padrão e purge com snapshot. Não há compatibilidade drop-in dos argumentos. A base privada do app anterior não é distribuída.

Limites e procedimentos: [GAP-CLOSURE.md](GAP-CLOSURE.md). O catálogo JSON real é [mcp-tools.json](mcp-tools.json).
