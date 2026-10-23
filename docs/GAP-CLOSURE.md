# Contratos das capacidades acrescentadas — rc.3

## Início e integração

O fluxo segue start_project com a raiz absoluta autorizada. Instalação/ativação por setup preserva os servidores e regras existentes.62 ferramentas MCP stdio, projeto explícito e dados locais. Não há descoberta de sessão privada do host nem execução automática de agentes.

## Roteamento

worker_profile_set cadastra nome, cliente, modelo, fases, nível de raciocínio, localidade, ferramentas, prioridade e evidência de capacidade. Perfis são registros canônicos portáveis, sem credenciais. worker_list consulta; recommend_task_dispatch recomenda. get_task_briefing inclui a recomendação.

Fase/risco/raciocínio explícitos vencem heurísticas de texto. Perfis indisponíveis ou incompatíveis são excluídos com razão. Local só é elegível para transformação simples declarada, sem segredo e risco normal, usando perfil sem ferramentas. Risco crítico adiciona guardrails; não eleva modelo cegamente. Nenhum perfil padrão inventa que um modelo está disponível. O host escolhe e executa.

## Código

get_symbol_context usa TypeScript 5.9 TypeChecker sobre até 1000 arquivos JS/TS/JSX/TSX indexados e com hash atual. Resolve imports relativos e paths locais, aliases, reexports, métodos, assinaturas e tipos disponíveis. Exclui fontes stale e mostra imports não resolvidos. Não carrega tsconfig extends externo, plugins, bibliotecas não indexadas nem executa o app. Isso não equivale a typecheck de produção com todas as dependências. Python mantém extração parcial por linha.

get_code_references inclui resolução tipada; as referências do índice sintático são identificadas como não verificadas ao vivo. get_dependency_context lê manifestos atuais e aponta arquivos consumidores. Tipos e imports comprovam relações estáticas, não execução.

## Auditoria

security_audit lê uma lista explícita de configurações MCP, hooks, permissões, instruções, ambiente e manifestos dentro do projeto. Configuração pessoal só com include_host_config=true. Segredos são detectados localmente e o retorno contém apenas regra, caminho, linha, hash, severidade e recomendação; nenhum valor literal.

Detecta aprovação irrestrita, permissões amplas, bypass, download+execução, Unicode invisível, alegações de autoridade, credenciais e seletores flutuantes. Symlinks e arquivos maiores que o limite são reportados como não lidos. É read-only, paginado e não executa hooks, testes ou npm. Não consulta CVEs nem atesta segurança integral.

## Memória e feedback

memory_list: metadados paginados. memory_status: contagens e resultados. memory_feedback aceita key ou task, success true/false/partial, evidence obrigatória, idempotency_key e qualidade/fontes opcionais. Pode destilar aprendizado em patterns; retries iguais não criam nova entrada. Resultados declarados ajustam moderadamente o ranking lexical e são expostos como estatística, não probabilidade de verdade.

memory_delete exige revisão. Padrão: retirar a memória, mantendo histórico. purge=true faz snapshot consistente antes de excluir registro, índice, chave e histórico da base ativa. Backups preservam o valor anterior e precisam de política de retenção própria. Tarefas continuam no backlog, não em namespace de padrões.

## Cache de sessão

Ferramentas de contexto aceitam cache_mode=reference opcional. Primeiro retorno entrega o conteúdo e cache_ref; repetição sem mudança devolve referência compacta. resolve_cached_ref expande com budget suficiente. Cada conexão tem cache próprio, LRU 64 e TTL 30min; revisão de projeto/modelo invalida. Outro cliente ou reinício não resolve a referência. O modo padrão full segue retornando conteúdo. O cache de ranking persistente é separado desse cache de respostas.

## Arquitetura e reconciliação

architecture_rule_set registra restrições explícitas de dependência, caminho, import/camada, símbolo, texto ou domínio declarado ausente. ADR vinculado precisa estar aceito. check_architecture_conflicts avalia fontes atuais e dependências/imports/caminhos propostos, com evidência. Zero violações só vale no escopo declarado/lido e não aprova arquitetura.

knowledge_claim_record usa as mesmas verificações para afirmações de documentação. analyze_knowledge_drift combina hashes, links/caminhos/símbolos, claims e estados futuro/histórico. Movimento por hash tem evidência forte; mesma basename e mudança de assinatura produzem candidatos, nunca certeza de renomeação. Consultar outro projeto/worktree exige IDs explícitos. Não há prova infalível de contradição em toda frase natural.

propose_knowledge_patch aceita drift_id opcional; nesse modo só permite movimento comprovado e inclui fingerprint de código. validate_knowledge_patch recusa alteração da fonte ou do código. Aplicação permanece na CLI patch-apply --apply com backup; regras e ADRs protegidos não são reescritos automaticamente.

## Corpus visual

get_design_guidance consulta oito guias próprios, exemplos e regras do projeto. get_react_view_transitions contém cinco padrões próprios com código, reduced motion e referência de disponibilidade. Não se redistribuem skills/corpus privados do projeto anterior. O resultado é orientação; o agente precisa renderizar e validar a interface.

Fontes consultadas em 23/10/2026: [React ViewTransition](https://react.dev/reference/react/ViewTransition), [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API), [WCAG Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/) e [OWASP Top10](https://owasp.org/projects/top-ten). O corpus e os verificadores são implementações próprias; esses links não constituem certificação.

## Validação

A matriz CAPABILITIES.md delimita os 28 equivalentes. A suíte exercita casos reais de protocolo e fixtures de erro, obsolescência, concorrência, redaction e preservação. A validação de instalação limpa acompanha a release. Testes dentro de cada aplicativo final dependem de recarregar a conexão; não são simulados por um cliente SDK.
