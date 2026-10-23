# Base real consultada e adaptação

## Evolução até1.0.0-rc.3

A matriz vigente está em [CAPABILITIES.md](CAPABILITIES.md), cobrindo as 28 capacidades observadas. O catálogo do produto tem62 ferramentas. A tabela0.2 ao final é apenas histórico e não descreve as ausências atuais.

Foram acrescentados busca híbrida, TypeChecker local, Python parcial, corpus UI/React, roteamento consultivo configurável, auditoria estática de superfície, ciclo de feedback de memória, cache de respostas por sessão e reconciliação orientada a evidências. Limites explícitos estão em [GAP-CLOSURE.md](GAP-CLOSURE.md).

## Evidências em 23/10/2026

O MCP de referência foi consultado em execução, em modo de leitura, por um cliente MCP separado. A consulta não iniciou nem reiniciou o daemon. A identidade e os caminhos locais de projetos anteriores não fazem parte do contrato de distribuição.

Operações: handshake/initialize, `tools/list` e `memory_retrieve(namespace=patterns, key=regra-fila-unica-pendencias-mcp, mode=summary)`. O servidor anunciou 28 ferramentas e entregou suas instruções. A regra recuperada confirmou: boot enxuto, backlog único, atualização localizada com revisão, campos de execução e conclusão com provas. Leituras normais podem produzir métricas internas no servidor original; nenhuma operação de gravação de conhecimento ou mudança de configuração foi solicitada.

Também foram lidos diretamente, sem alteração:

- Repositório knowledge: `src/mcp/instructions.ts`, `src/mcp/server.ts`, `docs/mcp-operating-rules.md`, `docs/task-conversation-continuity.md` e arquivos de bridge/configuração relevantes.
- App base: `AGENTS.md`, `CLAUDE.md` e `docs/obsidian-vault/00-META/04-REGRAS-EXECUCAO-OBRIGATORIAS.md`.
- Perfil local do DeepSeek Harness: somente a estrutura relevante do item MCP do perfil Cordis, sem copiar credenciais ou o perfil inteiro.

A coleta preservou hashes dos seis arquivos centrais antes da adaptação, para conferir que permaneceram iguais ao final. Os caminhos locais e o relatório bruto de consulta ficam fora do pacote distribuível.

## Regras generalizadas

| Regra do sistema atual | Adaptação da nova ferramenta |
| --- | --- |
| Boot só com índice e fontes necessárias | `get_operating_rules` + `get_task_briefing`; detalhes por referência |
| Fila única, revisão e receita de execução | `task_list/task_update`, prioridade, tamanho, responsável, dependências, receita, método, paths e consumidores |
| Lifecycle cedo; checkpoint por unidade | `task_checkpoint`, `task_resume`, `task_handoff`; IDs explícitos por projeto |
| Handoff imutável com provas e próxima ação | Registro novo por handoff e prompt de retomada entre clientes |
| Buscar antes de duplicar padrões | `memory_search/store/retrieve` por namespace e chave; revisão na atualização |
| Fontes atuais e arquivo:linha | `get_code_references` verifica hash e aponta linhas; ausência de AST declarada |
| Separar futuro, observado, substituído e comprovado | Estados explícitos, decisões vigentes na busca padrão e hipóteses separadas de evidências declaradas |
| UI exige validação real; review exige provas | Política central por escopo e regras específicas por projeto |
| Dados recuperados não autorizam comandos | Instruções centrais do servidor e contrato dos agentes |
| Divergência docs/código não deve reescrever ADRs | Regra de reconciliação proposta; aplicação automática ainda ausente |

As regras ficam em `src/policy.js`, são anunciadas no initialize MCP e consultáveis por `get_operating_rules`. `project_rule_set` registra regras explícitas de cada app, com revisão. O indexador nunca transforma um documento encontrado em nova regra executável do servidor.

Não foram transformadas em defaults universais: prioridades do Print&Cut, proibição de recursos específicos do Melhor Preço, stack Supabase, migrações manuais daquele projeto, caminhos de disco, portas do daemon antigo, modelos fixos, obrigatoriedade de skills ausentes e limites de sessões definidos para uma equipe específica. Temas, ícones e regras de produto continuam configuráveis por app.

## Catálogo real e limites da adaptação

Nomes parecidos não implicam contratos idênticos. O App Memory é um produto novo, sem compatibilidade de substituição automática com todos os argumentos do servidor anterior.

| Tool do MCP original | Situação na versão 0.2.0 |
| --- | --- |
| `search_knowledge` | Implementada como BM25; vetores/fusão híbrida ainda ausentes |
| `get_task_briefing` | Implementada; sem roteador de modelos/dispatch do original |
| `get_design_guidance` | Parte das regras de UI adaptada; tool e corpus visual completos ainda ausentes |
| `get_react_view_transitions` | Ausente |
| `get_ecosystem_context` | Cadastro/listagem multi-projeto disponível; não existe essa tool |
| `get_project_context` | Contexto via `get_context`; contrato diferente |
| `get_module_context` | Consulta dirigida via `get_context`; sem mapa estrutural de módulos |
| `search_decisions` | Implementada; somente decisões accepted por padrão |
| `check_architecture_conflicts` | Protocolo de consulta a ADRs adaptado; detector ainda ausente |
| `find_related_knowledge` | Ausente; sem expansão de grafo |
| `get_code_references` | Implementada por busca lexical e hash atual; sem símbolos/callers AST |
| `get_dependency_context` | Manifestos no inventário; tool dedicada ausente |
| `knowledge_status` | Saúde via `knowledge_health`; contrato diferente |
| `analyze_knowledge_drift` | Protocolo adaptado; detector ausente |
| `propose_knowledge_patch` | Ausente |
| `validate_knowledge_patch` | Ausente |
| `memory_store` | Implementada; namespaces patterns/notes, projeto explícito e revisão |
| `memory_search` | Implementada por BM25, com filtros de projeto/namespace |
| `memory_retrieve` | Implementada por chave exata, com modos/budget; sem namespace reservado tasks do original |
| `memory_list` | Ausente como tool dedicada |
| `memory_delete` | Ausente; sem exclusão destrutiva nesta versão |
| `memory_feedback` | Ausente |
| `memory_status` | Contagens via `knowledge_health`; contrato diferente |
| `task_checkpoint` | Implementada com project_id/task_id e revisão otimista |
| `task_handoff` | Implementada, imutável, com prompt para outro agente |
| `task_resume` | Implementada por IDs explícitos; sem herança global nem metadata inventada |
| `security_audit` | Ausente; não foi substituída por um atestado genérico |
| `resolve_cached_ref` | Ausente; `resolve_reference` resolve registros persistentes, não cache de sessão |

Não copiamos a base de conhecimento do app anterior para a distribuição. A memória de cada novo app começa com suas próprias respostas, fontes e regras.
