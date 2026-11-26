# Revisão de interface do LifeSystem: relatório consolidado

## 1) Padrões que se repetem entre as telas (resolver uma vez, aplicar em todas)

| # | Problema | Onde aparece | Solução única |
|---|---|---|---|
| P1 | **Falha de carga aparece como estado vazio** ("Tudo em dia!", "Crie sua primeira…"), e não há botão de tentar de novo | /hoje, /notas, /tarefas, /editais, /conteudo, /diario-bordo, /content-hub, /corpo, /financeiro, /areas, /dados, /revisao, /visao | Hook `useResource()` com `{status: loading\|error\|ready, data, retry}` e um componente `<LoadState>`: skeleton com o formato da tela, card de erro com "Tentar de novo" e vazio só quando a carga deu certo. Falhas parciais aparecem num aviso discreto. Distinguir "vazio" de "os filtros escondem tudo" com o botão "Limpar filtros". |
| P2 | **Ações destrutivas sem Desfazer**, ou com Desfazer que recria o item com outro id e perde vínculos | /editais, /indicadores, /pilares, /diario-bordo, /projetos, /notas, /tarefas, /inbox, /financeiro, /conteudo, /content-hub, /planejar, /revisao | Exclusão lógica no backend (`deletedAt` + PATCH de restauração) e um `useUndoableAction()` que mostra o toast "X feito · Desfazer" por 8 s. Usar `window.confirm` em nenhum lugar: no lugar dele, um AlertDialog do design system. Criar `taskToCreatePayload(mode)` para restaurar e duplicar. |
| P3 | **Cada mutação recarrega a tela inteira** (pisca o skeleton, perde scroll, foco e estado) e trava tudo com um `busy` global | /revisao, /inbox, /hoje (metas), /indicadores, /projetos, /diario, /pilares, /editais, /conteudo, /tarefas | Atualização otimista com rollback em `useOptimisticList()`. Busy por id (`Set`), não global. Revalidação silenciosa, sem `setLoading(true)` depois da primeira carga. |
| P4 | **Arrastar com HTML5 DnD não funciona no toque nem no teclado** | /tarefas, /projetos, /editais, /planejar, /conteudo | Migrar para @dnd-kit (PointerSensor com delay + KeyboardSensor) e sempre oferecer a alternativa de um toque: chip de etapa ou data que abre um menu (`<StageMenu>` / `<QuickDateMenu>`: Hoje, Amanhã, Próx. segunda, Escolher). |
| P5 | **Edição só em modal grande**, sem edição inline, sem rascunho e sem aviso de "alterações não salvas" | /projetos, /editais, /indicadores, /pilares, /profissional, /diario-bordo, /financeiro, /visao, /diario, /notas | `<InlineEdit>` (clique, Enter salva, Esc cancela). Hook `useDraft(key)` com sessionStorage/localStorage (try/catch) e guarda de "dirty" ao fechar. Ctrl/Cmd+Enter salva em todos os modais. |
| P6 | **Captura rápida ausente ou pobre**: o parser `#projeto !alta @sex` só funciona no painel, o input perde o foco depois do Enter e não herda o contexto | /tarefas, /hoje, /areas, /projetos, /planejar, /inbox, /conteudo, /profissional, /notas | `<QuickAdd context={{projectId, pillarId, status, dueDate}}>` com `parseQuickAdd`, inserção otimista, foco mantido para digitar vários em sequência e lembrança do último projeto e da última categoria. |
| P7 | **Sem atalhos de teclado**, ou atalhos globais que disparam dentro de inputs | quase todas | `useHotkeys()` central, que ignora INPUT, TEXTAREA e contentEditable. Convenção: `n` novo, `/` busca, `j/k` navegar, `e` abrir, `Esc` fechar, `?` cheat sheet. |
| P8 | **Filtros, abas e visão não persistem** (somem ao recarregar e não dá para criar link direto) | /tarefas, /content-hub, /diario-bordo, /profissional, /visao, /editais, /diario, /financeiro | `useUrlState()` que sincroniza com a querystring via `router.replace`, mais `?open=ID` padronizado em todas as entidades (hoje só /tarefas tem). |
| P9 | **Ações escondidas no hover** (`opacity-0 group-hover`), invisíveis no toque, e alvos de toque abaixo de 44px | /tarefas, /conteudo, /notas, /corpo, /revisao, /content-hub, /hoje, /indicadores, /profissional, /hermes | Regra de CSS: ações visíveis em `pointer: coarse`, mínimo de 44px no mobile e menu "⋯" sempre presente. Swipe opcional nas listas (direita = ação principal com Desfazer). |
| P10 | **Abas e chips sem semântica**, card clicável duplicado com o botão do título, sem aria-live | todas | `<Tabs>` com padrão WAI-ARIA (setas e aria-selected), padrão "stretched link" nos cards, `role=status` sempre montado para anúncios e aria-label em todo botão que só tem ícone. |
| P11 | **Dados desatualizados**: carrega só na montagem, sem revalidar quando a aba volta ao foco nem na virada do dia | /hoje, /hermes, /dados, /corpo, /areas | `useRevalidateOnFocus()` + intervalo leve + detecção da meia-noite. |
| P12 | **Formulários sem `<form>`**: Enter não envia e validação vazia vira 0 | /corpo, /indicadores, /profissional, /financeiro, /editais (cockpit) | Padrão `<form onSubmit>` com validação inline (aria-invalid) e `inputMode="decimal"`. Textareas de "um por linha" guardam o texto bruto e só fazem o parse ao salvar. |

