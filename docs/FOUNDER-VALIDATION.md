# Validação Founder — rc.6

Implementação própria inspirada nos 11 módulos do Founder Skill, com landing/help adicionais. Primeiro no MCP original, depois mesmo núcleo TypeScript portado e transpilado na derivada. Não instala/copia/executa o plugin, scripts Python ou prompts externos.

## Evidências

- Original: 34 testes focados aprovados (9 Founder e 25 Ponytail/cache), build TypeScript aprovado e skill validada.
- Original em sessão SDK isolada sobre configuração real: 30 ferramentas, Founder read-only com 13 modos, perguntas de landing por lacunas, snapshot, memória por raiz e projeção numérica conferidos. Sem reinício do daemon compartilhado.
- Derivada:check e 61 testes aprovados, incluindo reprodução/hash do núcleo, cálculos conhecidos e falhas, painel determinístico, origem real/simulada isolada, proteção de prova/depoimento, snapshot, calendário, onboarding/memória/isolamento por projeto e protocolo MCP.
- Catálogo tools/list real: 64 ferramentas. Nenhuma ferramenta original existente foi removida; uma ferramenta agrupa os módulos de negócio.
- Contrato compartilhado incluído na skill e no setup/boot; skill-creator quick_validate aprovado.
- Protocolo do pacote instalado e hashes da distribuição: conferir VALIDACAO-PACOTE-1.0.0-rc.6.json e SHA256SUMS da entrega. Testes/instalação são locais Windows, não interação real com cada LLM/aplicativo.

## Sem duplicação

Onboarding fornece nome/público/dados já confirmados. Briefing/summaries usam memory_store/memory_retrieve (notes por project_id na derivada; default por raiz no original). Contexto explícito vence memória e onboarding. Tarefas/decisões/checkpoints/handoff/exportação/design/componentes/engenharia continuam nas ferramentas existentes. Não se cria outro banco, scraper, diretório founder obrigatório, fila, dashboard ou scheduler.

## Escopo efetivo

O MCP prepara lacunas, roteiros, projeções, cartões de pesquisa e validação estrutural de relatório. O agente conduz pesquisa, análise, escrita e construção da página. Não faz pesquisa web implícita, não lança 100 subagentes, não responde cartões, não envia campanha ou publica site. Sources e origin são declarações do host; link/hash não provam mercado, permissão ou verdade semântica.

Economia usa inputs explícitos e meses com recebimento/pagamento no período; faltas não viram zero. Ponto flutuante para projeção, sem tributos/churn/dívida/estoque modelados implicitamente. Sensibilidade a preço é aproximada com 401 pontos e grupos reais/simulados separados. Taxa observada descreve respostas, não previsão. Prova especial exige claim com fonte não simulada; testimonial também exige origem real_customer. Texto sem claim_id ainda precisa de revisão pelo host. Publicação não é aprovada automaticamente.

## Ativação e distribuição

A rc.6 é candidata local. GitHub permanece na rc.5 até sincronização desta versão; nenhum push/publicação rc.6 foi feito nesta etapa. Licença ainda pendente, pacote private/UNLICENSED e sem publicação npm. Atualizar/reaplicar setup autorizado e recarregar os agentes para anunciar Founder e novo contrato. Original continua sujeito à recarga normal; não interrompemos sessões ativas.

As sete falhas antigas identificadas na validação ampliada do original foram reproduzidas no baseline anterior à integração Ponytail; esta entrega não afirma toda suíte original verde. Executou os 34 testes focados e build descritos acima. Não há claim de eficácia comercial ou paridade drop-in com todos os scripts/hosts da referência.
