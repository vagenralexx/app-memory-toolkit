# Continuidade complementar e verificação — rc.13

Implementação própria, inspirada nos contratos examinados de Bend2 e ai-memory. Quatro módulos TypeScript compartilhados, com hashes e JavaScript reproduzível em continuity-port.json. Sem dependência dos compiladores, binários, serviços ou modelos desses projetos. Captura e executor começam desligados.

## Ferramentas e compatibilidade

`manage_continuity`: configure, observe, drain, offer, accept, preference, import_preferences, compact, restore, receipt, verify.

`get_continuity_context`: status, brief, recall, timeline, maintenance, export, profile, fidelity, performance, edits, receipts.

App Memory recebe project_id. Original recebe workspace=app|mcp e usa a raiz configurada, sem aceitar raiz arbitrária pelo MCP. Ambos usam sua memória canônica atual: registros research imutáveis no SQLite; namespace continuity:<hash_da_raiz> no LanceDB original. Não há segundo banco, daemon, watcher ou backlog. A derivada passa a68 ferramentas; o original a34. Regras, busca, grafo, Founder, Ponytail e design anteriores permanecem disponíveis.

Eventos técnicos têm canal lexical próprio de recall para não alterar a relevância da busca geral. O original grava esses eventos sem inicializar embeddings; o padrão de memory_store para os demais namespaces permanece semântico. O namespace continuity: é reservado ao adaptador. Na derivada, o título interno continuity:v1 é reservado e esses registros não geram chunks de recuperação geral.

## Captura explícita

Exemplo MCP da derivada:

```json
{"project_id":"UUID","action":"configure","config":{"enabled":true,"clients":["claude-code"],"capture_text":false,"max_events":2000}}
```

Isso altera somente a política de entrada. Não instala nem ativa hooks do cliente. `configure(enabled=false)` impede novos eventos e o replay dos pendentes até nova habilitação.

Entrada normalizada de observe:

```json
{"project_id":"UUID","action":"observe","observation":{"event_id":"call-1","session_id":"session-1","client":"claude-code","kind":"tool_error","tool_family":"file","outcome":"error","task_id":"TASK-ID","paths":["src/main.ts"]}}
```

Kinds: session_start, pre_compact, session_end, prompt, tool_result, tool_error. Famílias: file, search, shell, mcp, unknown. Campos desconhecidos são recusados. IDs/clientes/sessões são declarações do chamador autorizado; não constituem autenticação ou identidade inferida pelo servidor. task_id é referência declarada: o lifecycle canônico continua validando e retomando a tarefa explicitamente.

Texto é opcional, limitado e saneado antes da gravação ou da fila. Só é mantido com capture_text=true e família reconhecida; prompt, mcp e unknown continuam sem corpo. Não é captura completa de conversa. Redação remove padrões de credenciais, chaves privadas, JWT, bearer, credenciais em URL, atribuições sensíveis e alguns caracteres invisíveis. Não detecta todo segredo ou dado pessoal possível. Preferir metadados. Nenhum texto capturado vira instrução, regra ou evidência de teste executado.

### Adaptador local

- Derivada: `node scripts/continuity-hook.mjs --client CLIENT --project UUID --data PASTA_ABSOLUTA`.
- Original: `npx tsx scripts/continuity-hook.ts --client CLIENT --workspace app`.
- Ambos recebem JSON UTF-8 por stdin, máximo64KB; `--normalized` recebe o formato normalizado acima, sem action/project_id externo.
- O formato nativo aceito é um subconjunto fechado da família de hooks Claude: SessionStart, PreCompact, SessionEnd, PostToolUse, PostToolUseFailure e UserPromptSubmit. Nunca lê transcript_path; prompt, argumentos e resultados nativos não são copiados. Stop não é convertido em SessionEnd.
- Erros produzem diagnóstico de captura no stderr, sem falhar o agente. Sucesso retorna somente resultado/IDs, não conteúdo de observação.
- Codex, OpenCode e DeepSeek continuam usando MCP e também podem enviar eventos normalizados por adaptadores autorizados. Não afirmamos hook nativo completo ou configuração instalada nesses clientes. O modelo DeepSeek não fornece hooks por si só; depende do harness.

O replay usa a política atual. Fila transitória:100 arquivos,24KB por entrada,30 por drain, idade máxima7 dias; entradas expiradas/inválidas são contadas e preservadas para inspeção, não apagadas silenciosamente. Isso pode ocupar a capacidade até limpeza explícita. Evento novo sem espaço informa dropped/capacity. A fila não garante entrega sem perdas e não substitui a base. Se a política/base não puder ser lida antes da captura, a operação falha sem armazenar texto; não há cache de consentimento presumido.

