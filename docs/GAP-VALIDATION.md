# Validação da adaptação — 1.0.0-rc.3

Ambiente: Windows, Node.js 24.21.0, npm 11.19.0, em 23/10/2026.

- 47 testes aprovados na fonte e novamente em clone limpo baixado do GitHub; sintaxe de src/scripts/test conferida.
- 28 nomes do catálogo original conferidos contra fixture de captura real;62 ferramentas no servidor novo. Matriz funcional em CAPABILITIES.md.
- TypeChecker: aliases/reexports, método tipado, homônimos, fonte stale, paths local e extends externo recusado.
- Memória: revisão, feedback idempotente, destilação por tarefa/chave, ranking informado, paginação, retirada e purge com snapshot.
- Segurança: achados redigidos, hooks/permissões/pins, host só opt-in, paginação e fonte inalterada.
- Roteamento: perfis declarados, indisponibilidade, raciocínio, risco, elegibilidade local e briefing com dispatch consultivo.
- Cache de resposta: isolamento entre clientes, revisão, expansão com orçamento e retry.
- Arquitetura/drift: dependência/import proibidos, propostas, claims, fonte movida por hash, futuro/histórico e candidato a renomeação. Mudança de código invalida patch derivado.
- Portabilidade: perfis/regras/feedback preservados; parser Python recomposto sem mudar chunks/histórico.
- SDK MCP v1 conectado ao servidor com 62 ferramentas. Migrações schema 1/2 para 3 preservaram projeto e conteúdo indexado.
- npm audit --omit=dev: 0 vulnerabilidades conhecidas na consulta desta versão.

No próprio código real do App Memory: 68 arquivos indexados; TypeChecker encontrou uma definição e oito chamadas de recommendDispatch; dois arquivos consumidores da dependência TypeScript. Auditoria leu três arquivos da superfície explícita, não acessou configuração pessoal, não executou comandos e não encontrou achados nesses arquivos. Relatório: gaps-real-source-validation.json.

Pacote TGZ instalado em pasta vazia: criação/indexação/busca/contexto aprovados; os 28 nomes estão presentes. Foi validada a chamada tipada via alias, feedback, cache resolvível, auditoria e dispatch no briefing. Embeddings locais de 384 dimensões e reranker reais passaram também no pacote instalado. Relatório: package-validation-rc3.json. Esses resultados não equivalem a segurança integral, interpretação infalível de ADRs, execução dos testes do app do usuário ou sessão real em todos os aplicativos de agentes. Os controles e a recarga normais do host continuam valendo.

O workflow atual do GitHub Actions (run39974395588) também não iniciou por cobrança/limite da conta. A validação declarada acima é local; não há resultado de Linux confirmado nesta entrega.

O MCP original não foi modificado. Os seis arquivos de referência monitorados foram conferidos por SHA-256 ao fechamento. Licença pendente; repositório privado, sem publicação no registro npm.

Instalação pelo GitHub: installation-validation-rc3.json registra setup em prévia/aplicação, preservação de regras, conexão MCP usando o arquivo Codex gerado e start_project nos estados existente/cadastrado.
