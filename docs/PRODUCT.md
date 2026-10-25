# Escopo da versão de avaliação 1.0.0-rc.9

## Objetivo e conclusão técnica

Entregar uma ferramenta nova, distribuível localmente e conectável a agentes MCP, para iniciar apps por perguntas ou incorporar bases existentes, organizar fontes e preservar contexto entre sessões. O MCP anterior é uma referência consultada, sem dependência de seu daemon ou de sua base privada.

O escopo entregue cobre os dois fluxos de entrada, geração de arquivos, atualização das respostas, análise de código/documentação, busca híbrida local, regras por projeto, backlog e continuidade, backup/portabilidade, reconciliação controlada, diagnóstico e instalação de conexões. O assistente de terminal é a interface desta versão.

## Fontes de verdade

- Requisitos: respostas confirmadas e especificações do app.
- Implementação: código atual, distinguido de código apenas observado no índice.
- Decisões: registros revisionados com estado explícito.
- Backlog operacional: tarefas no MCP, sem lista paralela em Markdown.
- Provas: resultados declarados com origem; o MCP não executa testes do app por conta própria.
- Índices, vetores e cache: derivados e reconstruíveis.

## Arquitetura

```text
Assistente de terminal / CLI ─┐
                              ├─ Serviços do projeto ─ SQLite/WAL + histórico
Clientes MCP via stdio ───────┘          │
                                        ├─ Onboarding e scaffold com prévia
                                        ├─ Scanner + análise sintática JS/TS
                                        ├─ Chunks + BM25 + embeddings locais + RRF/reranking
                                        ├─ Tarefas, regras, memória e relações explícitas
                                        └─ Snapshot, exportação e propostas de reconciliação
```

Node.js 24+, SDK oficial MCP, TypeScript para parsing e Transformers.js opcional para inferência local. Sem serviços pagos obrigatórios, chaves de API ou execução de modelos remotos. Processos dos clientes compartilham SQLite; controles de revisão evitam sobrescritas perdidas.

Schema 3 adiciona chunks, vetores com fingerprint, símbolos/referências sintáticas, relações, configurações e cache. A migração de schemas anteriores é aditiva. Versões antigas recusam uma base mais nova; para voltar, restaure snapshot compatível em uma pasta separada.

## Regras e diferenças da base original

As regras foram extraídas da leitura do código/contratos reais e da consulta ao MCP original em execução. Políticas do Melhor Preço/Print&Cut não viraram defaults universais. As regras gerais são anunciadas no initialize; regras de produto são registradas explicitamente por projeto.

Há busca híbrida, grafo de relações explícitas, referências sintáticas e cache. Isso não constitui uma cópia de todos os contratos ou do motor completo do MCP anterior. A versão rc.3 acrescenta TypeChecker para arquivos locais JS/TS, auditoria estática de superfície de agentes, roteamento consultivo configurável, corpus UI/React, cache de resposta por sessão, feedback de memória, regras verificáveis de arquitetura e classificação de referências documentais. A matriz CAPABILITIES.md mapeia as 28 capacidades de referência. Não há execução automática de agentes, interpretação infalível de linguagem natural, ingestão web automática ou vínculo implícito entre conversas.

## Critérios verificados

| Área | Critério |
| --- | --- |
| Novo app | Perguntas, campos obrigatórios, prévia, regras, fontes e estrutura sem sobrescrita |
| App existente | Fontes preservadas, inventário e informações declaradas separadas de execução |
| Recuperação | Chunks, origem, filtros de projeto, caminhos/símbolos e retorno progressivo |
| Híbrido | Modelo local real, fusão, reranking, fallback lexical e consulta sem resposta avaliada |
| Concorrência | Dois clientes, revisão obsoleta recusada e tarefas explícitas |
| Governança | Handoff imutável, dependências sem ciclos, histórico e provas declaradas |
| Portabilidade | Snapshot/restauração e exportação/importação com checksum, sem merge silencioso |
| Reconciliação | Proposta sem escrita, hash da fonte, trecho único e backup na aplicação explícita |
| Conexões | Formatos por cliente preservando outras entradas; conflito e idempotência testados |
| Distribuição | Fonte, iniciadores, pacote npm local e instalação verificada |

## Limites e decisões posteriores

Esta é uma candidata para testes locais, validada no Windows. A revisão manual dos fluxos em cada cliente, avaliações maiores por app e a decisão de licença/condições comerciais ficam para a etapa de avaliação do titular. Interface gráfica, runtime embutido, atualização automática e serviço multiusuário são expansões futuras, não pressupostos desta distribuição.

O pacote fica `private` e `UNLICENSED` até a decisão do titular, sem publicação automática.