As escritas do adaptador são serializadas por lock de escopo, com espera limitada; mesmo event_id/client/session é idempotente e conteúdo diferente é recusado. Lock abandonado não é removido automaticamente. Interrompa a captura, confira que não há escritor vivo e remova somente o lock do escopo afetado para recuperação manual.

## Briefing, histórico e ofertas

`brief` apresenta primeiro ponteiros, depois aprofunda sob budget_bytes. Preferências atuais entram primeiro; valores anteriores da mesma chave não voltam como defaults. Quando não cabe nem o envelope, a ferramenta pede orçamento maior. Expanda com timeline/id. Esse briefing complementa get_operating_rules/get_task_briefing; não substitui suas regras obrigatórias.

`timeline` e `as_of` consultam os novos eventos pelo tempo de ingestão no MCP. Não são pesquisa temporal universal do código nem afirmação de quando um fato era verdadeiro no mundo. `recall` aceita query/session_id/task_id e paginação; ele não faz embeddings nem usa um LLM.

`offer` guarda handoff_id/task_id/summary/next_action como referência à continuidade já existente. Ler status não consome a oferta. `accept` exige handoff_id e session_id e permite apenas uma sessão vencedora; repetir pela mesma sessão é idempotente. Não executa task_resume, não assume a última tarefa global e não cria outra fila. Aceitação é registro histórico de entrega, não lease de execução nem autenticação do usuário.

## Preferências e manutenção

`preference` exige key/value/evidence/confirmed=true; confirmed é uma declaração do chamador, não uma confirmação independente do usuário pelo servidor. São defaults abaixo das instruções atuais, regras e decisões do projeto. Não autorizam acesso, execução ou publicação.

`profile` exporta a visão atual em mcp-preferences/v1, checksum e paginação. `import_preferences` recebe preferences={projection,checksum,confirmed:true}; grava somente preferências no projeto explicitamente escolhido. Não importa regras, configurações de captura, recibos ou tarefas. Retry compara o valor atual; falha parcial informa a quantidade gravada. Nenhuma preferência é colhida automaticamente de outros projetos.

`maintenance` propõe compactação de observações episódicas antigas e aponta trechos normalizados idênticos em uma amostra limitada. Não conclui equivalência de eventos, contradição semântica ou autoriza merge. Regras, decisões e tarefas canônicas não são alvos.

`compact` exige target_id e expected_digest do original. Havendo compactação/restauração anterior, expected_state precisa do digest desse último evento. Retém linhas iniciais e candidatos literais, incluindo certas negações/erros/caminhos; é heurística limitada, não garantia de preservar o significado completo. O original permanece imutável e `restore` reativa sua projeção integral. Não há apagamento automático por idade/frequência. Timeline/export podem mostrar corpo projetado e digest do evento original; o checksum da exportação cobre a projeção apresentada.

## Verificação por perfil confiável

Por padrão, verify é recusado. O operador pode habilitar no ambiente do servidor:

```text
MCP_VERIFICATION_ENABLED=1
MCP_VERIFICATION_PROFILES=CAMINHO_ABSOLUTO_FORA_DA_ARVORE_AVALIADA
```

Exemplo de arquivo de perfis; substituir os caminhos e hashes, sem copiar os placeholders literalmente:

```json
{"version":1,"profiles":[{
  "name":"project-contracts",
  "version":"reviewed-checker-1",
  "command":"ABSOLUTE_NATIVE_EXECUTABLE",
  "args":["ABSOLUTE_TRUSTED_CHECKER"],
  "timeout_ms":30000,
  "source_paths":["src","test"],
  "criteria":[{"id":"contract-1","text":"Critério implementado pelo checker revisado"}],
  "trusted_files":[{"path":"ABSOLUTE_TRUSTED_CHECKER","sha256":"SHA256_DO_ARQUIVO"}]
}]}
```

O perfil e seus trusted_files precisam estar fora da árvore avaliada; arquivos de checker são fixados por hash. Args são fixos, sem shell, placeholders interpolados ou comandos recebidos por MCP. Executável deve ser nativo/absoluto; scripts usam interpretador nativo explícito. Escolha um verificador revisado que realmente implemente os critérios. Caminho, tamanho e mtime do executável também entram na identidade do perfil; isso não é atestado criptográfico da distribuição do interpretador.

`source_paths` é opcional e relativo: define o escopo textual da prova. Sem ele, usa o scanner completo. Arquivos excluídos, binários e fontes não suportadas não são verificados; fonte relevante indisponível ou cobertura incompleta recusa a verificação. As exclusões de segurança dos scanners continuam valendo. Resultado nunca aprova todo o app.

