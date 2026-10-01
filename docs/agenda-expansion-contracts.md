# Contratos incrementais da expansão de agenda — P3

**Estado: especificação proposta, 01/10/2026.** Nenhum schema, endpoint, ferramenta MCP, worker ou escopo novo deste documento está implementado ou registrado. A sessão produziu somente este artefato; não leu credenciais nem acessou Google real, Hermes, VPS ou CRM.

Objetivo: permitir vários blocos de uma tarefa, escolher agendas, consultar marcos editoriais e financeiros e manter um cache Google incremental. Preservar o contrato atual de um dia e um bloco por tarefa, exigir autorização concreta para efeitos externos e continuar planejando quando a agenda estiver indisponível.

## 1. Base observada no código

| Contrato existente | Evidência | Consequência para a expansão |
| --- | --- | --- |
| `Task.planning?: TaskPlanning`; `date`, par de instantes opcional, fuso, sync e vínculo Google | `src/types/index.ts`, `src/lib/task-planning.ts` | Não substituir `planning` por array nem ampliar silenciosamente `planningSchema` |
| Dia planejado acompanha `dueDate`; salvar reserva ID antes da rede; falha preserva intenção local | `saveTaskPlanning` | Prazo e bloco legado continuam com sua regra; blocos adicionais não movem prazo automaticamente |
| Planejamento atual aceita 1 min–24h, valida dia inicial no fuso e recusa desligar mirror sem removê-lo | `planningSchema`, `removeTaskPlanning` | Reutilizar validação temporal; confirmação de remoção continua obrigatória |
| Google usa `/calendars/primary/events`; listagem paginada com intervalo máximo de 31 dias | `src/lib/google-calendar.ts` | Parâmetro de agenda e cache incremental exigem adaptador novo; não existem hoje |
| GET de propriedade, marcadores, ETag e tentativa anterior protegem eventos gerenciados | `syncManagedTaskEvent`, `deleteManagedTaskEvent` | Preservar proteção contra edição externa e confirmação perdida |
| `plan_task_block`, `remove_task_block`, `adopt_task_calendar_event` estão registrados com contratos atuais | `src/lib/mcp/tools.ts`, `actions.ts`, `auth.ts` | Ferramentas novas não devem ser anunciadas como disponíveis |
| OAuth solicitado: `calendar.events`; status atual é configurado/conectado | `buildGoogleAuthorizationUrl`, `getGoogleCalendarConnectionStatus` | Não há catálogo de agendas selecionadas nem registro explícito de concessões atuais |
| Conteúdo tem `scheduledDate`/`scheduledTime`, sem fuso próprio validado | `src/lib/content-schema.ts`, `content-domain.ts` | Não inferir instantâneo UTC nem afirmar publicação por ter uma data |
| Data financeira efetiva usa pago → `paidDate || date`, pendente → `dueDate || date` | `src/lib/financial-period.ts` | Overlay de vencimento não altera transação e distingue fallback de vencimento explícito |
| Recibos MCP genéricos guardam cliente/operação/chave/resultado; lock é em memória | `src/lib/mcp/receipts.ts` | Não reutilizar como garantia suficiente de concorrência entre processos ou fingerprint de payload |
| Preferências de jornada e união de intervalos existem | `planning-preferences.ts`, `planning-availability.ts` | Capacidade soma a união dos bloqueios; marcadores sem duração não consomem minutos |

