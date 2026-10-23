# Validação Ponytail — 1.0.0-rc.5

## Entrega

Implementação própria ampliada primeiro no MCP original, depois portados os mesmos módulos (núcleo, seleção Git e workflow) para a derivada. Origem consultada: Ponytail 5.3.2. Matriz em docs/PONYTAIL-MAPPING.md. Nenhum novo servidor, backlog, banco de métricas, dashboard ou configuração concorrente.

Seis modos na ferramenta existente: plan/review/audit/debt/help/gain. Original permanece com 29 ferramentas; derivada com 63. Report verifica snapshot/path/hash/linha/trecho, enquanto o agente conduz análise e checks. Auditoria prioriza leitura e não gera findings automaticamente.

## Evidências

- Original: 25 testes focados aprovados (guidance/workflow/cache) e build TypeScript aprovado. Teste de checkpoint confirma o mesmo mecanismo canônico, incluindo recusa de observação inválida.
- Original em sessão SDK isolada sobre código real: 29 ferramentas; seis modos, seleção uncommitted, mapa/snapshot, relatório ancorado, recusa de aprovação com checks não executados, off e gain conferidos. Sem reinício do daemon compartilhado.
- Derivada:check e 55 testes aprovados, incluindo protocolo MCP, preferência compartilhada entre sessões e isolada por projeto, reutilização do backlog/checkpoint, métricas desconhecidas, staged/branch e external diff desativado.
- Proveniência: SHA256 e transpilação reproduzível dos três módulos; skill validada pelo validador skill-creator. Setup mantém conexão e bloco existentes, agora com o contrato de engenharia.
- Pacote instalado isoladamente deve ser conferido pelo relatório VALIDACAO-PACOTE-1.0.0-rc.5.json desta entrega.

## Limites preservados

As sete falhas do original identificadas anteriormente foram reproduzidas no baseline anterior à primeira implementação (checkpoint/permissões/fixture do índice); não se afirma suíte integral do original verde. Esta entrega executou os 25 testes focados e build.

Seleção Git é limitada e local. Conector/CLI do host obtém PR/revisão remota; patch não prova alinhamento. Arquivos excluídos/apagados e checkout divergente precisam de inspeção histórica pelo host. Até 1000 sinais de auditoria e 200 checkpoints para gain; limites/cobertura são declarados. Referências lexicais e marcadores são candidatos, não prova semântica.

Somente último checkpoint por tarefa no resumo de observações; dados de uso são declarados pelo host, separados de tokens estimados do MCP e por moeda. Não há economia causal demonstrada, percentuais de benchmark transferidos ou importação de conversas pessoais. Interface nativa Band/Board não é copiada; o original reutiliza seu dashboard, a derivada expõe métricas no MCP existente.

Boot/setup/skill instruem o agente; não garantem obediência de um LLM. Testes de protocolo e instalação não equivalem a validação de interação em todos os aplicativos. Aplicar setup autorizado e recarregar clientes para atualizar instruções. Original aguarda reinício normal após sessões ativas; não houve reinício forçado.

Versão rc.5 local, sem envio ao GitHub nesta entrega. Pendências anteriores: autenticação do terminal inválida e conector informando repositório público, divergente da distribuição privada prevista. Não houve alteração de visibilidade. Pacote permanece private/UNLICENSED, sem publicação npm; licença depende do titular.
