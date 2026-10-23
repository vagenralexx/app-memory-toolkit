# Engenharia reuse-first — 1.0.0-rc.4

A ferramenta get_ponytail_guidance foi implementada primeiro no MCP original e validada com cliente SDK e fontes atuais. Depois seu núcleo foi portado, sem alterações de comportamento, para src/ponytail-core.ts e transpilado para JavaScript. O adaptador do App Memory usa scanProject e a fila canônica task_list/task_update já existentes.

```json
{"project_id":"ID_DO_PROJETO","task":"Corrigir retry dos pedidos","mode":"plan","paths":["src"],"limit":8}
{"project_id":"ID_DO_PROJETO","task":"Revisar mudança do cache","mode":"review","level":"full"}
{"project_id":"ID_DO_PROJETO","task":"Inventariar atalhos","mode":"debt","limit":8,"offset":0}
```

Plan localiza candidatos lexicais de reutilização e impacto em arquivos atuais, com caminho/linha/hash. O agente confere get_symbol_context/get_code_references, contratos, consumidores e testes antes de decidir reutilizar. Review entrega um roteiro com prioridade em correção, segurança/perda de dados, carga, testes, desempenho e simplicidade. Não executa testes nem inventa findings ou aprovação.

Debt coleta comentários shortcut:/ponytail: e distingue gatilho candidato de NO_TRIGGER. É necessário conferir a fonte e procurar pendência existente antes de usar task_update. Não cria ledger paralelo ou grava tarefas automaticamente. Levels lite/full/ultra afetam somente a orientação da chamada; o pedido do usuário e as proteções sempre prevalecem.

O scanner existente respeita .gitignore, exclusões do projeto, limites de leitura e política de segredo. Não lê configuração pessoal, não instala dependência, não inicia agentes ou hooks e não altera arquivos. A chamada fica fora do cache de resposta porque deve refletir edições ainda não indexadas.

Núcleo próprio inspirado no [Ponytail](https://github.com/DietrichGebert/ponytail), especialmente o [método principal](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md), [review](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail-review/SKILL.md) e [debt](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail-debt/SKILL.md). Não carrega nem copia o plugin ou seu prompt em runtime. Não promete os percentuais do benchmark externo. A licença pendente do App Memory não é alterada.

Proveniência em ponytail-port.json: SHA-256 do núcleo inicialmente validado, versão do motor e compilador. test/ponytail.test.js confere o hash e a reprodução do JS; divergência exige revisar o porte e atualizar a proveniência conscientemente.

No MCP original, a ferramenta usa workspace=app|mcp e respeita suas raízes configuradas, Git e exclusões RAG. No App Memory, project_id escolhe a raiz; nenhum caminho privado ou regra específica do original foi portado.