## 2) Top 15 por impacto/esforço

| # | Melhoria | Tela | Impacto/Esforço | Evidência |
|---|---|---|---|---|
| 1 | Erro de carga deixa de parecer vazio (P1) | /hoje, /notas, /tarefas, /editais e outras | alto / P | hoje/page.tsx:109-113,230; notas:226-235,570; tarefas:322-331,1145 |
| 2 | Bug: o clique seguinte a um arraste é engolido | /tarefas | alto / P | tarefas/page.tsx:687,819-822 |
| 3 | Campos "um por linha" não aceitam Enter | /profissional | alto / P | profissional/page.tsx:134,292 |
| 4 | Corrigir o "Limpar filtros", que não zera o CODE, e fazer a busca procurar no texto em vez do HTML | /notas | alto / P | notas/page.tsx:582,470 |
| 5 | Validar valor vazio (hoje vira 0) e envolver em `<form>` | /corpo | alto / P | corpo/page.tsx:140-145,229 |
| 6 | Agrupar por categoria, formato ou linha não pode sumir com itens; criar grupo "Sem X" | /conteudo | alto / P | conteudo/page.tsx:444-452 |
| 7 | Input de captura mantém o foco (readOnly em vez de disabled) e revalida sem skeleton | /inbox | alto / P | inbox/page.tsx:94,36-41,98 |
| 8 | Exclusão com Desfazer e soft-delete (P2) | /editais, /indicadores, /pilares, /diario-bordo | alto / P–M | editais:176-184; indicadores:148-154; pilares:234-246; diario-bordo:137-145 |
| 9 | Restaurar e duplicar tarefa com payload correto, sem clonar planning, parentId e deps | /tarefas | alto / M | tarefas/page.tsx:499,528,571 |
| 10 | Conclusão em lote com um toast só, um confete e Desfazer em lote | /tarefas | alto / M | tarefas/page.tsx:544-556,603-609 |
| 11 | Ações de linha em /hoje: adiar, reagendar, prioridade e "reagendar atrasadas" | /hoje | alto / M | hoje/page.tsx:193-208,176-180 |
| 12 | Autosave com indicador e proteção ao trocar de dia ou seção | /diario, /visao, /notas | alto / M | diario:124-148; visao:90-96,112-129; notas:298-310,364 |
| 13 | Mover etapa e data por menu de um toque mais dnd-kit (P4) | /tarefas, /projetos, /editais, /planejar, /conteudo | alto / M | projetos:311,255-281; planejar:215-216,270-273; editais:446,523 |
| 14 | Controle de registro conforme o tipo (toggle, escala 1-10, moeda), com debounce e um ponto de histórico por período | /indicadores | alto / M | indicadores/page.tsx:156-163,185,28 |
| 15 | Registro rápido de um toque (água +200, energia 0-10, peso pré-preenchido) com Desfazer | /corpo | alto / M | corpo/page.tsx:199-201,123-125 |

