# Cobertura MCP do LifeSystem

Inventário a partir do código em 19/11/2026, atualizado com o catálogo pessoal. A disponibilidade em produção depende da versão publicada e dos escopos da credencial. O endpoint descobre ferramentas por credencial com `tools/list`.

## Diário pessoal

Usa a mesma coleção e as mesmas entradas por data de `/diario`. Diário de bordo permanece em `log_entries:*`.

| Escopo explícito | Ferramenta | Entrada |
|---|---|---|
| `journal:read` | `list_journal_entries` | `from` e `to` em YYYY-MM-DD, inclusivos; `limit` de 1 a 31 (padrão 7). |
| `journal:write` | `save_journal_entry` | `entryDate` em YYYY-MM-DD, ao menos um de `content`, `gratitude`, `mood` ou `pillarChecks`; `expectedUpdatedAt` obrigatório ao editar. |

A leitura retorna as entradas mais recentes primeiro, incluindo a versão `updatedAt`. A escrita mantém os campos omitidos. Quando enviado, `pillarChecks` substitui o mapa inteiro. Humor aceita `great`, `good`, `neutral`, `bad` e `terrible`; os valores de pilares são inteiros de 0 a 10. A escrita retorna somente `id`, `entryDate`, `updatedAt` e `created`. A auditoria registra a operação, o cliente e o resultado sem conteúdo do diário. A escrita é direta para a credencial autorizada, sem proposta ou aprovação intermediária. Não há exclusão. A chave legada e o curinga geral não habilitam o Diário.

## Consultas do agente pessoal

| Ferramenta | Escopo | Entrada e retorno |
|---|---|---|
| `get_week_availability` | `agenda:read` + tarefas (`tasks:read`) e Google Agenda (`calendar:read` ou `calendar:write`) | `date` (YYYY-MM-DD); `minimumMinutes` (1–1440, padrão 30). Semana de segunda a domingo no fuso de Planejar. Janelas livres unem blocos de tarefas e eventos ocupados, inclusive dia inteiro. Em falha do Google, `calendarStatus: unavailable` e `freeWindows: null` nos dias com jornada configurada. |
| `get_weekly_review` | `weekly_review:read` | Sem argumentos. Última revisão concluída, suas prioridades e o dia de revisão configurado. |
| `prepare_weekly_review` | `weekly_review:read` + `tasks:read`, `captures:read` e `projects:read` | `through` (YYYY-MM-DD); `limit` por grupo (1–20, padrão 8). Devolve rascunho com Inbox, tarefas abertas até a data, projetos ativos sem próxima ação e prioridades anteriores ainda abertas. O usuário conclui em `/revisao`. |
| `list_notes` | `notes:read` | Filtros opcionais `query`, `collectionId` e `codeStage` (`captured`, `distilled`, `expressed`). Devolve resumos. |
| `get_note` | `notes:read` | `id` de uma nota. Devolve texto, essência e vínculos. Capturas do Inbox e itens organizados ficam fora da consulta. |
| `list_wiki_collections` | `notes:read` | Lista coleções da Wiki. |
| `list_vision_documents` | `vision:read` | `section` opcional (`identity`, `vision_5y`, `timeline`, `dream`, `custom`); `includeContent` (padrão falso). |

Listagens de notas, Wiki e Visão aceitam `limit` de 1 a 50 (padrão 15) e `cursor` numérico, começando em 0. Use `nextCursor` para continuar. Os quatro novos escopos são explícitos. Nenhuma dessas ferramentas escreve nas coleções de negócio. O rascunho da revisão aparece na resposta MCP e não é salvo na interface.

## Catálogo e recibos

- O catálogo anuncia ferramentas de leitura, criação e mutações que podem sobrescrever ou remover dados. Essas anotações orientam o cliente. O filtro por escopo continua no servidor.
- Criações com chave de idempotência no CRUD e no calendário registram uma impressão dos argumentos antes do efeito. Mesma credencial, chave e parâmetros recuperam o recibo, e alterações de dados ou operação geram conflito. Se a gravação do recibo falhar, a intenção continua registrada. A recuperação usa o ID estável da criação. No Google Agenda, a recuperação de uma criação não sobrescreve edições posteriores do evento.
- Recibos antigos sem impressão ainda podem ser recuperados, mas não permitem comparar os argumentos originais.
- O teste HTTP local usa o handler de produção, credenciais sintéticas e armazenamento isolado. O OpenBot usa o [OAuth direto](integrations/openbot-oauth.md), com o catálogo habilitado pelos escopos que o proprietário aprova.

## Lacunas restantes

| Área ou ação | O que o MCP cobre | O que ainda falta |
|---|---|---|
| Notas e Wiki | Busca, leitura e coleções, além da conversão de capturas | Edição de notas, coleções e etapas CODE pelo MCP. |
| Visão | Leitura por seção | Escrita versionada na Visão. |
| Revisão semanal | Consulta da última revisão e rascunho calculado | Persistir, anexar à interface ou aplicar um rascunho com confirmação humana. Configuração e conclusão seguem na interface. |
| Planejar | Blocos de tarefas, adoção de evento, listagem do Google Agenda e ciclo de vida dos eventos gerenciados | Edição de preferências de jornada, processamento em lote e recorrência explícita de tarefas. |
| Financeiro | Lançamentos, resumo mensal, contas, cartões, faturas, orçamentos, credores e metas | Catálogo/gestão de categorias financeiras e operações específicas do fluxo de fatura que não são representadas pelo CRUD. |
| Conteúdo e Fontes | CRUD de conteúdo, itens e fontes, em escopos separados | Gestão de categorias, disparar atualização da fonte e ações dedicadas de clipping/análise. |
| Editais | CRUD e atualização de etapa com verificação do escopo do destino | Configuração, descoberta e análise oferecidas pela interface. |
| Indicadores e Pilares | CRUD de indicadores e leitura/edição de pilares | Criação e exclusão de pilares; os tool handlers atuais não oferecem essas operações. |
| Saúde e Profissional | Contratos MCP próprios com consulta, propostas, aplicação e recibos, conforme o domínio | Aprovação humana permanece na interface; dados de conectores e operações administrativas não devem ser adicionados ao perfil geral. |
| Escritório e agentes | Heartbeat usa autorização separada, e chamadas MCP têm auditoria | Sessões, chat, comandos e administração do Escritório seguem em APIs próprias. |
| Configuração e dados | APIs próprias da aplicação | Login, OAuth do Google, configurações globais, backup/migração e uploads ficam fora do acesso geral do agente. |
