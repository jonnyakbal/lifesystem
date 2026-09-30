# LifeSystem MCP — contrato Órion 1.0 (primeiro corte)

Este contrato opera somente no domínio pessoal de saúde. Os schemas exatos em JSON Schema são devolvidos por `get_health_schemas`; a tabela abaixo é a referência humana. Campos `observedAt`, `startedAt` e `endedAt` exigem ISO 8601 com hora e offset (`Z` ou `±HH:MM`). `timezone` é um fuso IANA válido. Nenhum valor inicial do briefing privado é gravado automaticamente.

| Ferramenta | Escopo | Entrada | Saída principal |
| --- | --- | --- | --- |
| `get_health_capabilities` | `health:read` | `{}` | versão, ferramentas visíveis, permissões efetivas e limites |
| `get_health_schemas` | `health:read` | `{}` | JSON Schema da observação/proposta, unidades e regras de aprovação |
| `get_health_context` | `health:read` | `{}` | contexto autorizado; campos ainda não informados retornam `null`/lista vazia e `unknown` |
| `list_health_observations` | `health:read` | `{id?,type?,indicatorId?,from?,to?,cursor?,limit?}` | `{items,nextCursor}`; limite 1–100; cursor é o ID do último item recebido |
| `get_health_summary` | `health:read` | `{from,to}` datas `YYYY-MM-DD` | contagens, água, sono sem sobreposição, médias só de amostras, cobertura e fonte |
| `get_health_receipt` | `health:read` | `{idempotencyKey}` | recibo próprio da credencial ou `{found:false}` |
| `propose_health_change` | `health:propose` | `{operation,observation,observationId?,expectedRevision?,reason?,idempotencyKey}` | proposta `{id,revision,hash,expiresAt}`; não grava observação |
| `apply_health_change` | `health:apply` | `{proposalId,idempotencyKey}` | observação gravada/corrigida, somente após aprovação web |
| `record_health_observation` | `health:apply` | `{proposalId,idempotencyKey}` | alias de aplicação, exige proposta do tipo `record` aprovada |
| `correct_health_observation` | `health:apply` | `{proposalId,idempotencyKey}` | alias de aplicação, exige proposta do tipo `correct` aprovada |

`operation=record` exige `observation`; `operation=correct` exige também `observationId` UUID, `expectedRevision` positiva e `reason` (3–500 caracteres). Cada operação deve usar uma chave de intenção única (8–200 caracteres). Retry da mesma operação/payload/chave retorna ID/recibo anterior. Mesmo ator e chave com payload diferente resultam em conflito. Duas intenções independentes, ainda que ambas sejam “500 ml de água”, usam chaves diferentes.

Observações aceitas: `water` (`ml` inteiro 1–3000), `weight` (`kg` 20–500), `sleep` (`startedAt?`, `endedAt?`, `quality?` 0–10; pelo menos um horário), `meal` (`description` 1–500), `movement` (`activity` 1–120, `completed:true`, `durationMinutes?` 1–1440), `energy` e `stress` (`score` 0–10). Todas exigem `type`, `observedAt`, `timezone`; `sourceRef`, `pillarId` e `indicatorId` são opcionais. Referências de pilar/indicador são verificadas por ID real no servidor. Sono parcial não recebe duração; intervalo completo tem duração calculada e rejeita fim anterior ao início. Registros futuros não são tratados como realizados. Correção mantém versão anterior e não muda tipo. `origin=self_report` marca a natureza do dado; não é medida clínica.

Uma proposta fixa operação, payload, hash SHA-256, revisão e expira em 24 horas. O usuário vê seu conteúdo em **Cultivar → Corpo & saúde** e aprova pelo endpoint de sessão `POST /api/health/approval`, que verifica cookie e origem. Não existe ferramenta MCP para aprovar nem flag `human` aceita do agente. Após aprovação, o agente aplica usando a mesma proposta e recebe recibo na mesma transação da observação. Em timeout, consulte `get_health_receipt` e repita **a mesma chave**, sem criar outra intenção. O histórico e as propostas aparecem na interface a partir do mesmo ledger. A interface também permite registro/correção direta por sessão humana autenticada.

Configure para o Órion uma credencial própria em `MCP_API_KEYS` com `health:only`, `health:read`, `health:propose` e `health:apply`. A configuração da credencial e seu valor não fazem parte desta entrega. `MCP_API_KEY` legada e `*` genérico não autorizam saúde; `health:only` bloqueia ferramentas de tarefas, finanças, profissional e Calendar. Logs MCP gravam nome da ferramenta e resultado sanitizado, sem payload de saúde.

**Ainda não disponível neste corte:** contexto editável/metas/rotinas, `get_health_daily_brief`, propostas para criar/atualizar tarefas ou reservar blocos do Google, consentimento recorrente, cron ou mensagens. Até essa ponte ter testes de conflito e recuperação parcial, use apenas os fluxos existentes de tarefas e `plan_task_block` com permissões próprias; não atribua ao Órion uma permissão ampla para contornar a aprovação. O campo `taskCalendarBridge` em `get_health_capabilities` declara `not-yet-available`.
