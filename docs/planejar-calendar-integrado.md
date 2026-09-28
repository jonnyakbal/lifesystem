# PLANEJAR + Calendário integrado

## Propósito

Transformar o calendário em uma representação honesta do tempo disponível, dos compromissos assumidos e das intenções do usuário. O LIFESYSTEM não deve ser apenas uma lista de coisas a fazer com datas: ele precisa ajudar a encontrar lugar para o que importa sem transformar cada pendência em mais um evento.

O Google Calendar é o espaço dos compromissos que já existem. O LIFESYSTEM é o espaço onde se decide o que merece entrar na semana, por qual motivo e com qual energia. A integração une essas duas verdades sem apagar suas fronteiras.

## Estado atual — 28/09/2026

Já estão implementados o planejamento de tarefas por dia e bloco de foco, a semana integrada com eventos da agenda principal e itens sem horário, e a sincronização explícita de blocos de tarefas com o Google Calendar. Prazo e horário planejado continuam independentes.

Permanecem no roadmap o espelhamento de contas, conteúdos e marcos de projetos; múltiplas agendas; sincronização incremental em segundo plano; e mais de um bloco por tarefa. A documentação operacional da entrega de blocos está em [Tarefas com horário e espelho Google](task-calendar-blocks-execution.md).

## Doutrina do produto

### 1. O calendário é uma promessa de tempo

Uma data sem horário é uma intenção. Um bloco com início e fim é uma promessa. A interface deve deixar essa diferença visível:

- **Sem data:** está na fila de planejamento.
- **Com dia:** é uma prioridade para aquele dia, mas ainda não reserva tempo.
- **Com horário e duração:** é um bloco de foco ou compromisso.
- **Evento externo:** ocupa tempo e informa capacidade, mas não deve ser reescrito pelo LIFESYSTEM.

### 2. Planejar não é lotar

Capacidade é finita. A visão semanal deve preferir espaço livre, duração estimada e replanejamento calmo a metas irreais de conclusão. A semana saudável inclui margem para deslocamento, descanso, imprevistos e tarefas invisíveis.

### 3. O usuário conserva a autoria

Nenhuma tarefa, conta ou conteúdo cria um evento automaticamente sem uma regra explícita. Ao sugerir um horário, o produto explica o motivo e oferece aceitar, mover ou manter na fila.

### 4. Uma fonte de verdade por tipo de informação

| Informação | Fonte de verdade | Papel na outra superfície |
| --- | --- | --- |
| Evento pessoal ou profissional já existente | Google Calendar | Espelhado no LIFESYSTEM como bloqueio de tempo somente leitura |
| Tarefa, checklist e status | LIFESYSTEM | Pode gerar bloco de foco ou prazo no Google |
| Conta, recorrência e pagamento | LIFESYSTEM | Pode gerar lembrete ou vencimento no Google |
| Conteúdo, produção e publicação | LIFESYSTEM | Pode gerar marcos selecionados no Google |
| Projeto e edital | LIFESYSTEM | Pode gerar marcos e prazos selecionados no Google |

### 5. Planejamento deve continuar possível sem arrastar

No desktop, arrastar é uma aceleração. No mobile, o fluxo principal é tocar em **Planejar**, escolher dia, horário e duração, e confirmar. Toda interação crítica deve ter alternativa por teclado e toque.

## Experiência desejada

### Visão semanal: a mesa de planejamento

A tela semanal terá quatro regiões que podem virar abas ou painéis conforme a largura da tela:

1. **Ritmo da semana** — cabeçalho com navegação, intervalo, capacidade restante, filtros e atalhos de planejamento.
2. **Linha do tempo** — eventos do Google, blocos de foco e itens com horário. Eventos externos aparecem com estilo próprio e não são arrastáveis por padrão.
3. **Prioridades por dia** — itens datados sem horário. Servem para compromissos flexíveis e não fingem ocupar uma hora específica.
4. **Órbita de planejamento** — fila lateral no desktop e gaveta inferior no mobile para itens sem data, atrasados e sugestões de replanejamento.

O estado vazio nunca deve ser só "sem tarefas". Ele deve orientar: capturar algo, puxar um item da fila ou reservar um bloco de foco.

### Mobile primeiro

- Agenda vertical por dia; o dia atual abre primeiro.
- Gaveta "Planejar" sempre acessível na parte inferior.
- Toque longo ou menu contextual oferece: hoje, amanhã, próxima semana, escolher data, reservar foco e remover da agenda.
- Horários livres aparecem como faixas discretas; não exigem precisão de calendário desktop.
- Ações destrutivas ou que alterem um evento externo pedem confirmação clara.

### Identidade visual

A identidade astral deve expressar orientação, não decoração:

