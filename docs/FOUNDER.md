# Founder — negócio e landing pages

Uma ferramenta get_founder_guidance, 13 modos: os 11 módulos board,competitors,consumer,pricing,offer,cfo,marketing,brand,ops,launch,plan e as entradas landing/help. Implementação própria inspirada no [Founder Skill](https://github.com/Jakeschincariol/founder-skill), primeiro validada no MCP original e depois portado o mesmo núcleo para App Memory. Não instala nem executa o plugin/prompt/Python externo. Hash e compilação em founder-port.json.

## Uso

```json
{"project_id":"ID","task":"Preparar landing do app","mode":"landing","context":{"problem":"Pedidos espalhados","offer":"Painel de pedidos","cta":"Solicitar demonstração"}}
{"project_id":"ID","task":"Ver contratos e inputs","mode":"help"}
{"project_id":"ID","task":"Planejar campanha","mode":"marketing","context":{"launch_date":"2026-11-01"}}
```

Contexto explícito > memória notes/founder:brief > respostas confirmadas do onboarding. Campos:business,purpose,audience,problem,offer,price,currency,market,channel,differentiator,objections,proof,cta,brand,constraints,acceptance,launch_date,sources,claims,modules,evidence. Strings ou listas de strings onde cabível; sources/claims/modules têm estrutura própria. O nome e público já informados não são perguntados novamente. questions retorna lacunas e next_questions limita o próximo grupo a três. A chamada nunca grava memória ou arquivos; use memory_store com value JSON serializado e expected_revision ao atualizar.

No original, workspace=app|mcp escolhe a raiz configurada e persistence retorna namespace default/chave por hash da raiz. O briefing é o mesmo conceito, mas não se distribuem caminhos, base ou regras particulares. Sem cache de resposta: consulta deve refletir memória/inputs atuais.

## Módulos e reaproveitamento

Board aplica perspectivas de oferta/diferenciação/produto sem personificar autores ou alegar independência de revisores inexistentes. Competitors orienta pesquisa de alternativas e reclamações com fontes/datas; host usa conectores autorizados. Offer/marketing/brand preparam proposta/mensagens/voz, preservando a marca e as escolhas do projeto. Ops organiza entrega/capacidade/suporte e custos que entram na projeção. Launch prepara teste real e datas a partir de launch_date confirmada. Plan consolida summaries recebidos em context.modules e declara ausências, sem preencher hipóteses como fatos.

Landings usam o produto realmente disponível, objetivo/CTA e provas. O host produz o texto e implementação; get_design_guidance, componentes/tokens, get_code_references e get_ponytail_guidance já existentes cuidam de design/engenharia. Não há segundo gerador de UI, scanner, backlog ou dashboard. Conteúdo comercial só vira página depois de conferência de fonte e funcionamento pelo agente.

## Cálculos

inputs.economics exige currency ISO,unit,price,variable,fixed_monthly,startup,days_per_month,ramp_per_day com 12 números e evidence com fontes/premissas. Cada custo tem label/cost; lista vazia significa custo zero declarado. capacity_per_day opcional. Não preenche custo ausente com zero. Retorna contribuição/margem, equilíbrio, 12 meses, caixa mínimo modelado, primeiro mês de cruzamento do acumulado e cenários preço−10%,volume−20%,variável+10%. Resultados são projeções de ponto flutuante; pagamentos/recebimentos no mês, sem tributos/dívida/churn/depreciação implícitos. Capacidade desconhecida fica null. Não é escrituração ou garantia de viabilidade.

inputs.responses: até 500 itens com id único,origin=real|simulated,segment,buys boolean,reason,objection,source; prices opcional com too_cheap,cheap,expensive,too_expensive positivos/ordenados. Inputs.expected_ids opcional informa quais respostas faltam. Nunca responder pelo agente ausente ou trocar resposta simulada por real. Origem é declarada pelo host, não verificada por rede.

Mode pricing calcula quatro cruzamentos Van Westendorp separados por origem. Requer cinco respostas com preços por origem, 401 pontos de grid e interpolação; passo máximo informado. Sem faixa válida/variação suficiente, declara limite. Nunca mistura os grupos nem afirma preço ótimo comercial/conversão prevista. Confrontar preço com custo, capacidade e fontes atuais.

inputs.panel:seed,size padrão 20/máximo 100,segments(id,label,share somando 1),behaviours,objections,pitch. Cartões pseudônimos repetíveis e pitch único; não cria resposta nem lança subprocesso/agente. Quantidade de chamadas potenciais é explícita. Perfil/objeções de partida precisam de evidência ou rótulo de hipótese. Host pode analisar sequencialmente ou usar agentes se autorizado; simulados não viram testemunhos, demanda ou taxa real. Panel com respostas exige origin=simulated.

## Claims e relatório

sources:[{id,kind,reference,observed_at}] com kind=user_confirmed|source_read|real_customer|simulated|hypothesis. claims:[{id,text,status,source_ids}] com status=supported|hypothesis|simulated|planned. Supported exige referência existente, mas é declaração do host. O servidor não busca link nem verifica a verdade, permissão, atualidade ou correspondência semântica.

Report exige snapshot_id,summary,sections e not_checked. Seção:{id,text,purpose,claim_ids}; purpose=copy|testimonial|metric|scarcity|guarantee. Afirmações especiais exigem claims sustentados por fontes não simuladas; testimonial também exige fonte real_customer. Copy sem evidência continua rascunho. A validação não detecta toda alegação sem claim_id; o agente confere cada frase e não inventa escassez, desconto, clientes, garantias ou logos. Mudança de contexto/inputs invalida snapshot. publish_approved permanece false: o relatório não autoriza publicação externa.

## Persistência, ativação e limites

Salvar briefing/summaries em memory_store existente. Decisões, tarefas, checkpoints/handoff/exportação usam ferramentas canônicas; não criar diretório founder/ como fonte concorrente obrigatória. Setup/boot incluem contrato compacto, e skills/mcp-founder/SKILL.md distribui o procedimento completo. Reaplicar setup autorizado e recarregar clientes para atualizar instruções; apenas conectar MCP não garante que um LLM seguirá o fluxo.

Matriz: [FOUNDER-MAPPING.md](FOUNDER-MAPPING.md). A integração não publica site, envia mensagens, inicia campanha, altera preço ou lança agentes automaticamente. Não escolhe stack ou cria landing fictícia quando a tarefa é só planejamento. Licença do produto continua pendente.
