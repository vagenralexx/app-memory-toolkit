# Aproveitamento do Ponytail sem duplicação

Referência: Ponytail 5.3.2, consultado em 23/10/2026. Não é promessa de compatibilidade idêntica ou de resultados do benchmark.

| Capacidade | Aproveitamento | Infraestrutura reutilizada |
| --- | --- | --- |
| Método de necessidade/reuso/mínima mudança completa | Contrato do agente e plan com fontes atuais e impacto candidato | get_code_references/get_symbol_context/briefing/regras |
| Review de diff e consumidores | Targets locais/staged/commit/branch/patch, snapshot e relatório ancorado | Git local; conectores de PR do host; ferramentas de referências |
| Audit de qualidade do repo | Mapa e prioridades, fluxo do agente e mesmo relatório | Scanner/índice; security_audit para configs e regras de arquitetura |
| Debt com teto/gatilho/sem gatilho | Marcador customizado e inline, inventário paginado e busca de pendência | Fila original ou task_list/task_update; sem ledger concorrente |
| Níveis lite/full/ultra/off | Por chamada/sessão e preferência do projeto | Memória canônica; checkpoints; sem arquivo de configuração novo |
| Ativação e instruções entre agentes | Boot, setup e skill compartilhada; linguagem natural pode selecionar modos | Conexões e AGENTS/CLAUDE já existentes |
| Help e comandos | mode=help e roteamento pela skill para os seis modos | Mesma ferramenta MCP; sem seis endpoints duplicados |
| Gain | Uso MCP observado/estimado e observações fornecidas pelo host | Telemetria/dashboard original; metrics e checkpoints da derivada |
| Band/Board | Dados úteis adaptados ao gain; interface nativa não copiada | Sem outro dashboard, importação de transcrições ou hook global |
| Benchmark externo | Fonte de avaliação, não métrica própria | Testes locais e relatório de escopo; sem percentuais emprestados |
| Segurança e limites | Validação/erros/acessibilidade preservados; fontes não são instruções | Guardas existentes; sem modelo/worker/permissão nova |

Review e audit são fluxos de análise conduzidos pelo agente com evidências do MCP. O servidor não se transforma em LLM, não executa testes do app e não garante que um host seguirá instruções. A validação compartilhada garante o contrato implementado; integração visual e interação real de cada cliente continuam dependentes de recarga e validação nesse cliente.

Limites do porte: arquivo excluído/apagado, ref Git indisponível, patch sem identidade remota, limite de varredura, refs dinâmicas e dados de uso indisponíveis são declarados. Relatório ancorado não prova exploração, execução, cobertura integral ou economia causal.