Bugs pontuais que entram junto (P):
- colorBy com classe Tailwind dinâmica em /conteudo:509-511.
- `daysToFriday` errado na sexta em /revisao:150.
- O Desfazer de /hoje não remove a recorrência sucessora (:138-153).
- `new Date('')` lança RangeError no diálogo da inbox (capture-conversion-dialog.tsx:38).
- `renderMarkdown` gera listas sem `<ul>` em /visao:45-59.
- O estado `lit` é compartilhado entre dois botões em brand-book.tsx:85.
- O estado de pilar não pode ser desmarcado, e a métrica conta pilares removidos, em /diario:311,177.
- A busca sem abort deixa resposta antiga sobrescrever a nova em /profissional:220,87-104.

## 3) Por tela

- **/hoje**: erro aparece como "Tudo em dia" · adiar, reagendar e prioridade na linha · campo "Adicionar a hoje" com sugestões do backlog · metas otimistas com botões de 44px · confete só no marco · revalidar no foco e na virada do dia · links `?open=ID`.
- **/tarefas**: bug do clique após arraste · payload de restaurar/duplicar · lote com um toast e Desfazer · QuickAdd com parser e foco · estados vazio e erro corretos · dnd-kit e swipe · ordem manual (sortOrder) · estado na URL e em localStorage.
- **/inbox**: foco no input · revalidação silenciosa · Desfazer em todas as decisões · soft-delete · ações inline e em lote (`/api/captures/batch`) · chips de prazo, projeto e delegado · detectar link e mostrar prévia · aria-live e alvos de 44px.
- **/planejar**: alternativa de toque e teclado ao drag · chips Hoje/Amanhã em vez de diálogo · Desfazer no lugar de confirm · captura com parser e "+" por dia · busca no backlog · skeleton e contador por dia.
- **/revisao**: revalidação sem skeleton · erro de refresh vira toast · busy por id e Desfazer · reagendar com Hoje, data livre e lote · ações GTD em Aguardando e Backlog · persistir prioridades · corrigir a sexta-feira.
- **/projetos**: menu de etapa · mover de forma otimista com Desfazer · edição inline de nome e tags · captura rápida · filtro "parados" correto · concluir a próxima ação e pedir a seguinte · arquivar em vez de excluir · aria-labels.
- **/areas**: ações inline (concluir, adiar) · captura com o pilar já definido · retry e falhas parciais · tratar id inválido e trocar de área com atalhos · ordenar por atenção · deep-links e meta editável · a11y.
- **/pilares**: check-in 1-5 no card · stepper das metas · exclusão com Desfazer e aviso de metas afetadas · semeadura no servidor · criar e reordenar pilares · Situação/Meta inline · trocar hex por tokens.
- **/indicadores**: controle conforme o tipo · debounce e histórico por período · busy por id · número editável inline · criação rápida com inferência · exclusão com Desfazer · "faltam N" com direção · pílulas roláveis e inputMode.
- **/diario**: autosave · salvar sem refetch · humor e pilares persistidos na hora · desmarcar pilar · data na URL · atalhos e swipe · no mobile, pilares no topo · prompts e gratidão em 3 linhas · calendário colorido pelo humor.
- **/diario-bordo**: Desfazer ao apagar · lembrar categoria e título opcional · rascunho, Ctrl+Enter e `n` · line-clamp e edição inline de categoria e data · filtros na URL · cockpit recolhível · estado de erro.
- **/notas**: erro aparece como vazio · Limpar filtros e busca · restaurar e duplicar completos · mover categoria e etapa CODE pelo menu · nova nota herda a categoria · ordenar por updatedAt · editor mobile sem autoFocus · autosave com estado de erro · "Virar conteúdo" sem duplicar.
- **/conteudo**: DnD entre colunas e "avançar etapa" · quick-add por coluna · otimista com Desfazer e erro distinto de vazio · corrigir colorBy · grupo "Sem X" · calendário navegável com bandeja "sem data" · visões salvas fora do popover · pedir data e URL ao agendar ou publicar.
- **/content-hub**: Desfazer em arquivar e estrelar, e corrigir o nextId do leitor · atalhos s/e/b/o com j/k ignorados em inputs · swipe e "marcar tudo como lido" · "Guardar" na linha, com trecho · filtros na URL e busca no conteúdo · refresh em paralelo e gestão de fontes · erro e dedupe.
- **/editais**: Desfazer na exclusão · chip de etapa com toque e Desfazer · "Novo" vira "cole o link" (IA) · prazo e valor inline com aviso de "dirty" · busca com AbortController, pré-seleção por nota e allSettled · a11y dos candidatos · erro e retry · textarea do cockpit com texto bruto.
- **/financeiro**: botão Pagar/Receber em 1 toque com Desfazer · cadastros com sugestões e inputMode · editar e arquivar contas, cartões e credores · loading e erro por aba · fatura formatada e pagamento parcial confirmado · filtros persistentes, lote e inline · exclusão de parcelas em diálogo de 3 opções · tablist, FAB e sinal +/−.
- **/corpo**: chips de registro com um toque · `<form>` com validação · edição inline com motivo opcional e Desfazer · Recusar proposta e polling · gráfico tocável e recálculo no foco · histórico agrupado por dia com "carregar mais" e erro · contexto em chips · alvos de 44px e footer sticky.
- **/escritorio**: rascunho por agente · Ctrl+Enter e chips de pedidos · atalhos visíveis (`/`, M, F, ?) · card fixo "Decisões aguardando" sem JSON cru, com Rejeitar · focus trap incluindo o textarea · bottom sheet mobile com compositor fixo · erro separado com retry · atividades clicáveis e reenviar.
- **/profissional**: textarea de linhas · captura inline por projeto · card leva aos passos e estado na URL · revisão com Pedir ajuste, Descartar e aprovar em lote · debounce e abort na busca · menu "⋯" no mobile · rascunho no modal e metas em `<form>` · tablist.
- **/hermes**: polling com visibilitychange · banner de veredito · filtro de falhas no log · "Copiar configuração" e checklist · teste com modelo e prompt lembrados e Ctrl+Enter · erro inline e cancelar · URL sem truncar no mobile.
- **/dados**: quando live, vira painel de saúde do banco · "Revisar diferença" com confirmação em vez do checkbox · progresso por coleção e retry só das falhas · retry fora do bloco `plan &&` · cards no mobile em vez de tabela · StatusBadge com ícone · checklist de troca.
- **/design**: decisões como radio-cards com resumo e "Aprovar recomendadas" · nav com seção ativa · amostras realmente interativas · role=status sempre montado e Ctrl+Z · respeitar prefers-reduced-motion no brand-book · separar o estado `lit` · lazy-load do BrandBook · cores da marca em tokens.
- **/visao**: autosave com flag "dirty" · Ctrl+S · chips de perguntas, ditado e histórico de versões · barra de formatação e preview lado a lado · parser Markdown real · contadores viram filtros e etapa editável no card · seção na URL e tablist · painel "Seu contexto".
