# Avaliação da recuperação local

O roteiro de comparação usa `examples/rag-corpus.json` e `scripts/evaluate.mjs`: oito documentos e vinte consultas, incluindo quatro perguntas sem resposta no corpus. Um grupo contém paráfrases amplas e o outro contém consultas mais próximas dos termos do documento.

Os dois grupos foram inspecionados durante o desenvolvimento. Portanto, os resultados são regressão controlada, **não avaliação cega independente**, benchmark universal ou métricas de produção. O relatório completo acompanha a entrega em `RELATORIO-RAG-1.0.0-rc.1.json`.

No relatório da entrega, a busca híbrida recuperou o documento esperado entre os três primeiros em 15 de 16 consultas respondíveis. A busca lexical o recuperou em 9 de 16. As quatro consultas sem resposta retornaram lista vazia no modo híbrido. Uma paráfrase ampla sobre passar serviço para outra IA não recuperou o handoff esperado; a limitação permanece registrada, sem alterar a resposta esperada para fazer o teste passar.

Esses números não medem o acerto de respostas de um modelo. Uma lista pode conter candidatos irrelevantes; o agente ainda deve conferir se a fonte sustenta a afirmação. Escores de embeddings/reranker não são probabilidades de correção.

## Pipeline e limites

1. Chunks curtos, com projeto, módulo, origem, seção e linhas.
2. BM25 com remoção de termos comuns, preservando negações relevantes.
3. Busca por embeddings de 384 dimensões quando os vetores estão preparados.
4. Fusão RRF, reranking multilíngue local sobre um conjunto limitado e proteção de símbolo/caminho exato.
5. Preservação do melhor candidato lexical para que o filtro semântico não apague uma evidência literal.
6. Deduplicação e até dois chunks por documento; relações só quando solicitadas, profundidade 1.
7. Retorno sob budget aproximado, com `omitted`, `truncated`, escores e referências resolvíveis.

Filtragem semântica pode deixar de recuperar evidência e também aceitar ruído. Ajustes de thresholds são heurísticos, não atestados de resposta existente. O modo lexical permanece disponível e o fallback informa falhas dos modelos.

O cache guarda a recuperação por revisão de projeto, filtros, ranking e identidade de modelo; a apresentação/budget é feita à parte. Indexar novos vetores invalida o cache do projeto. Conteúdo, negações, código e identificadores não sofrem compressão semântica.

## Reproduzir ou avaliar outro corpus

```powershell
app-memory semantic-setup --data "D:\AppMemory\base"
node scripts/evaluate.mjs --data "D:\AppMemory\base" --input examples/rag-corpus.json --output "D:\Backups\avaliacao.json"
```

Crie um corpus próprio com perguntas reais, respostas esperadas e casos ausentes. Compare qualidade, latência e bytes no mesmo conjunto antes de afirmar melhoria. O relatório conta o payload; não calcula economia total de uma conversa.

Modelos utilizados: [multilingual-e5-small](https://huggingface.co/Xenova/multilingual-e5-small) e [mmarco-mMiniLMv2](https://huggingface.co/SugoLabs/mmarco-mMiniLMv2-L12-H384-v1). As métricas publicadas pelos autores não foram copiadas como desempenho desta ferramenta.
