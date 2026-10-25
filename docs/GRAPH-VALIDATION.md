# Validação de grafo — rc.7

## Entrega e sequência

Análise direta do código/contratos abertos do Graphify. REA foi autorizado caso necessário e não precisou ser usado: não houve binário fechado ou comportamento oculto para reconstruir.

Implementação própria primeiro no MCP original; depois mesmo graph-core.ts portado e transpilado na derivada. Ferramenta get_graph_context com overview/path/impact/snapshot/diff/help. Agora 31 ferramentas no original e 65 na derivada. Nenhum novo banco, servidor, índice paralelo, Graphify runtime/Cloud, hook ou dependência foi instalado.

## Verificação

- Original: 41 testes focados aprovados (7 de grafo, 9 Founder, 11 Ponytail e 14 cache), build TypeScript aprovado. Extração do scanner compartilhado manteve os testes Ponytail existentes.
- Derivada:check e 67 testes aprovados, incluindo SHA/transpilação do núcleo, direção, alcance transitivo, inferência opt-in, snapshots/diff/escopo/digest, ambiguidade, ciclos, docs, ligações canônicas e fonte stale sem cache.
- SDK real original em sessão isolada: 31 ferramentas, read-only, overview/caminho e snapshot/diff exercitados sobre fontes disponíveis. Conferir VALIDACAO-GRAFO-ORIGINAL-rc.7.json para contagens e cobertura efetivamente observadas. O app real tem cobertura parcial; exclusões/limites/fontes sem índice atual são declarados, nunca tratados como grafo completo.
- Catálogo da derivada obtido por tools/list real: 65 ferramentas. Contratos de boot/setup incluem o fluxo de grafo; sem garantia de que todo LLM os seguirá.
- Pacote instalado: conferir VALIDACAO-PACOTE-1.0.0-rc.7.json. Hashes dos artefatos em SHA256SUMS. Testes locais Windows/protocolo não simulam interação completa dentro de todos os agentes.

## Precisão e limites

Grafos são derivados de fontes lidas e índices/relações existentes. Original prioriza arquivos do índice dentro dos limites de leitura para evitar que documentação de ferramentas consuma toda a varredura. Não amplia raízes/exclusões; fonte não lida não recebe ligação atual. Derivada reusa TypeChecker/docRefs e record_link. Fontes alteradas/indisponíveis não conservam ligações estruturais como atuais.

Importador/chamador aponta para alvo. Impact incoming percorre consumidores; both é conexão, não causalidade. Calls são arquivo→símbolo, com alvo estaticamente resolvido como INFERRED e opt-in. Ambíguos não são percorridos. Referência, declaração canônica e comentário não comprovam runtime/implementação.

Nós/ligações e travessias têm limites. Profundidade 8/visitas 2000; grafo até 3000 nós/10000 ligações. Recorte e paginação explícitos. Snapshot acima 1.5MB é recusado com pedido para reduzir escopo; memória canônica só recebe automaticamente pelo fluxo humano snapshots fits_memory (até 28KB), não há escrita pela ferramenta. Digest garante integridade estrutural, não autenticidade da fonte. Diff exige mesmo escopo/filtro; remoção no grafo observado não equivale a remoção confirmada no código.

Agrupamento é componentes fracos/módulos existentes, sem Leiden. Ranking por grau, sem contains/rationale; concentração não é defeito. Mermaid é amostra limitada, não dashboard interativo ou QA visual de uma aplicação. Não foram portados parsers amplos/SQL/mídia, conectores Cloud ou verificação formal. Esses são itens avaliados na matriz GRAPH-MAPPING.md, não capacidades entregues.

## Ativação e distribuição

rc.7 candidata local. GitHub permanece na última versão sincronizada rc.5 até novo envio. Licença pendente, private/UNLICENSED e sem publicação npm. Atualizar/reaplicar setup autorizado e recarregar clientes para expor a ferramenta e instruções. Não houve reinício forçado do daemon original nem encerramento de sessões abertas.

As sete falhas antigas do original reproduzidas no baseline em etapas anteriores não foram tratadas como regressão; esta entrega não declara sua suíte integral verde. Verificou os 41 testes focados e build listados acima.
