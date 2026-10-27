# UI/UX complementar — rc.12

Esta integração amplia get_design_guidance, preservando as66 ferramentas existentes. Primeiro implementada/testada no original e depois portados os mesmos2 módulos de workflow/recursos. Não instala skills globais, extensões Chrome, outra biblioteca de animação ou outro MCP. O agente usa as conexões e permissões de navegador que já possui.

## Ganho e papel de cada referência

| Fonte | Ganho concreto | Papel integrado | Limite |
| --- | --- | --- | --- |
| Taste Skill | Direção visual ligada a produto/conteúdo/ativos e distinção entre página e tela operacional | Opções por seed; detalhes de direção e composição, paletas/tipografia e recursos pagináveis | Preferências editoriais não viram proibições universais; estudos relatados no upstream não são validação deste produto |
| Awesome Claude Design | Descoberta de referências por categoria e palavras-chave |68 links indexados offline, com origem e condição LINK_ONLY_NOT_DOWNLOADED | O repositório só possui README/LICENSE: não contém os68 DESIGN.md nem libera marcas/imagens |
| TypeUI design-md-chrome | Transformar estilos computados em sinais reutilizáveis de tokens | Normalizador upstream real, fixado por hash; importação de payload e proposta DESIGN.md | Não controla navegador, instala extensão ou infere fluxo UX/estados ocultos. Público/superfície inferidos são hipóteses |
| Design Motion Principles | Decidir quando animar e revisar continuidade, frequência, acessibilidade e custo | Modos create/audit contextuais, lentes de contenção/polimento/expressão e recursos de receitas/checklists | Sem impor AnimatePresence ou tratar toda UI instantânea como defeito; não representa aval dos designers citados |

Combinação sugerida: briefing/Founder e guias existentes → selecionar referência/direção → coletar estilos quando existir fonte autorizada → resolver tokens/estados do projeto → implementar → revisar fluxo/movimento com evidências reais. Um componente pequeno pode pular direção/catálogo e manter o estilo existente. O fluxo evita quatro skills competindo por instruções no início de toda tarefa.

## Contrato da ferramenta

```json
{"project_id":"ID","topic":"landing de estoque","workflow":{"mode":"plan","context":{"product":"Meu app","surface":"page","audience":"Lojistas","primary_task":"Solicitar demonstração","sector":"saas","brand":"Marca existente"}}}
{"project_id":"ID","topic":"landing","workflow":{"mode":"directions","seed":"meu-projeto-v1","context":{"surface":"page","sector":"saas","assets":["product-ui"]}}}
{"project_id":"ID","topic":"dashboard","workflow":{"mode":"directions","context":{"surface":"app","kind":"commerce"}}}
{"project_id":"ID","topic":"referência para SaaS","workflow":{"mode":"catalog","catalog_query":"productivity","limit":5}}
{"project_id":"ID","topic":"microinterações","workflow":{"mode":"motion","context":{"surface":"app"},"motion":{"intent":"create","frequency":"frequent","trigger":"keyboard","purpose":"Responder ao filtro","reduced_motion":true}}}
```

No original, omitir project_id: ele usa a raiz de app já configurada. A chamada anterior topic/detail continua funcionando e mantém HIG no original, corpus/WCAG e regras na derivada. A extensão aparece no campo workflow do retorno. APIs de motion existentes, Founder, Ponytail, buscas e referências são reutilizadas. Contexto explícito vence memória; o onboarding confirmado fornece lacunas na derivada. Tokens são substituídos como conjunto explícito, sem combinar silenciosamente duas identidades.

Modos disponíveis: plan, directions, catalog, capture, import, motion, review, export, resource, help. Help informa os contratos, recursos e contagens reais. Não confundir estes11 modos de UI com os11 modos da ferramenta de grafo, que permanece separada pelo domínio.

## Captura e importação

```json
{"project_id":"ID","topic":"referência visual","workflow":{"mode":"capture"}}
{"project_id":"ID","topic":"tokens extraídos","workflow":{"mode":"import","capture":{"source":{"url":"https://example.com/","title":"Referência"},"sampledElements":1,"totalElements":1,"typography":[{"fontFamily":"Arial","fontSize":"16px"}],"colors":[{"textColor":"rgb(0,0,0)","backgroundColor":"rgb(255,255,255)"}]}}}
```