- eventos externos são corpos fixos;
- blocos de foco são órbitas escolhidas pelo usuário;
- itens sem data permanecem na constelação de planejamento;
- a capacidade livre aparece como respiro visual, nunca como espaço "vazio" a ser preenchido;
- cores identificam tipo e origem, com texto e ícones garantindo acessibilidade.

Movimento reduzido deve desativar animações de órbita e transições longas.

## Tipos de item e regras

### Tarefas

Uma tarefa pode ser planejada em três níveis:

1. **Backlog:** sem data, disponível na órbita de planejamento.
2. **Dia:** data definida, sem duração; aparece nas prioridades do dia.
3. **Bloco:** início, fim e duração; ocupa a linha do tempo e pode sincronizar com o Google.

Tarefas concluídas preservam o histórico, mas deixam de consumir capacidade. Tarefas vencidas ganham uma ação de replanejamento, nunca são empurradas silenciosamente.

### Financeiro

Contas a vencer aparecem como marcadores de vencimento, não como blocos de reunião. O usuário pode optar por criar lembretes no Google para contas relevantes. Pagamento não deve excluir o evento externo automaticamente; o padrão é marcar como resolvido no LIFESYSTEM e oferecer a remoção.

### Conteúdo

Conteúdo separa três tempos: ideia, produção e publicação. Apenas produção e publicação são candidatos naturais ao calendário. Cada conteúdo escolhe os marcos a sincronizar.

### Projetos e editais

Projetos permanecem como contexto; calendário mostra os marcos. Para editais: abertura, prazo, documentação, resultado e prestação de contas. Prazos críticos podem ter lembretes configuráveis.

### Eventos importados

Eventos vindos do Google têm `managedBy = google`. São somente leitura no LIFESYSTEM na primeira versão. O usuário pode abrir o evento no Google, ocultá-lo da visão ou associá-lo a um projeto sem modificar o original.

## Contrato de sincronização

### Permissões e privacidade

A integração atual usa o escopo `calendar.events` para criar eventos. O espelhamento exigirá leitura de eventos e uma nova autorização explícita do usuário. Antes de pedir o escopo adicional, a interface deve explicar:

- quais agendas serão lidas;
- que eventos externos serão apenas exibidos;
- que o conteúdo não será usado para treinamento ou compartilhado;
- como desconectar e apagar credenciais locais.

### Direções permitidas

| Fluxo | Primeira entrega | Evolução |
| --- | --- | --- |
| Google → LIFESYSTEM | Leitura e exibição | Sincronização incremental e associação a projetos |
| LIFESYSTEM → Google | Criação manual de evento | Atualização e exclusão de eventos gerenciados |
| Google ↔ LIFESYSTEM | Não editar eventos externos | Conflitos explícitos para eventos gerenciados |

### Vinculação

Todo evento criado pelo LIFESYSTEM deve guardar seu `calendarId`, `googleEventId`, `entityType`, `entityId`, origem, direção permitida e data de última sincronização. Também deve incluir uma marca discreta na descrição do evento para recuperação segura caso um vínculo local seja perdido.

### Conflitos

- Evento externo alterado no Google: o LIFESYSTEM atualiza seu espelho.
- Evento gerenciado alterado no Google: registrar alteração e mostrar o novo estado no LIFESYSTEM.
- Entidade alterada no LIFESYSTEM após uma edição externa: oferecer comparação antes de sobrescrever.
- Evento removido no Google: manter a entidade LIFESYSTEM e sinalizar "evento removido" com opção de recriar.
- Token vencido ou permissão revogada: pausar sincronização, preservar dados locais e orientar reconexão.

## Arquitetura proposta

### Modelo interno

Criar uma camada de leitura chamada `CalendarItem`, sem forçar todos os módulos a adotarem a mesma tabela no primeiro momento.

```ts
type CalendarItem = {
  id: string;
  source: 'lifesystem' | 'google';
  kind: 'event' | 'focus_block' | 'task' | 'financial_due' | 'content_milestone' | 'project_milestone';
  entityType?: 'task' | 'financial' | 'content' | 'project' | 'edital';
  entityId?: string;
  title: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
  timeZone: string;
  calendarId?: string;
  externalEventId?: string;
  managedBy: 'lifesystem' | 'google';
  syncState: 'local' | 'synced' | 'pending' | 'conflict' | 'error';
  lastSyncedAt?: string;
};
```

O adaptador Google deve ficar separado do domínio de planejamento. A camada de domínio decide o que é um bloco, prazo ou lembrete; o adaptador apenas traduz para e a partir da API do Google.

### Dados e APIs

1. `GET /api/calendar/connection` — status da conta e agendas disponíveis.
2. `GET /api/calendar/items?from&to&sources` — visão unificada para as telas.
3. `POST /api/calendar/blocks` — planeja tarefa ou cria bloco manual.
4. `PATCH /api/calendar/blocks/:id` — move, redimensiona ou reprograma um bloco LIFESYSTEM.
5. `POST /api/calendar/sync` — sincronização explícita e protegida contra repetição.
6. `DELETE /api/calendar/connection` — desconexão e remoção segura de token.

