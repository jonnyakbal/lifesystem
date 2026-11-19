# Cobertura MCP do LifeSystem

Inventário a partir do código em 19/11/2026. A disponibilidade em produção depende da versão publicada e dos escopos da credencial. O endpoint descobre ferramentas por credencial com `tools/list`.

## Diário pessoal

Usa a mesma coleção e as mesmas entradas por data de `/diario`. Diário de bordo permanece em `log_entries:*`.

| Escopo explícito | Ferramenta | Entrada |
|---|---|---|
| `journal:read` | `list_journal_entries` | `from` e `to` em YYYY-MM-DD, inclusivos; `limit` de 1 a 31 (padrão 7). |
| `journal:write` | `save_journal_entry` | `entryDate` em YYYY-MM-DD, ao menos um de `content`, `gratitude`, `mood` ou `pillarChecks`; `expectedUpdatedAt` obrigatório ao editar. |

A leitura retorna as entradas mais recentes primeiro, incluindo a versão `updatedAt`. A escrita mantém os campos omitidos. Quando enviado, `pillarChecks` substitui o mapa inteiro. Humor aceita `great`, `good`, `neutral`, `bad` e `terrible`; os valores de pilares são inteiros de 0 a 10. A escrita retorna somente `id`, `entryDate`, `updatedAt` e `created`. A auditoria registra a operação, o cliente e o resultado sem conteúdo do diário. A escrita é direta para a credencial autorizada, sem proposta ou aprovação intermediária. Não há exclusão. A chave legada e o curinga geral não habilitam o Diário.

## Lacunas além do Diário

| Área ou ação | O que o MCP cobre | O que ainda falta |
|---|---|---|
| Notas e Wiki | Capturas e conversão para nota via `convert_capture` | Listagem orientada a notas, coleções da Wiki e operações próprias da organização CODE. |
| Visão | Nenhuma ferramenta dedicada | Consultar documentos da Visão, seções e horizonte, com escrita versionada em uma etapa posterior. |
| Revisão semanal | Tarefas e indicadores consultáveis separadamente | Consultar, registrar e configurar a revisão semanal e suas prioridades. |
| Planejar | Blocos de tarefas, adoção de evento, listagem do Google Agenda e ciclo de vida dos eventos gerenciados | Preferências de jornada, consulta unificada da semana/disponibilidade, processamento em lote e recorrência explícita de tarefas. |
| Financeiro | Lançamentos, resumo mensal, contas, cartões, faturas, orçamentos, credores e metas | Catálogo/gestão de categorias financeiras e operações específicas do fluxo de fatura que não são representadas pelo CRUD. |
| Conteúdo e Fontes | CRUD de conteúdo, itens e fontes, em escopos separados | Gestão de categorias, disparar atualização da fonte e ações dedicadas de clipping/análise. |
| Editais | CRUD e atualização de etapa com verificação do escopo do destino | Configuração, descoberta e análise oferecidas pela interface. |
| Indicadores e Pilares | CRUD de indicadores e leitura/edição de pilares | Criação e exclusão de pilares; os tool handlers atuais não oferecem essas operações. |
| Saúde e Profissional | Contratos MCP próprios com consulta, propostas, aplicação e recibos, conforme o domínio | Aprovação humana permanece na interface; dados de conectores e operações administrativas não devem ser adicionados ao perfil geral. |
| Escritório e agentes | Heartbeat usa autorização separada, e chamadas MCP têm auditoria | Sessões, chat, comandos e administração do Escritório seguem em APIs próprias. |
| Configuração e dados | APIs próprias da aplicação | Login, OAuth do Google, configurações globais, backup/migração e uploads ficam fora do acesso geral do agente. |

Para o agente pessoal, as lacunas mais diretamente ligadas à organização diária são **Revisão semanal**, **Notas/Wiki** e **Visão**. A consulta de disponibilidade também evitaria que o agente tivesse de reconstruir a semana combinando várias ferramentas.
