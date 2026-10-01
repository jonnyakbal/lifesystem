# Tarefas — visões ricas, continuação local

Base: 1404e52, mantendo a lista e o painel lateral em andamento. Pedido: continuar as outras visões de produtividade com manipulação clara, usando os dados atuais.

1. Quadro: hierarquia visual, metadados legíveis, prazo editável, etapa/prioridade no cartão, recolher colunas sem seleção invisível, zonas de soltura. Conclusão continua independente do título e passa pelo fluxo compartilhado.
2. Calendário: mês navegável, seleção de dia, painel com todos os itens, criação com data escolhida, filtros dos vínculos de conteúdo/financeiro. Nenhum item deve desaparecer por um limite arbitrário de prévia.
3. Linha do tempo: marcos mensais de prazo, projeto/etapa, edição de prazo e tarefas sem data. Não inventar duração, dependências ou estimativas: uma tarefa com prazo é um marco, não uma barra de Gantt.
4. Semana: títulos abrem o painel lateral e a distribuição diária explicita quantidade de prioridades e blocos; reservar horário mantém o contrato de planejamento atual. Filtros de Tarefas não filtram a disponibilidade da agenda integrada.

Execução inline com as skills frontend-design, test-driven-development e executing-plans, revisão independente no fim. Sem commit/push/deploy, Hermes ou Arco CRM. Reutilizar o checkout isolado e dados sintéticos; preservar o servidor pessoal.

Verificar mutações pelos registros persistidos; erros não escondem valores, ações terminais mantêm recuperação, blocos impedem alteração direta de prazo. Cobrir meses vazios/virada de ano, dias com mais de dois itens, mobile/temas, filtro e abertura sem conclusão. Executar testes de tarefas/planejamento afetados, tipos, lint e build.

## Registro

- Investigação: calendário limitava cada entidade a dois itens, mas calculava excedente apenas acima de seis, escondendo tarefas em dias com três a seis tarefas. Semana não oferecia abertura dos detalhes. Quadro dependia do menu ou drag para etapa/prioridade.
- Regra de projeto: marcos usam `dueDate`; blocos usam o Planejar para preservar sincronização. Não há semântica de duração criada neste ciclo.
- Integração: fast-forward do escritório de agentes 1404e52 sem conflito com arquivos de Tarefas em andamento.

## Entrega local — 01/10/2026

As quatro visões estão implementadas: Kanban com etapa/prioridade/prazo no cartão e colunas recolhíveis; calendário com seleção de dia, painel completo, criação datada e vínculos opcionais; linha do tempo mensal de marcos editáveis e tarefas sem data; Semana integrada com distribuição diária e abertura do editor. A conclusão explícita, recuperação, recorrência e proteção do prazo com bloco passam pelos fluxos compartilhados. Nenhum dado existente foi migrado.

Arquivos de produto: `src/app/(dashboard)/tarefas/page.tsx`, `src/app/globals.css`, `src/components/planning-workspace.tsx`, `src/components/tasks/task-rich-dates.tsx` e `src/components/tasks/task-workspace-table.tsx`. Regressões: `tests/task-rich-views.spec.ts` (10 casos) e ajuste do seletor de coluna em `tests/today-task-actions.spec.ts`.

Revisão independente encontrou duas falhas reproduzidas em testes vermelhos: seleção oculta ao trocar agrupamento e abertura de um editor com snapshot antigo durante um PATCH pendente. Corrigidas com limpeza de seleção e bloqueio das ações de edição durante a mutação. Esses dois testes passaram na execução final. Observação menor para evolução: a linha do tempo prioriza o nome do projeto na legenda compacta; a etapa continua no editor, mas ainda não aparece junto do projeto nessa legenda. A guarda de recorrência continua limitada à sessão; esta entrega não promete idempotência persistente entre clientes.

Verificações reais, no checkout isolado, com dados sintéticos:

- Primeira execução em desenvolvimento: **43 passed / 5 failed (2.3m)** de 48; falhas em chamadas de planejamento. Um dos casos passou isoladamente. Também ocorreram erros de sintaxe nos arquivos gerados em `.next/dev/types`. O cache de desenvolvimento foi movido dentro do checkout isolado, preservando o servidor pessoal da porta 3000. Não considerar a primeira execução toda verde.
- Build inicial encontrou tipagem implícita na lista de fixtures do teste visual; corrigida com `Task[]`.
- `npm run build` final: **exit 0**, 53 páginas geradas, compilação e TypeScript aprovados.
- `npx tsc --noEmit` após o build estável: **exit 0**, sem saída de erros.
- Execução autenticada de um build local de produção na porta 3107: `task-rich-views`, `task-productivity`, `today-task-actions`, `unified-agenda`, `planning-workspace`, `task-planning-ui` e `task-delete-planning`: **48 passed (1.2m)**, sem retries. Inclui navegação de meses vazios/virada de ano, persistência dos campos, dias com cinco tarefas, falhas de edição, recorrência lenta e integração com Planejar. As falhas de planejamento não se reproduziram nesse build.
- ESLint dos sete arquivos de código/testes envolvidos: **exit 0**, sem avisos.
- `npm run lint` global após arquivar o harness: **exit 0**, **0 errors / 96 warnings** preexistentes. Nenhum aviso novo nos arquivos alterados.
- Inspeção visual: 16 capturas das quatro visões, claro/escuro, 390/1440px e movimento reduzido; sem exceções de JavaScript ou transbordamento horizontal da página. Calendário e linha do tempo oferecem rolagem interna no celular.

Evidências fora do Git: `C:/dev/jonny/lifesystem-task-qa-evidence/`, incluindo logs e configuração do harness de produção com credenciais exclusivamente sintéticas. Capturas em `C:/dev/jonny/lifesystem-task-{kanban,calendar,timeline,week}-{light,dark}-{390,1440}.png`. Nenhum acesso ao Hermes, Arco CRM ou serviço Google; integrações externas foram simuladas no QA. Sem commit, push ou deploy deste ciclo.

## Integração autorizada — 01/10/2026

O ciclo posterior acrescentou Foco e Carga e validou o conjunto em build local de produção: 68 testes aprovados, build/tipos sem erros e lint global com 0 erros / 96 avisos existentes. Jonny autorizou publicar todas as visões de Tarefas, sem Gantt. Ver [registro de entrega](task-focus-load-delivery.md); o recibo público fica em [deploy de produção](deploy-producao.md). As restrições de publicação acima registram o estado histórico daqueles ciclos.
