# Instalação pelo GitHub — validação rc.2

Em 23/10/2026, foi criado o repositório privado vagenralexx/app-memory-toolkit e executado clone em uma pasta isolada. A instalação travada por npm ci --ignore-scripts passou usando o cache local. Node24.21.0, Windows.

A sintaxe foi conferida e os 34 testes passaram tanto no código de trabalho quanto no clone baixado do GitHub. O smoke executou setup pela CLI em modo prévia e aplicação; o bloco anterior de AGENTS.md foi preservado. Um cliente SDK iniciou o processo stdio usando exatamente command/args lidos do arquivo Codex gerado. Foram observadas 46 ferramentas e executados start_project, cadastro com respostas, preparação aditiva, indexação e nova inspeção de projeto cadastrado. README existente preservado. Relatório: installation-validation.json.

Isso valida a instalação e o protocolo com cliente real, mas não simula uma conversa de LLM nem uma sessão recarregada dentro dos aplicativos Codex, Claude Code, OpenCode ou Harness. O agente instalador deve conferir as ferramentas disponíveis após a recarga e chamar start_project de fato.

O workflow GitHub Actions inclui Windows e Ubuntu, mas não iniciou nenhum passo: GitHub informou bloqueio por pagamentos recentes ou necessidade de aumentar o limite da conta. Nenhum ajuste de cobrança foi feito. Run: https://github.com/vagenralexx/app-memory-toolkit/actions/runs/39969638154 . Portanto, não há validação Linux nesta entrega.

Licença pendente; código mantido privado e pacote sem publicação no registro npm. A hospedagem contém somente o produto; bancos de projetos, pesos, configurações pessoais e node_modules foram excluídos do Git.
