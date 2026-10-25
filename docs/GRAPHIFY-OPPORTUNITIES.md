# Oportunidades Graphify — fechamento rc.9

Implementação própria inspirada no [Graphify](https://github.com/Graphify-Labs/graphify), validada primeiro no MCP original e depois portados os8 módulos compartilhados. Não há código Graphify copiado. As dependências opcionais mantêm suas próprias licenças/avisos no npm. Não é uma reprodução do produto Graphify Cloud.

| Oportunidade | Solução nos dois MCPs | Verificação/limite |
| --- | --- | --- |
| Caminhos, impacto, snapshots/diff, rationale | Núcleo e índices existentes preservados | Direção, hash, cobertura, paginação e inferência explícitos |
| Comunidades e análise estrutural | Modularidade local, partições conexas, pontes, articulações, PageRank | Equivalente funcional local; não declarado como Leiden |
| Consulta e resposta em linguagem natural | Busca existente e expansão do grafo; agente do host sintetiza a resposta com fontes | Sem outro servidor/modelo de resposta ou conclusão automática sem evidência |
| Linguagens adicionais | Gramáticas WASM locais opcionais; declarações AST comuns; chamadas locais por nome único | JS/TS continuam no TypeChecker/índice existente; sem declarar resolução semântica completa de todas as linguagens |
| Imports adicionais | AST explícito para Python, Java, Rust e includes locais C/C++ | Resolução por manifesto; ambiguidade/ausência vira aviso; chamadas/imports heurísticos permanecem inferidos |
| SQL | Parser AST opcional: colunas, tipos, PK declarada na coluna, views e eventos ALTER/DROP/RENAME/TRUNCATE | Dialeto explícito; erro/falta do parser preserva fallback DDL e aviso. Eventos não aplicam migrations nem presumem ordem entre arquivos |
| Atualização incremental | Cache de extração por conteúdo, cache de resultados após validação atual e cache do TypeChecker na derivada | Sem ignorar edições/deleções ou reutilizar hash antigo; limites de memória/processamento |
| Watcher | Original reutiliza seu reindexador/lock/fila; derivada usa o indexador canônico com observação temporária | Nenhum segundo watcher no original; derivada até3 assinaturas,5–900s e20 atualizações por assinatura |
| Entidades externas | Contrato mcp-graph-extraction/v1 importa entidades/arestas com hash, caminho, linha e citação | IDs próprios; sempre inferido; não aceita instruções como regras; transitório até gravação canônica explícita |
| Vínculos semânticos | Contrato enrichment já existente, unido ao importador de entidades | Sem segunda memória; agente/provedor precisa produzir a inferência |
| PDF | Extração textual local com PDF.js | Até20 páginas; não executa scripts; PDF escaneado pode exigir OCR prévio |
| Imagem | OCR local com Tesseract e traineddata já configurado | Sem download de idioma ao consultar; modelo de teste fora da distribuição |
| Áudio | WAV PCM16 mono/estéreo8–48kHz, reamostragem16k e ASR local | Até60s; modelo local obrigatório; não baixa pesos na consulta |
| Vídeo | Frame para OCR ou faixa de áudio para ASR via FFmpeg local configurado | Processa bytes por pipe, protocolos restritos, até20s por FFmpeg; depende dos codecs disponíveis |
| Texto de provedor externo | Transcrição/caption fornecida pelo host e vinculada ao hash binário atual | Não verificada semanticamente; rejeita hash antigo; respeita gitignore e exclusões existentes |
| Neo4j/FalkorDB | Conectores opcionais para upsert de réplica derivada | Desligados por padrão; perfil/credenciais no ambiente. Não apagam nós ausentes; FalkorDB pode ter falha parcial entre consultas |
| Exportação/visualização |8 formatos existentes, HTML local e Mermaid | Sem gravação automática. Sintaxe/escaping testados; conferência visual humana pendente |
| Cloud, incidentes e verificação formal | Reutilizar tarefas/notas de incidente, relações, regras arquiteturais e revisão existentes | Serviço Cloud, telemetria de produção e prova formal geral não são capacidades fornecidas por este MCP |

## O que ainda exige configuração ou ambiente de validação

As extensões foram implementadas; dependências e modelos opcionais precisam ser instalados/configurados no computador de destino. Os testes de conectores validam contratos com doubles; uma conexão real a Neo4j/FalkorDB requer um servidor e suas credenciais. Nenhuma réplica externa ou cliente real foi ativado nesta entrega. A aparência do HTML ainda precisa de conferência visual: a automação disponível foi interrompida por não identificar a URL do Chrome com segurança.

Não há promessa de SQL universal,40+ extratores semânticos completos, equivalência ao serviço Cloud ou prova de execução. Essas afirmações ultrapassariam a evidência e o escopo de reaproveitamento local. Consulte [os contratos de extensão](GRAPH-EXTENSIONS.md) e a validação desta entrega.