No Google, usar sincronização incremental com `syncToken` e intervalo de consulta controlado. Nunca sincronizar a cada gesto de arrastar.

### Observabilidade

Guardar logs de sincronização sem conteúdo sensível do evento: horário, origem, resultado, contagem de itens e motivo do erro. O usuário vê um painel simples: última sincronização, agenda conectada e itens com conflito.

## Sequência de implementação

### Marco 0 — Consolidar a base atual

- Mapear a criação de evento de captura já existente e registrar vínculo do evento retornado.
- Adicionar status de conexão, desconexão e tratamento de token inválido.
- Cobrir criação, renovação de token e falha de API com testes.
- Definir uma única representação de fuso horário (`America/Sao_Paulo` como padrão configurável).

**Critério de aceite:** criar uma captura como evento, abrir o link no Google, reconectar após token inválido e desconectar sem deixar token recuperável.

### Marco 1 — Dados de planejamento

- Adicionar `scheduledDate`, `startAt`, `endAt`, `estimatedMinutes` e `planningState` a tarefas sem quebrar dados existentes.
- Criar a projeção `CalendarItem` para tarefa, conteúdo, financeiro, projeto e edital.
- Expor API unificada apenas para dados LIFESYSTEM.

**Critério de aceite:** uma tarefa pode transitar entre backlog, dia e bloco; a mesma informação aparece corretamente na semana e no mês.

### Marco 2 — Nova experiência PLANEJAR

- Construir a visão semanal com prioridades, linha do tempo e órbita sem data.
- Oferecer planejamento por toque, menu e teclado; drag-and-drop é opcional.
- Exibir capacidade livre e alerta de sobrecarga por duração, sem bloquear o usuário.
- Validar 360, 390, 768 e 1440 px, modo escuro, foco visível e movimento reduzido.

**Critério de aceite:** em mobile, uma tarefa sem data pode ser planejada para um dia ou bloco em até três toques após abri-la.

### Marco 3 — Espelho somente leitura do Google

- Pedir nova autorização de leitura com explicação de privacidade.
- Permitir escolher agendas e ativar/desativar cada uma.
- Buscar eventos de uma janela de tempo limitada e exibir na semana.
- Implementar sincronização incremental, estado offline e reconexão.

**Critério de aceite:** eventos externos aparecem corretamente, não podem ser editados por acidente e reduzem a capacidade disponível.

### Marco 4 — Eventos gerenciados pelo LIFESYSTEM

- Criar blocos de foco no Google a partir de tarefas selecionadas.
- Atualizar e excluir somente eventos marcados como gerenciados pelo LIFESYSTEM.
- Implementar resolução de conflito e recuperação de vínculo.

**Critério de aceite:** mover um bloco planejado atualiza o evento correspondente; uma alteração externa não é sobrescrita silenciosamente.

### Marco 5 — Módulos e automações conscientes

- Vencimentos financeiros, publicações de conteúdo e marcos de projeto/editais.
- Regras opt-in por tipo de item e por agenda.
- Sugestões de encaixe baseadas em horários livres, duração e preferências de horário.

**Critério de aceite:** nenhuma regra cria eventos sem ter sido ativada; o usuário consegue entender e revogar cada regra.

## Qualidade e segurança

- Não exibir descrição de evento externo em logs ou notificações sem necessidade.
- Não duplicar evento quando uma requisição for reenviada; usar chave de idempotência.
- Não excluir eventos do Google ao apagar uma tarefa sem confirmação explícita.
- Não considerar eventos de dia inteiro como capacidade de horário, a menos que o usuário marque como bloqueio.
- Testar horários de verão, evento de dia inteiro, recorrência, fuso diferente, token expirado, rede indisponível e conflito de edição.
- Medir tempo para planejar, taxa de eventos duplicados, falhas de sincronização e quantidade de semanas sobrecarregadas.

## Decisões a manter explícitas

- A primeira experiência de espelho deve ser somente leitura.
- O Google Calendar permanece a fonte de verdade dos compromissos externos.
- O LIFESYSTEM permanece a fonte de verdade de tarefas, finanças, conteúdos e projetos.
- A integração é seletiva por módulo, agenda e tipo de marco.
- O calendário não deve punir itens sem data: a órbita de planejamento é uma parte central da tela.
- A versão open source deve expor adaptadores de calendário, não acoplar o domínio ao Google.

## Primeira entrega recomendada

Construir, nesta ordem: **dados de planejamento → visão semanal mobile-first → espelho somente leitura do Google**. Isso já entrega o loop essencial: enxergar compromissos reais, escolher uma tarefa sem data e encaixá-la num tempo viável.