O subprocesso recebe cwd da raiz configurada e um ambiente mínimo, sem copiar chaves de API por padrão. Limites:120s no máximo,64KB combinados de saída, diagnóstico saneado reduzido. Timeout tenta encerrar árvore no Windows e grupo POSIX; isso não é sandbox e não restringe por si só rede, filesystem ou memória nativa. O checker confiável não deve criar daemons/processos em background. Não execute verificadores não confiáveis.

Estados: PASS_IN_SCOPE, FAIL_IN_SCOPE, TIMEOUT, RESOURCE_LIMIT, INFRASTRUCTURE_ERROR, INCONCLUSIVE e STALE_DURING_EXECUTION. Exit não zero registra falha do checker, não prova a causa de um defeito. Mudança nas fontes ou perfil durante a execução invalida o resultado. Parser/compilador/Bend ausentes não são instalados automaticamente.

Recibos executados incluem escopo, critérios e hashes, fingerprint das fontes, perfil/versão, duração e código de saída quando disponível. Uma chave local privada na pasta de dados assina o corpo; importação/exportação não leva essa chave. Recibos importados ou alterados não comprovam execução local. Para portar a memória, preserve o conteúdo e execute novamente as verificações no destino. A assinatura não protege contra quem já controla filesystem/processo/chave da instalação.

`receipt` registra relato do host com trust=host_reported_not_executed, mesmo quando result=pass. `receipts` informa current, que significa assinatura/perfil/fontes atuais, não aprovação geral. Para provar passagem, o resultado também deve ser PASS_IN_SCOPE.

App Memory task_update aceita verification_receipts opcional: exige execução local assinada, atual e aprovada no escopo; grava critérios verificados. Original task_handoff aceita o mesmo campo, valida e guarda ponteiros em context_refs. O fluxo antigo sem esse campo permanece compatível e declarativo. Critérios humanos e acceptance_met não são inferidos nem aprovados automaticamente pelos recibos.

## Avaliação e propostas

- fidelity: expected must_mention definidos por autor de fixture, com etapas capture/projection/retrieval/answer; mede preservação literal por etapa, não correção semântica de respostas.
- performance: compara baseline/candidate declarados, mesmo cenário/hardware e correção; latência/RSS positivos e tolerância explícita. Não executa benchmark nem promete ganho nos MCPs.
- edits: verifica arquivo atual, hash, intervalo de caracteres e sobreposição; classifica candidato, stale, fora de escopo ou conflito. Não aplica mudanças, não comprova equivalência AST e não substitui reconciliação existente.

## Distribuição e limites deliberados

Todos os dados permanecem nos backends existentes. Backups/exportações usuais continuam disponíveis. Chave privada do verificador, fila transitória e locks ficam na pasta de dados, fora de Git/pacote; não são parte da projeção compartilhável. Não criamos serviço HTTP multiusuário, autenticação remota, acesso automático a históricos nativos, nova base Markdown/Git, reescrita em Bend/Rust ou aceleração GPU sem benchmark local.

Esses itens seriam outros produtos/superfícies de operação; não foram apresentados como implementados. O suporte opcional a projetos .bend pode usar um perfil configurado pelo operador com ferramenta previamente instalada. Provar um programa Bend separado não prova automaticamente o nosso servidor JavaScript.

## Fontes e atribuição

Pesquisa fixada em Bend faeb02eaa164d532f4cf13f1a455cbebda56ac40 (Apache-2.0) e ai-memory 1c506228b701f4496d3d9af6f00180749e0563d1 (MIT). Foram usados padrões arquiteturais; não vendorizamos seus compiladores, runtimes, código ou fixtures nesta extensão. A licença do produto permanece UNLICENSED/pending; licenças já preservadas de integrações anteriores continuam no pacote.

- [Bend: workflow e gates](https://github.com/bendlang/bend/blob/faeb02eaa164d532f4cf13f1a455cbebda56ac40/.github/workflows/repo-gate.yml)
- [ai-memory: política de captura](https://github.com/akitaonrails/ai-memory/blob/1c506228b701f4496d3d9af6f00180749e0563d1/crates/ai-memory-hooks/src/capture_policy.rs)
- [ai-memory: briefing por níveis](https://github.com/akitaonrails/ai-memory/blob/1c506228b701f4496d3d9af6f00180749e0563d1/crates/ai-memory-hooks/src/brief_tiers.rs)
- [ai-memory: avaliação de fidelidade](https://github.com/akitaonrails/ai-memory/blob/1c506228b701f4496d3d9af6f00180749e0563d1/evals/src/fidelity.rs)