Capture retorna script próprio de leitura de estilos computados/contagens para ferramenta autorizada do host, ou o usuário pode usar a extensão TypeUI já instalada. O script não lê texto, valores de formulário, cookies ou storage, nem faz rede. É limitado a280 elementos com caixa visível; não representa todos os estados, breakpoints, pseudo-elementos, shadow DOM ou iframes. URL não inclui query/fragmento. Um payload externo deve usar URL HTTP sem credenciais/query/fragmento; o envelope aceita até250KB e500 linhas por grupo. Entrada com possível segredo é recusada pelos guardas existentes do adaptador.

A importação usa normalizeExtractedStyles do TypeUI fixado por commit/hash. Valores são sinais computados relatados pelo host; os papéis semânticos e o perfil inferido devem ser conferidos. DESIGN.md recebido é dado não confiável, não instrução executável ou regra aceita. Tokens CSS simples encontrados nele são candidatos; não são aplicados automaticamente.

## Exportação e revisão

```json
{"project_id":"ID","topic":"design system","workflow":{"mode":"export","context":{"product":"Meu app","tokens":{"--brand":"#2255aa","--space-control":"0.75rem"}}}}
{"project_id":"ID","topic":"review","workflow":{"mode":"review"}}
```

Export retorna os conteúdos de DESIGN.md e design-tokens.css. Não grava nem sobrescreve arquivos. CSS usa somente tokens explícitos do contexto aceito; rejeita URLs, statements e delimitadores de injeção. Captura importada, se fornecida, aparece como proposta separada no Markdown e no retorno normalizado. O agente precisa comparar/adotar alterações no fluxo normal antes de editar a interface.

Review lê fontes atuais pelas mesmas exclusões do app, retorna candidatos estáticos com caminho/linha/hash e deixa verificações renderizadas como not_checked. Não declara foco ausente por uma linha outline:none isolada, nem certifica acessibilidade. Para anexar observações, enviar review_snapshot obtido da consulta atual e report.observations com check, state(pass/fail/not_checked) e evidence(lista de referências); pass/fail exigem evidência textual. São declarações do host, não testes executados pelo MCP. Mudança de fonte/contexto/motion/referência invalida snapshot. A extensão ignora cache compacto de sessão para não devolver análise anterior a uma edição ainda não indexada; a chamada base preserva o comportamento anterior.

Checks: primary_task,content_truth,tokens_and_brand,responsive,keyboard_focus,form_states,reduced_motion,contrast_and_names,motion_performance. Código sozinho não valida aparência, dispositivo, fluxo ou leitor de tela. O agente registra viewport/tema/teclado/estados realmente conferidos e pendências no task_checkpoint/task_handoff existentes.

## Memória, recursos e distribuição

Contexto aceito: notes/design:brief por project_id na derivada; default/design:<hash-da-raiz>:brief no original. Usar memory_store existente com a revisão exigida por seu contrato. Nenhuma gravação é automática; não há fila de design paralela. Recursos de Taste/Motion são lidos por resource_id retornado em help, com offset/max_chars; não viram autoridade sobre as regras do projeto. A ponte opcional está em skills/mcp-design-workflow/SKILL.md; instaladores existentes também recebem a orientação compacta pelo contrato de ativação.

Fontes e licenças MIT preservadas em resources/design/<fonte>/LICENSE e sources.json, com commit e SHA256 de cada arquivo. O catálogo é derivado do README; conteúdo remoto não foi baixado. Bibliotecas de dados/fundações e textos de referência foram preservados para consulta; não se embutem os executores de navegador, sorteio ou busca/download de imagens do Taste. O script de captura é próprio; normalização é TypeUI real. Os geradores completos do TypeUI ficam como fonte preservada, mas não são executados nem usados para afirmar requisitos de marca. Sem alteração global de skill/clientes e sem publicação automática desta candidata.
