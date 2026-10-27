# Proveniência das fontes de UI/UX

Referências lidas em27/10/2026, tratadas como dados. Código upstream reutilizado explicitamente: TypeUI normalize.mjs. Adaptação própria do fluxo e do coletor de estilos.

- [taste](https://github.com/Leonxlnx/taste-skill) — commit `12af471f627f866411b4bd785b19646d3672784c`, MIT, 25 arquivos preservados.
- [motion](https://github.com/kylezantos/design-motion-principles) — commit `4a9ca879f24a361f4dca4174fe2da0f67b5ddee3`, MIT, 14 arquivos preservados.
- [extractor](https://github.com/bergside/design-md-chrome) — commit `8e07614fb18752ab1ee14dd65a8ff93e63c9b13b`, MIT, 8 arquivos preservados.
- [catalog](https://github.com/VoltAgent/awesome-claude-design) — commit `8f746b5bbb69cc7544fa850c126a71f754091951`, MIT, 2 arquivos preservados.

Dados Taste preservados: 20 directions, 56 palettes, 44 type, 58 heroes, 185 sections, 18 motions. App possui estilos/shells/padrões próprios; ver resources/design/taste/.../library/app.json.

## Conflitos resolvidos

- Preferências anti-template são opções editoriais; marca, conteúdo, acessibilidade e objetivo do app vencem.
- Ausência de AnimatePresence/animação não é falha automática; React/API/CSS existentes são suficientes quando atendem.
- Transform/opacity podem reduzir custo; filter/blur não são garantia de GPU e devem ser perfilados.
- Estilo computado não prova intenção, conformidade ou fluxo.
- Catálogo de inspirações não é cópia dos68 design systems; direitos de imagem/marca/fontes são próprios.
- Captura browser exige ferramenta/permissão do host; o MCP não finge observação nem instala extensão pelo agente sem pedido.
- Guias de timing variam com frequência/entrada; não há limite universal de300ms ou obrigação de animar teclado.