O texto antigo de `docs/planejar-calendar-integrado.md` inclui propostas anteriores ao estado atual. Em particular, leitura de eventos já é permitida pelo escopo existente `calendar.events`; a descoberta da lista de agendas tem permissão específica. A implementação futura deve usar o código e esta distinção, sem solicitar consentimento adicional para uma leitura já concedida. [Escopos oficiais](https://developers.google.com/workspace/calendar/api/auth).

## 2. Arquitetura e decisões

Escolha: preservar `Task.planning` como bloco primário legado, guardar blocos adicionais em coleção própria e construir uma projeção de leitura comum. Um array dentro de `Task` simplificaria uma primeira tela, mas exigiria alterar leitores antigos e ampliaria concorrência em cada gravação. Migrar tudo imediatamente para uma coleção única deixaria o rollout dependente de uma migração global. A camada adicional permite entregas independentes com reversão de flags.

Separar três responsabilidades: domínio decide prazo/bloco/marco; projetor compõe itens somente leitura; adaptador recebe apenas uma operação já autorizada para um vínculo específico. Overlay é leitura e não espelhamento. Sincronização incremental é entrada de alterações remotas, não autorização para criar eventos.

Decisões propostas:

- Um prazo da tarefa permanece em `dueDate`. O bloco primário mantém a semântica atual. Blocos adicionais reservam sessões de trabalho, inclusive em outros dias, sem mover esse prazo.
- Conclusão preserva histórico e não remove Google. Remover bloco adicional não limpa `dueDate`. Remover o primário pelo contrato legado mantém a regra atual de limpar dia/prazo, mas a UI v2 explicará que outros blocos permanecem.
- Blocos adicionais exigem início e fim. Uma tarefa com dia e sem horário continua em `planning`/`dueDate`, sem inventar duração.
- Cada bloco espelha no máximo um evento em uma agenda por vez. Troca de agenda é uma operação composta revisada, com estados parciais visíveis.
- Evento externo permanece somente leitura. Adotar seu horário é uma operação explícita para um bloco já vinculado; importar uma mudança não adota automaticamente título/prazo.
- A expansão v2 não usa o novo calendário para publicar conteúdo, pagar contas, enviar convites ou executar trabalhos de agentes.

## 3. Schemas propostos v2

Os nomes abaixo são candidatos de contrato, não exports presentes no projeto. Datas civis validam existência; instantes exigem offset; fusos validam IANA. Inputs estritos rejeitam metadados de provider e campos de autorização enviados pelo cliente.

```ts
type AgendaBlockV2 = {
  schemaVersion: 2;
  id: string; taskId: string; revision: number;
  role: 'additional'; date: string; startAt: string; endAt: string;
  timeZone: string; state: 'planned' | 'cancelled';
  mirrorLinkId?: string;
  createdAt: string; updatedAt: string;
};

type AgendaItemV2 = {
  contractVersion: '2.0'; id: string;
  kind: 'task_day' | 'task_block' | 'google_event'
    | 'content_publication' | 'financial_due' | 'financial_paid';
  entity?: { type: 'task' | 'content' | 'financial'; id: string };
  sourceRevision: string; title: string;
  time: { kind: 'day'; date: string; timeZone: string }
    | { kind: 'point'; at: string; timeZone: string }
    | { kind: 'interval'; startAt: string; endAt: string; timeZone: string }
    | { kind: 'all_day_range'; startDate: string; endDateExclusive: string; timeZone: string };
  managedBy: 'lifesystem' | 'google'; busy: boolean;
  confidence: 'explicit' | 'fallback' | 'unknown';
  linkId?: string; calendarRef?: string;
};

type CalendarSelectionV2 = {
  schemaVersion: 2; id: string; connectionId: string;
  provider: 'google'; providerCalendarId: string;
  label: string; providerTimeZone: string; revision: number;
  accessRole: 'reader' | 'writer' | 'owner' | 'freeBusyReader' | 'none';
  readEnabled: boolean; writeEnabled: boolean;
  availabilityEnabled: boolean; detailLevel: 'busy_only' | 'title';
  consentRevision: number; updatedAt: string;
};

type AgendaMirrorV2 = {
  schemaVersion: 2; id: string; revision: number;
  source: { type: 'task_block' | 'content_publication' | 'financial_due'; id: string };
  sourceRevision: string; calendarRef: string; eventId: string;
  actorId: string; ownershipVersion: 2; etag?: string;
  desiredFingerprint: string; acknowledgedFingerprint?: string;
  lastAttemptFingerprint?: string; lastAttemptAt?: string;
  state: 'pending' | 'synced' | 'conflict' | 'error' | 'deleted_remote' | 'pending_delete' | 'cancelled';
  lastSyncedAt?: string; errorCode?: string;
};

type AgendaProposalV2 = {
  id: string; revision: number; hash: string; actorId: string;
  operation: 'create_block' | 'update_block' | 'remove_block'
    | 'enable_mirror' | 'move_mirror' | 'remove_mirror' | 'adopt_remote';
  sourceId: string; expectedSourceRevision: string;
  payload: Record<string, unknown>; expiresAt: string;
  // Server-derived authorization binding, never client booleans:
  expectedConsentRevision?: number; expectedLinkRevision?: number;
};
```

Coleções propostas: `agenda-blocks`, `agenda-mirrors`, `agenda-proposals`, `agenda-approvals`, `agenda-receipts`, `calendar-selections`, `calendar-cache`, `calendar-sync-state`. Inicialização vazia não altera dados existentes. Tokens OAuth continuam somente na camada de conexão criptografada; referências retornadas são opacas e não incluem credenciais.

O primário legado entra na projeção com ID determinístico `legacy-task-block:<taskId>` e `sourceRevision = task.updatedAt`. Não copiar seu evento para uma segunda coleção nem recriar no Google. Agregação reconhece `(connectionId, calendarId, eventId)` para evitar renderizar espelho e evento importado duas vezes. Tombstones são registros explícitos, nunca objetos cujo desaparecimento possa parecer uma confirmação de exclusão.

Limites iniciais: 20 blocos ativos adicionais por tarefa; página de itens até 100; consulta visual até 31 dias; batch de até 20 intenções independentes. Duração por bloco segue 1 min–24h; sobreposição gera alerta e exige confirmação específica quando o usuário insiste, sem mover outros blocos automaticamente. Instantes ambíguos do horário de verão exigem offset explícito; horário civil inexistente é recusado.

## 4. Overlays editorial e financeiro

`content_publication:<id>` projeta somente conteúdo com `scheduledDate` civil válida. Sem hora, fica no dia. Com `scheduledTime` válida, usa fuso configurado confirmado na UI e gera marcador `time.kind: point`, `busy: false`; não inventa `endAt`. O servidor precisa primeiro acrescentar campo opcional `scheduledTimeZone` ao domínio de conteúdo: campo legado ausente usa preferência apenas na exibição, com `confidence: fallback`; o espelhamento exige confirmar o fuso. Conteúdo inválido fica no diagnóstico de excluídos, não no dia atual. `status: published` é apresentado como realizado segundo o dado registrado; agenda não publica nem muda status. Arquivado fica oculto por padrão.

Produção editorial reutiliza blocos de tarefas vinculadas por `linkedTaskIds`. Não criar um segundo bloco de produção pelo simples agendamento da publicação. Vínculos de marca/projeto passam pelo `validateContentBinding` existente; credenciais `professional:only` continuam restritas a projetos associados, sem acesso à empresa/CRM.

`financial_due:<id>` inclui registros pendentes/atrasados: `dueDate` válida é explícita; ausência usa `date` como fallback identificado, seguindo a regra financeira existente. `financial_paid:<id>` é histórico opcional na data efetiva paga. Um mesmo registro não aparece simultaneamente como pendente e pago. `busy: false`, sem duração, sem conversão em tarefa, sem criação de lançamento. Faturas de cartão ficam fora da primeira entrega para não duplicar fatura e despesas; precisam de um contrato posterior de proveniência.

Overlay financeiro retorna por padrão categoria e indicação de vencimento; valor, favorecido e descrição só entram na visão autenticada com `financial:read`, não no Google. Exportação opt-in usa título genérico “Lembrete financeiro”; revelar detalhes exige aprovação por campos. Marcar pago não apaga seu espelho: mostrar que a origem foi resolvida e oferecer remoção explícita. Mudanças na origem invalidam proposta pendente vinculada à revisão anterior.

Google não recebe marcador com duração fictícia: vencimento/exportação de publicação sem hora usa evento all-day transparente, com fim civil exclusivo. Publicação com hora (`point`) só espelha se a proposta humana escolher um lembrete all-day ou fornecer duração explícita para intervalo transparente; essa duração pertence ao lembrete, não ao tempo de produção. A escolha integra o hash aprovado.

## 5. APIs e ferramentas candidatas

Todas as rotas e ferramentas desta seção são **propostas não registradas**. Os nomes existentes de v1 continuam com seus schemas atuais. Diagnóstico futuro deve anunciar `availableTools` derivado do registro efetivo e `implemented: false` para candidatos, sem dar instruções para invocá-los agora.

| Candidato REST/MCP | Input/resultado essencial | Autorização proposta |
| --- | --- | --- |
| GET `/api/agenda/v2/items`; `list_agenda_items_v2` | `from,to,timeZone,kinds,cursor,limit`; itens + excluídos por código + freshness por agenda | `agenda:read` **e** leitura do domínio de cada origem |
| GET `/api/agenda/v2/calendars`; `list_agenda_calendars_v2` | referências, permissões efetivas e seleção; sem tokens | `calendar:read`; seleção só humana |
| POST `/api/agenda/v2/proposals`; `propose_agenda_change_v2` | versão, operação, ID, revisão esperada, payload estrito, chave | `agenda:propose` + permissão do domínio; zero efeito remoto |
| POST `/api/agenda/v2/approval` | `proposalId,revision,hash`; aprovação exata, cookie e origem validados | Sessão humana somente; nenhuma ferramenta MCP de aprovação |
| POST `/api/agenda/v2/apply`; `apply_agenda_change_v2` | `proposalId,idempotencyKey`; efeito e recibo de estado | `agenda:apply` + capacidades dos efeitos e aprovação vigente |
| GET `/api/agenda/v2/receipts`; `get_agenda_receipt_v2` | chave → recibo seguro pertencente ao ator | `agenda:read`, propriedade da credencial |
| PUT `/api/agenda/v2/calendar-selections/:id` | revisão, read/write/availability, detalhamento | Sessão humana, lista de mudanças apresentada antes de salvar |
| POST `/api/agenda/v2/sync` | agenda selecionada, revisão de consentimento, chave de run | Sessão humana ou worker com regra ativa; importação somente |

Campos adicionais exigem schemas de operação específicos, não um `Record` livre: criação `{taskId,date,startAt,endAt,timeZone,mirrorCalendarRef?}`; update `{blockId,expectedRevision,patch}`; remoção `{blockId,expectedRevision,removeRemote}`; espelho `{sourceType,sourceId,sourceRevision,calendarRef,titlePolicy}`; adoção `{linkId,expectedLinkRevision,expectedRemoteEtag,fields:['time']}`. Adotar título ou mudar `dueDate` são escolhas adicionais exibidas na proposta e exigem revisão da tarefa. Metadados `eventId`, ETag, actor e aprovação são derivados pelo servidor.

Escopos novos não são aliases de `*`, `tasks:write` ou `calendar:write`. Exigir opt-in explícito v2. `health:only`/`professional:only` continuam fail-closed: não expõem o catálogo unificado. Uma evolução do bridge de saúde/profissional deve validar os mesmos pilares/contextos/atribuição antes de propor blocos e usar a aprovação existente do domínio ou um bridge revisado, nunca conceder acesso a finanças/agendas extras pela presença de `agenda:read`.

## 6. Consentimento e autorização antes do efeito

OAuth Google e autorização do produto são controles distintos. Para descobrir agendas, propor adicionar somente `https://www.googleapis.com/auth/calendar.calendarlist.readonly`; `calendar.events` já concedido habilita eventos, mas não autoriza automaticamente novas agendas no LifeSystem. Leitura apenas pode usar `calendar.events.readonly` numa conexão futura dedicada; reduzir/revogar escopos existentes requer fluxo explícito separado. [Escopos oficiais](https://developers.google.com/workspace/calendar/api/auth).

Persistir concessões realmente retornadas, não concluir que o token tem o conjunto pedido. Reconsentimento incremental ocorre quando falta uma concessão necessária; cancelar mantém `primary` atual. Agenda nova inicia `readEnabled: false`, `writeEnabled: false`. Mostrar nome, leitura/detalhes, participação na disponibilidade, destino de escrita e retenção antes de ativar. Verificar accessRole em cada efeito; `reader` não escreve mesmo que OAuth seja amplo. Não criar calendário Google, compartilhar agenda nem ampliar ACL.

`freeBusyReader` não é tratado como leitor de eventos: exibir capacidade indisponível para o adaptador Events e manter leitura de detalhes desativada. Um adaptador Freebusy separado seria outra etapa. Para `detailLevel: busy_only`, o cache elimina títulos e a projeção retorna “Ocupado”; esse modo reduz dados exibidos/retidos, não promete que o OAuth deixou de permitir detalhes.

Agente prepara proposta; UI humana mostra comparação antes/depois, agenda destino, título exportado, vínculo, remoções, prazo e revisão. Aprovação vinculada a hash, revisão, ator, fontes, consentRevision e expiração de 24h. Payload alterado, troca de agenda, retirada de permissão ou revisão da fonte invalidam a aprovação antes da rede. `human: true`/“sim” no input não autoriza.

A regra persistente de mirror, quando opt-in, deve enumerar fonte, campos e operações permitidas. Atualizar horário dentro da regra pode usar autorização vigente; agenda diferente, remoção, detalhamento novo ou custo de retenção diferente pedem nova aprovação. Desabilitar regra interrompe novas saídas e retries; preserva vínculos para revisão manual. Desconectar remove credenciais e cache importado após confirmação, preserva tarefas e blocos locais e não remove eventos Google.

## 7. Concorrência, idempotência e recibos

Proposta/efeito usam fingerprint canônico de operação, ator, fonte, revisão, campos, agenda e consentimento. Mesma credencial/chave/payload recupera resultado; mesma chave com payload diferente retorna conflito. Outra credencial não obtém recibo nem aplica proposta. Locks precisam ser entre processos com lease/ownership verificáveis; locks v1 em memória não bastam. Nunca manter a coleção inteira de tarefas travada esperando rede numa operação v2 comum.

Persistir outbox autorizada, intenção, ID externo estável e tentativa antes de chamar provider. ID deriva do link e é compatível com formato aceito pelo adaptador; reutilizá-lo após timeout. Reserva local/commit do efeito devem ter revisão e lease conferidos. Separar `accepted` de `synced`: um recibo durável informa `operationId,actorId,key,fingerprint,sourceId,sourceRevision,linkId,state,resultIds,recordedAt,errorCode`. Não retornar sucesso remoto quando só existe intenção local.

GET antes de PATCH/DELETE confirma marcadores v2 de fonte/link/propriedade; ETag obrigatório para atualização/exclusão. Timeout após escrita: recuperar por ID, marcadores e fingerprint da tentativa; não inserir novamente. ETag divergente → `conflict`, sem sobrescrever; usuário escolhe adotar campos ou reautorizar substituição. `404/410` de evento vinculado → `deleted_remote`; não recriar silenciosamente. `404` na repetição de uma exclusão já autorizada pode concluir tombstone local.

Mover mirror para outra agenda cria um novo vínculo/ID, sincroniza destino e só depois tenta remover a origem já autorizada. Recibo relata cada etapa; falha na remoção deixa dois eventos identificados como duplicata pendente, sem afirmar movimento completo. Se consentimento for revogado no meio, pausar próximo efeito e oferecer reconciliar o parcial; retries não podem ampliar autorização.

## 8. Sincronização incremental proposta

Primeira entrega: refresh manual por agenda selecionada, sem daemon. Depois, worker opt-in apenas de leitura, com limite de uma execução por agenda, intervalo mínimo de 5 min, orçamento de páginas/tempo e backoff limitado. Sem webhook nativo anunciado. Cache guarda campos mínimos, chave composta `(connectionId,calendarId,eventId)`, ETag, estado, tempos e proveniência; descrição, participantes e tokens nunca aparecem em logs.

```ts
type CalendarSyncStateV2 = {
  id: string; calendarRef: string; revision: number;
  consentRevision: number; generation: number;
  profileHash: string; encryptedSyncToken?: string;
  status: 'idle' | 'loading' | 'ready' | 'stale' | 'paused' | 'error';
  lastCompleteAt?: string; lastErrorCode?: string;
};
```

A consulta semanal atual usa `timeMin/timeMax/orderBy`; esse perfil não pode receber `syncToken`. O perfil incremental v2 usa `singleEvents:false`, `showDeleted:true`, sem intervalo nem ordenação por início; janela visual filtra uma projeção local separada. Parâmetros compatíveis ficam congelados por `profileHash`. [Contrato de Events.list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list).

Processar todas as páginas em uma geração staged; guardar o novo token e publicar o cache somente após completar a geração. Incremental paginado mantém o token de entrada até a última página. Token inválido (`410`) invalida apenas o cache e cursor daquela agenda, exige full sync e não toca blocos, links ou recibos. [Guia oficial de sincronização](https://developers.google.com/workspace/calendar/api/guides/sync).

Séries recorrentes ficam como masters/exceções em cache, sem transformar ocorrências em tarefas. Materializar a janela exige mecanismo próprio de recorrência testado; até existir, usar snapshot de janela separado para exibição de séries, sem alegar que o cache incremental sozinho cobre ocorrências. Cancelamento de instância respeita identidade de série/originalStartTime e não apaga a série inteira. Datas all-day conservam fim exclusivo, sem converter meia-noite em um compromisso com horário.

Full sync sem limite temporal pode ser grande: primeira etapa limita 250 itens por página, 20 páginas por run e 60s por orçamento. Ao atingir orçamento, checkpoint interno preserva staging; UI informa incompleto, não fornece disponibilidade verificada e próxima execução retoma. Não persistir todos os detalhes remotos fora da retenção proposta de 90 dias passados/180 futuros; guardar masters necessários e recalcular janela, com informação explícita de cobertura. Essa política precisa de implementação/teste antes de ligar worker.

`401/403`: pausar agenda e indicar reconexão/permissão; `429/5xx`: backoff com jitter, sem avançar token; queda na paginação ou disco: manter geração anterior marcada stale. Repetição idempotente não duplica cache. Falha de uma agenda não bloqueia as outras, mas a disponibilidade global torna-se parcial/unknown. Agenda removida da seleção sai da capacidade e cache é purgado; vínculos de saída continuam visíveis como desconectados.

## 9. Migração, etapas e rollback

| Entrega independente | Arquivos/camadas candidatos | Critério de aceite e rollback |
| --- | --- | --- |
| A — projeção local | Novos `src/lib/agenda/{schemas,projection}.ts`; testes `agenda-projection.spec.ts`; UI de filtros | Overlays sem escrita ou rede; flag off restaura visão atual; dados-fonte intactos |
| B — blocos adicionais locais | `agenda/blocks.ts`, rotas v2, armazenamento/receipts; `agenda-blocks.spec.ts` | Primário v1 preservado, CRUD com revisão/idempotência; flag off oculta adicionais sem removê-los |
| C — seleção de agendas | Adaptador/catalog e metadados de concessão; `agenda-calendars.spec.ts` | Reconsentimento só quando necessário; agenda inicialmente desativada; fallback primary existente |
| D — mirrors v2 | Outbox/propostas/aprovação/adaptador; `agenda-mirrors.spec.ts` | Só efeitos autorizados; conflitos/recovery/recibos; desligar flag pausa outbox, não apaga Google |
| E — cache incremental manual | `agenda/sync.ts`, cache/profile e teste `agenda-sync.spec.ts` | Paginação/410/recorrência/freshness demonstrados por fake provider; snapshot v1 permanece disponível |
| F — worker opt-in | Scheduler com lease e política, diagnóstico/status | Revogação e orçamento comprovados; desativação só pausa worker; não dispara saídas |

Antes de B, adiciona-se revisão explícita ao bloco adicional e `sourceRevision` calculada ao primário legado, sem aceitar revision do provider. Leitores v1 permanecem conscientes apenas do primário; não recebem promessa de ver adicionais. Mutação v1 continua limitada ao primário; exclusão de tarefa com adicionais ativos/mirrors deve ser bloqueada no storage até resolução ou cancelamento confirmado de todos, evitando órfãos. Nova expansão não pode usar a rota antiga para contornar aprovação v2.

Migrador local é versionado, dry-run com contagens, idempotente, backup verificado e rollback somente em diretório isolado. Migração não faz chamadas Google. Nenhum eventId/ETag do legado é recalculado. Atualizar docs antigas ao habilitar uma etapa, sem marcar as demais como entregues. Remover v1 só em futura versão major após clientes identificados, migração completa e aviso explícito.

## 10. Casos de teste e liberação

Todos os casos abaixo são **testes futuros**, não resultados já observados. Usar storage temporário, sessão sintética, transporte MCP em memória e fake provider; proibir fetch real. Integração pública/Google real exige uma rodada separada autorizada, sem substituir evidência sintética por afirmação de deploy.

| Grupo | Casos obrigatórios |
| --- | --- |
| Compatibilidade | Ler tarefa sem planning, dia sem horário, bloco v1 com ETag/lastAttempt; editar primário mantém dueDate e ID; adicionar dois blocos não move prazo; remover adicional não limpa prazo |
| Concorrência | Dois processos/criação mesma chave → um bloco/recibo; chaves iguais payload diferente → conflito; revisão obsoleta → nenhum efeito; lease vencida não confirma commit; exclusão concorrente não deixa mirror órfão |
| Tempo/capacidade | Offset/fuso distintos, horário de verão ambíguo/inexistente, intervalo cruza dia; blocos sobrepostos usam união; all-day não ocupa jornada por padrão; transparent busy=false; agenda stale gera disponibilidade unknown |
| Overlays | Conteúdo data inválida/fuso ausente/hora ausente/publicado/arquivado; task vinculada sem duplicar produção; financeiro paid/due/fallback/centavos; overlay não publica/paga/cria evento; fatura não duplica despesas |
| Permissões | Sem sessão, CSRF origin divergente, hash/revisão falsa, outra identidade, expired consent, reader-only, fonte company excluída; health/professional-only não ganham acesso unificado; OAuth negado preserva primary |
| Mirrors | Timeout após insert/PATCH/DELETE; 409 recuperação por GET; ETag 412; propriedade incorreta; evento removido; trocar agenda com falha parcial; revogação entre passos; fonte alterada após proposta invalida apply |
| Incremental | Full multipágina; token só última página; incremental com tombstone; falha página/disco não avança cursor; repetição não duplica; 410 purga só agenda remota; 401/403 pausa; 429 respeita retry/backoff |
| Séries/escala | Série, exceção movida, instância cancelada, orçamento excedido/checkpoint, mudança de perfil reinicia geração; snapshot e cache não duplicam evento; agenda indisponível não parece vazia |
| UI/acessibilidade | Criar/mover/remover por toque e teclado; confirmação mostra agenda e efeito; valores privados ocultos no export; foco após erro/diálogo; 360/390/768/1440px; filtros não são únicos indicadores por cor |
| Diagnóstico/rollback | Logs apenas códigos/contagens; sem tokens/conteúdo clínico/financeiro; flags não apagam dados/eventos; voltar à leitura v1 preserva primário; propostas não implementadas não aparecem como tools registradas |

Gate por entrega: testes de domínio/contrato dirigidos, checagem de tipos, lint dos arquivos alterados, build e revisão do diff antes de integrar; só executar suíte completa quando apropriado à etapa. Logs mostram runId, agenda opaca, geração, contagens, duração e códigos seguros. Métricas de aceite: duplicações zero nos casos de retry; nenhuma escrita após revogação; nenhuma geração incompleta apresentada como completa; nenhum evento externo sobrescrito sem decisão explícita.

## 11. Limite desta entrega

Este documento encerra a especificação P3 e fornece contratos revisáveis. **Múltiplos blocos/agendas, overlays, sync incremental e novas ferramentas continuam não implementados.** Nenhum teste novo dessas expansões foi executado nesta tarefa, nenhum runtime/segredo foi inspecionado e nenhum serviço externo foi alterado. As etapas acima são a proposta de implementação futura; o roadmap de execução não deve marcar a expansão funcional como concluída somente por este artefato existir.
