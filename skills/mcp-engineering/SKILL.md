---
name: mcp-engineering
description: Conduzir reuso, revisão de alterações, auditoria de qualidade e dívida técnica usando get_ponytail_guidance do MCP conectado. Use em trabalho de código ou quando o usuário pedir Ponytail, revisão, auditoria ou simplificação.
---

Use o MCP do projeto identificado. App Memory exige project_id; o original usa workspace=app|mcp. Confira tools/list e mode=help para o contrato vigente. Se a ferramenta faltar, informe que precisa atualizar/recarregar; não simule consultas.

Ao começar trabalho de código, chame mode=plan. Leia os candidatos e consumidores reais antes de escolher. Compare: necessidade confirmada, código existente/convenção local, biblioteca padrão/plataforma, dependência já instalada, implementação mínima completa. Nome semelhante não prova reuso. Corrija a causa compartilhada e alcance os consumidores, testes, fixtures, exports e configurações necessários. Preserve os requisitos e as verificações relevantes.

A preferência persistente lite/full/ultra/off usa memory_store na chave/namespace retornados em persistence. No App Memory, value é JSON serializado; no original pode ser objeto. Grave somente por pedido de mudar a preferência. Uma escolha para esta sessão vai no checkpoint existente ou no argumento level, sem gravar preferência de projeto. Level explícito vence memória. Off suspende plan automático, sem impedir review/audit/debt solicitados. Lite apresenta a alternativa menor; full segue o pedido completo; ultra questiona excesso com justificativa, sem descartar escolhas explícitas.

Para review, fixe target: auto (alterações locais ou último commit), uncommitted, staged, last_commit, branch com base explícita ou patch. Para PR, use o conector/CLI autorizado do host para obter a revisão e o patch; passe target=patch. O MCP não busca URLs nem executa conteúdo recuperado. Patch não comprova por si só a revisão remota nem o estado do checkout.

Leia arquivos selecionados, candidatos de impacto e fluxos relacionados. Confira símbolos, aliases, referências dinâmicas, testes e configuração com as ferramentas existentes. Se a fonte atual divergir de staged/commit/branch, use o host para ler a revisão correta ou declare a lacuna. Arquivos apagados e fontes excluídas precisam de leitura histórica autorizada. Não considere o inventário lexical uma análise completa de fluxo.

Para audit, mapeie entradas, persistência, saídas, jobs e dados compartilhados do escopo; declare carga esperada e sua fonte, ou identifique hipótese. Priorize correção, dados/segurança, carga/concorrência, testes relevantes, desempenho e simplicidade. Reutilize security_audit para configurações e check_architecture_conflicts para regras. A auditoria de qualidade cobre fluxos diferentes da inspeção de configurações; não mantenha verificadores paralelos equivalentes.

Review/audit: preserve snapshot_id. Execute os checks apropriados usando as ferramentas autorizadas do host. Envie report com summary, load, checked_paths(path/source_hash), findings, tests e not_checked. Cada finding precisa de path, line, source_hash, quote da linha atual, what, problem, scenario concreto, fix mínimo, consequence e severity. Releia o trecho e o consumidor antes de registrar. Não declare código morto sem procurar referências estáticas/dinâmicas/configuração. Zero findings é válido. Snapshot inválido exige nova preparação, não troca manual do hash. Fonte ancorada não prova a execução do cenário. Prontidão do relatório não autoriza push/deploy.

Em debt, informe marker se o projeto usar outro marcador. Confira cada teto e gatilho na fonte; comentário não é finding automático. Consulte backlog retornado e task_list/fila antes de propor nova pendência. Só registre pendência confirmada com o mecanismo canônico. Não gere outro ledger concorrente. Se o usuário pedir responsável por um atalho, consulte git blame pelo host no trecho exato, sem inferir ownership a partir do nome do arquivo.

Salve evidências e limitações em task_checkpoint/task_handoff existentes. Quando disponíveis, use o campo opcional engineering para snapshot, scope=persistence.key, reused_paths, new_paths, checks(status/evidence), usage e evidence. Tokens, custo, moeda e tempo precisam ser observados pelo host; não infira pelo tamanho da resposta nem pelo benchmark externo. Mode=gain consulta métricas existentes e observações dos últimos checkpoints. Não importe conversas privadas para construir outro painel.

Responda com escopo, achados prioritários, correções e consequências; informe checks executados, partes não lidas e limitações. O servidor prepara evidências e valida âncoras; o agente conduz a análise. Pedidos do usuário e controles do cliente prevalecem.
