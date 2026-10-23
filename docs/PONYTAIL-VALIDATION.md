# Validação — 1.0.0-rc.4

Implementação concluída primeiro no MCP original, seguida do porte do mesmo núcleo para App Memory. Nenhum plugin externo é instalado.

- Original: 19 testes focados aprovados, typecheck e build aprovados. Sessão isolada do MCP sobre fontes reais publicou 29 ferramentas e retornou candidatos com caminho, linha e hash.
- Validação ampliada do original: 7 falhas existentes foram reproduzidas também na cópia anterior às mudanças (checkpoints, criação de symlink/permissões e fixture do índice). Não são classificadas como regressão desta implementação; a suíte ampliada não está integralmente verde.
- Derivada: check e 50 testes aprovados. Hash de origem e transpilação reproduzível conferidos. Catálogo de 63 ferramentas capturado por tools/list.
- Pacote rc.4 instalado isoladamente: protocolo MCP, ferramenta de dívida sobre arquivo atual, 28 nomes de referência, TypeChecker, feedback, cache de sessão, auditoria read-only e briefing aprovados.

O daemon compartilhado original ainda atende sessões anteriores e sinalizou reinício pendente. A ferramenta foi validada em uma nova sessão isolada; não houve reinício forçado das sessões abertas. É necessária a recarga normal do servidor/cliente para anunciar a nova ferramenta. A derivada também requer sua atualização e recarga no aplicativo escolhido.

Testes locais no Windows e no protocolo MCP não atestam a execução de todos os fluxos por cada agente/LLM. Review é orientação, não revisão concluída; dívida é inventário de comentários, não finding automático. Licença permanece pendente e o repositório permanece privado.
