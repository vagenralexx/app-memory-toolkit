# Desenvolvimento do App Memory Toolkit

Este repositório contém somente a nova ferramenta. Preserve as regras e o projeto de referência; nenhum caminho externo é alvo de alteração.

Leia README.md, INSTALL.md e docs/PRODUCT.md. Não publique nem escolha licença sem pedido do responsável. private/UNLICENSED representa decisão pendente.

Use Node.js24+. Valide npm run check e npm test após mudanças de comportamento. Testes devem usar pastas temporárias isoladas, sem alterar configurações reais de clientes. APP_MEMORY_TEST_TMP permite escolher uma pasta autorizada no sandbox Windows.

Ao atualizar o catálogo, capture tools/list do servidor real. Mudanças em instruções e setup devem preservar documentos existentes e nunca ampliar permissões do cliente. Não inclua bancos, pesos, node_modules, configurações pessoais ou segredos no Git.

Para usar esta ferramenta em outro projeto, siga INSTALL.md. O protocolo de início é start_project com raiz absoluta; o MCP não deve assumir o cwd de seu próprio processo como app do usuário.
