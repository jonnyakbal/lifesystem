# Tarefas — execução e observatório violeta

Pedido de Jonny: aplicar a direção violeta à produtividade, com prioridade para visualização e manipulação real de tarefas. Implementação local autorizada em 30/09/2026; preservar os estudos e os módulos externos.

## Entrega

- Lista principal com colunas editáveis de status, prioridade, prazo e projeto; seleção independente de conclusão e abertura.
- Grupos recolhíveis, seleção das tarefas visíveis e barra de ações em lote sem dependência de hover.
- Cabeçalho compacto, superfícies violeta nos dois temas e controles adaptados ao celular.
- Editor lateral usando os campos existentes e o mesmo contrato de tarefa, com bloqueio de envio repetido e recuperação de falha.
- Quadro, semana, visões salvas e calendário preservados; navegação mensal inclusive em meses vazios e viradas de ano.

## Regras

Abrir título não conclui. Alterar status terminal usa o fluxo de conclusão/recorrência/desfazer. Prazo com bloco de horário aponta para Planejar; demais prazos usam o contrato existente, com `null` para limpar. Cada edição envia apenas seus campos. Erro mantém o valor persistido e o formulário disponível. Alterar filtros elimina seleção oculta. Não instalar dependências, alterar Hermes/Arco CRM ou publicar neste ciclo.

## Verificação

Testes primeiro: lista e persistência de campos, erro de edição, planejamento bloqueado, recorrência por status, seleção filtrada, navegação mensal e painel móvel. Executar suite isolada, tipos, lint e build com armazenamento temporário; inspecionar capturas nos dois temas. Registrar resultados reais no fim.

## Resultado local — 30/09/2026

Implementação concluída e copiada para o checkout principal, preservando os estudos e a atualização do escritório de agentes que entrou em `ed6e9e7` durante a execução. Sem commit, push ou deploy destas mudanças de Tarefas.

Arquivos de produto: `src/app/(dashboard)/tarefas/page.tsx`, `src/components/tasks/task-workspace-table.tsx` e `src/app/globals.css`. Regressões em `tests/task-productivity.spec.ts` (15 casos) e ajuste de `tests/today-task-actions.spec.ts` para escolher explicitamente o Kanban no teste dessa visualização. A direção aprovada está registrada em `docs/product-reference-direction.md`.

Lista inicial com status/prioridade/prazo/projeto editáveis, checklist acessível, colunas configuráveis, grupos recolhíveis e seleção independente da conclusão. Título abre o painel lateral mesmo com seleção ativa. Alterações de situação/filtros e de campos retiram a seleção que poderia ficar oculta. O editor preserva texto em falhas e bloqueia campos/envios durante salvamento. Concluir por célula, lote, quadro ou editor compartilha recorrência e recuperação. A guarda contra repetição de recorrência continua limitada à sessão; a idempotência persistente segue sendo uma entrega própria do roadmap.

O calendário permite mudar mês/ano e navegar por meses vazios. Prazo com bloco de horário continua pelo Planejar. As telas existentes de quadro e semana integrada foram preservadas. Superfícies violeta e órbitas discretas ficam restritas às Tarefas; não houve redesenho dos agentes neste ciclo.

Saídas reais das verificações:

- Execução final de `tests/task-productivity.spec.ts`, `tests/today-task-actions.spec.ts` e `tests/navigation-layer.spec.ts`, com `playwright.readiness.config.ts`: **29 passed (1.9m)**. Inclui o último ajuste para abertura com seleção ativa.
- Build local com autenticação e dados sintéticos: tarefas, recuperação, navegação e `tests/system-screen-audit.spec.ts`: **33 passed (3.5m)** antes do último ajuste de seleção, depois coberto na execução final acima. A varredura percorreu 22 rotas em desktop/mobile e tema claro.
- Varredura inicial ampla: **241 passed / 5 failed** de 246; quatro cliques em configurações foram interceptados pelo indicador de desenvolvimento do Next e houve um timeout de navegação. Os cinco casos passaram no build local autenticado e a navegação passou novamente na execução final. Não apresentar a primeira execução como suite toda verde.
- `npx tsc --noEmit`: **exit 0** na base atual com o escritório integrado.
- ESLint dos quatro arquivos de código/teste alterados: **exit 0**, sem avisos. `npm run lint` global: **0 errors, 96 warnings**, avisos preexistentes.
- `npm run build` final (`next build --webpack`), com diretório temporário vazio: **exit 0**, 53 páginas geradas. O checkout e o servidor pessoal da porta 3000 foram preservados.
- `git diff --check`: **exit 0**; hashes dos cinco arquivos de código/testes conferidos entre o checkout principal e o isolado.

A revisão independente apontou recorrência ignorada no editor e seleção oculta após mudança de grupo. Os dois erros foram reproduzidos, corrigidos e cobertos; a revisão das correções não encontrou outro problema importante. A inspeção visual também detectou deslocamento do painel por utilitários de tradução do Dialog; a correção foi verificada por limites `x/y/width/height` e capturas a 390/1440px, claro/escuro, com movimento reduzido.

Evidências locais fora do Git: `C:\dev\jonny\lifesystem-task-qa-evidence\`; capturas `C:\dev\jonny\lifesystem-task-workspace-{light,dark}-{390,1440}.png` e `lifesystem-task-panel-{light,dark}-{390,1440}.png`. Nenhuma credencial real ou dado pessoal foi usado nas verificações. **Produção: este redesenho ainda não foi publicado.**

## Continuação — 01/10/2026

As outras visões foram ampliadas no mesmo trabalho local: Kanban, calendário com dia em foco, linha do tempo de prazos e Semana integrada. Resultado e evidências estão em [task-rich-views-plan.md](task-rich-views-plan.md). A execução final autenticada no build local passou nos 48 testes de tarefas/planejamento envolvidos, além de build, tipos e lint. Mantida a publicação pendente.

## Integração autorizada — 01/10/2026

O ciclo posterior acrescentou Foco e Carga e validou o conjunto em build local de produção: 68 testes aprovados, build/tipos sem erros e lint global com 0 erros / 96 avisos existentes. Jonny autorizou publicar todas as visões de Tarefas, sem Gantt. Ver [registro de entrega](task-focus-load-delivery.md); o recibo público fica em [deploy de produção](deploy-producao.md). As restrições de publicação acima registram o estado histórico daqueles ciclos.
