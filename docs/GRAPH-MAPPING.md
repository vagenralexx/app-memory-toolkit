# Aproveitamento do Graphify sem duplicação

| Referência | Melhoria entregue | Reuso/limite |
| --- | --- | --- |
| Query/path/explain | get_graph_context:path/impact/overview com direção e evidência por ligação | Índices e relações existentes; sem novo motor de busca concorrente |
| Proveniência de ligações | EXTRACTED/INFERRED/AMBIGUOUS e mecanismo/hash/caminho | Inferência opt-in; ligação ambígua não é percorrida |
| Graph diff | Snapshots determinísticos e diff de nós/ligações, escopo/filtro/digest verificados | Memória canônica opcional, sem nova base de grafo ou snapshot automático |
| God nodes | Ranking de grau estático sem contains/rationale | Não é finding; TypeChecker/índice preservados |
| Communities | Módulos existentes e componentes fracos | Não é Leiden; descoberta semântica de comunidades não implementada |
| Cross-file links | Imports atuais, alvos de calls resolvidos e relações canônicas/documentais | Original usa índice estrutural; derivada usa TypeChecker. Runtime não é comprovado |
| Rationale/doc refs | Comentários NOTE/WHY ancorados e links/menções documentais | Extratores/grafo documental existentes, sem promover comentário ou referência a ADR aceita |
| Import cycles | Componentes fortemente conectados nas relações de importação disponíveis | Limites/cobertura explícitos; amostra de membros por ciclo |
| Export visual | Mermaid limitado opcional | Sem novo dashboard interativo ou assets/remotos |
| Multilinguagem/SQL/mídia | Não portado nesta entrega | Selecionar parsers conforme necessidades reais; não duplicar TypeChecker nem instalar dezenas de dependências |
| Cloud/incidentes/formal verification | Não incorporado | Serviços anunciados não são capacidades do código local automaticamente |

Referência aberta: https://github.com/Graphify-Labs/graphify (arquitetura/analyze/contratos consultados em 25/10/2026). Implementação própria TypeScript/JavaScript; sem código, runtime ou comandos de instalação externos. Licença atual da referência: Apache-2.0 com NOTICE e porções MIT históricas; não altera a licença pendente do nosso produto.

REA foi autorizado caso necessário, mas não utilizado: este trabalho é análise e integração de código-fonte disponível, sem binário ou comportamento oculto a reconstruir. Não foram executadas instruções externas como autorização.
