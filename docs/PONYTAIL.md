# Engenharia com apoio do MCP — rc.5

A implementação própria foi ampliada primeiro no MCP original e depois portou os mesmos três módulos para App Memory. Motor 2.0; referência consultada: Ponytail 5.3.2. Não instala o plugin externo nem copia sua interface de sessão.

Use get_ponytail_guidance com project_id e task. Existem seis modos na mesma ferramenta, sem ampliar o catálogo de 63 ferramentas:

| Modo | Resultado e trabalho do agente |
| --- | --- |
| plan | Candidatos de reuso e impacto; o agente confere consumidores, critérios e alternativa mínima completa |
| review | Seleção de diff, fontes atuais e snapshot; agente lê fluxos, executa checks e envia relatório |
| audit | Mapa de entradas/config/testes e sinais priorizados de leitura; agente investiga correção, dados, carga, testes e simplicidade |
| debt | Comentários shortcut/ponytail ou marker customizado, teto/gatilho e candidatos do backlog existente |
| help | Contrato, precedência dos níveis e formato do relatório |
| gain | Métricas existentes e observações dos últimos checkpoints; sem benchmark causal |

```json
{"project_id":"ID","task":"Revisar pedidos","mode":"review","target":"uncommitted"}
{"project_id":"ID","task":"Revisar branch","mode":"review","target":"branch","base":"main"}
{"project_id":"ID","task":"Auditar módulo","mode":"audit","paths":["src/orders"]}
{"project_id":"ID","task":"Atalhos existentes","mode":"debt","marker":"TODO"}
```

Target também aceita auto (alterações locais ou último commit), staged, last_commit e patch. Para PR, o conector/CLI autorizado do host fornece o patch e a identidade da revisão; o MCP não busca URLs. Arquivos apagados/excluídos e divergência entre working tree e staged/commit/branch precisam de inspeção histórica pelo host. Git é local, com external diff/textconv/fsmonitor desativados, sem checkout, fetch ou hooks. Patch fornecido não garante alinhamento remoto.

## Relatório verificável

A preparação retorna snapshot_id. Envie report com o mesmo snapshot, summary, load, checked_paths(path/source_hash), findings, tests e not_checked. Cada finding exige path,line,source_hash,quote da linha atual,what,problem,scenario,fix,consequence,severity. Severidade: must_fix/should_fix/nice_to_have. Uma alteração em fonte/diff invalida o relatório. Arquivo/trecho/hash são verificados; a explicação e o resultado do check continuam declarados pelo host. review_completed e automatic_approval não são promovidos automaticamente. ready_for_host_decision significa prontidão do relatório dentro dos limites, não aprovação nem autorização de push/deploy.

Auditoria tem até 1000 sinais, que não são findings. Callers são candidatos lexicais; use get_symbol_context/get_code_references existentes para investigar relações. Arquitetura e configurações usam os verificadores existentes. A carga vem de fonte ou hipótese declarada; não há adivinhação de usuários ou concorrência.

## Preferência e ativação

memory_store(namespace=notes,key=engineering:ponytail,value=JSON serializado com level). Use expected_revision na atualização. Níveis lite/full/ultra/off: argumento explícito vence preferência do projeto, depois full. Uma escolha apenas para a sessão fica no argumento/checkpoint, sem alterar o projeto. Off suspende plan automático; review/audit/debt explícitos continuam disponíveis. Chave/projeto não se propagam para outro app.

Boot e setup preservam o contrato e os arquivos existentes; reaplique setup autorizado e recarregue para atualizar o bloco de instruções. O pacote inclui skills/mcp-engineering/SKILL.md para agentes com suporte a skills. Outros usam o mesmo contrato inserido em AGENTS.md; Claude lê a referência compartilhada. Não há novo hook, seletor de modelo ou permissão global.

## Dívida e observações

Debt aceita comentários inline e marcador customizado. A extração do teto/gatilho é heurística e precisa de conferência. Candidatos de tarefa são busca por caminho, não prova de equivalência semântica; conferir task_list antes de task_update. Não cria PONYTAIL-DEBT.md paralelo.

Campo opcional engineering em task_checkpoint: snapshot_id, scope, reused_paths,new_paths,checks,usage,evidence. Usage pode conter input_tokens,output_tokens,duration_ms,cost,currency; custo exige moeda. Usa o mesmo checkpoint/histórico/exportação, sem novo banco. Gain considera último checkpoint por tarefa, até 200 amostras, e distingue tokens estimados das respostas MCP de consumo do host. Não soma moedas diferentes nem apresenta ausência como zero. Não mede ganho causal nem importa sessões pessoais. Dashboard/telemetria existentes são reutilizados; a faixa nativa Band/Board específica do Claude não é reproduzida.

Matriz de aproveitamento: [PONYTAIL-MAPPING.md](PONYTAIL-MAPPING.md). Contrato do agente: [skill](../skills/mcp-engineering/SKILL.md). Hashes dos módulos em ponytail-port.json; testes conferem reprodução do JavaScript.

Fontes: [método](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md), [review](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail-review/SKILL.md), [audit](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail-audit/SKILL.md), [debt](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail-debt/SKILL.md). Implementação própria; licença do produto permanece pendente.
