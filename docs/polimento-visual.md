# LIFESYSTEM — Polimento visual (backlog)

Fase atual: **só anotando**. Nada é executado até o Jonny dar o sinal no final.

Objetivo: telas mais enxutas, menores, sem excesso; tirar tudo que é desnecessário.

## 1. Tarefas

### T1 — Cabeçalho + barra de controles amontoados, com repetição (print 1)
Queixa do Jonny: "muito amontoado, tem que ser mais inteligente, sem coisas repetidas".

Repetições encontradas:
- **Contagem por status aparece 3–4 vezes**: chips (A fazer 5 · Priorizado 2 · Fazendo 2 · Revisão 0 · Concluída 38), botões Em aberto / Concluídas (38) / Todas, "9 nesta visão", e de novo nos cabeçalhos das colunas do quadro.
- **Nome da tela aparece 2 vezes**: breadcrumb "Meu espaço / Construir / Tarefas" + título gigante "Tarefas".
- **Filtro em 2 lugares**: botão "Filtros" + sanfona "Mais opções de organização".

Coisas que sobram (ocupam espaço sem ajudar):
- Sobretítulo "SEU ESPAÇO DE EXECUÇÃO", subtítulo "Organize o próximo passo…", desenho decorativo de linhas, frase do topo "Ideias ganham forma quando encontram espaço."
- Texto de ajuda "Título abre detalhes. Concluir é uma ação separada."
- Linha divisória sob o cabeçalho.

Outros problemas:
- 7 abas de visão (Quadro, Lista, Semana, Calendário, Linha do tempo, Foco, Carga) numa fila só, pesada.
- Busca ocupa metade da largura.
- Tamanhos de fonte/botão inconsistentes (Em aberto/Concluídas maiores que os chips).
- Quadro estoura a largura: a 5ª coluna aparece cortada ("C").

Proposta (a validar):
- Cabeçalho em **uma linha**: título pequeno "Tarefas" + "5 atrasadas" (só o alerta, em vermelho) + botão "Nova tarefa". Tirar sobretítulo, subtítulo, desenho, divisória e frase do topo.
- **Uma linha de controles**: busca compacta · seletor de visão (ícones com nome só na ativa, ou dropdown) · um único botão "Filtros" que reúne status, Em aberto/Concluídas/Todas e as "mais opções".
- Contagem por status **só nos cabeçalhos das colunas** (no quadro) ou num único lugar nas outras visões.
- Quadro cabendo na tela (colunas mais estreitas ou "Concluída" recolhida por padrão).

### T2 — Cards do Quadro (Kanban) grandes demais (print 2)
Queixa do Jonny: "tá zoado, muito grande".

Problemas:
- **Card gigante**: cada um tem ~250px de altura; cabem só 2–3 por coluna na tela.
- **Etapa repetida dentro do card**: o card já está na coluna "A fazer", e mesmo assim mostra o dropdown "Etapa: A fazer". Redundante (mover = arrastar).
- **Prioridade como dropdown fixo** com rótulo "Prioridade" + "Normal" — ocupa um bloco inteiro; "Normal" nem precisa aparecer.
- Rótulos pequenos "Etapa" / "Prioridade" e a palavra "Concluir" embaixo do círculo — poluição.
- Dois blocos separados por divisória (topo com título/tags, base com dropdowns/data) — dobra a altura.
- Prioridade aparece 2x quando é "Importante" (tag + dropdown).
- Descrição longa no card ("Freela pago (R$ 200 recebidos em 22/10/2")) — deveria ficar só no detalhe.
- Linha "3 atrasadas · 0 urgentes" + barra de progresso em cada coluna — mais uma camada de números (somada ao contador da coluna).
- Coluna com caixa própria + card com caixa própria = bordas dentro de bordas.
- Coluna vazia ("Revisão 0") ocupa espaço igual às cheias; "Solte aqui" + "Adicionar tarefa" no vazio.
- Rolagem dupla (rolagem interna da coluna + rolagem da página).
- 5ª coluna "Concluída" cortada.

Proposta (a validar):
- **Card compacto de ~3 linhas**: [○] Título (máx 2 linhas) · ⋯ / tags + projeto em uma linha só / data (vermelha se atrasada) + bolinha/ícone de prioridade só se não for Normal.
- Tirar Etapa e Prioridade do card (editar no detalhe, ou menu ⋯ / hover). Tirar rótulo "Concluir" (tooltip no círculo).
- Tirar descrição do card (no máximo um ícone indicando que tem nota).
- Cabeçalho da coluna: nome + contador; alerta de atrasadas só como número vermelho quando > 0. Sem barra de progresso.
- Sem caixa em volta da coluna; colunas vazias estreitas/recolhidas; "Concluída" recolhida por padrão.
- Uma rolagem só.

### T3 — Visão Lista: densa, "textão", pouco interativa (print 3)
Queixa do Jonny: "ruim também, pouco interativo e muito denso, textão".

Problemas:
- **Descrição exibida embaixo do título** ("Freela pago (R$ 200…", "## CONTEXTO - Perfil: @rataria_sa…" com markdown cru) — é o "textão".
- **Coluna Status repetida**: a lista já está agrupada por status (A fazer 5 / Priorizado 2…), e cada linha repete "A fazer ⌄".
- Todas as células viram **dropdowns com setinha sempre visíveis** (Status, Prioridade, Projeto) — vira formulário, não lista. "Normal" e "Sem projeto" ocupam espaço à toa.
- Coluna **Checklist** mostra só "—" em todas as linhas: coluna inteira sem informação.
- **Duas formas de concluir**: checkbox à esquerda (seleção) + "○ Concluir" à direita — confuso; o checkbox parece "concluir".
- Linhas altas (~90px) e irregulares (dependem de ter descrição/tags).
- Espaço morto enorme entre título e as colunas; colunas espalhadas.
- Pouca interação: sem hover claro, sem ações rápidas, sem edição inline no título, sem prévia.

Proposta (a validar):
- **Linha de uma altura só (~40px)**: [○ concluir] Título · tags pequenas na mesma linha · Projeto · Prazo · prioridade (ícone, só se ≠ Normal) · ⋯
- Tirar descrição da linha (ícone 📝 discreto se tiver nota; texto só no detalhe/prévia).
- Tirar coluna Status quando agrupado por status. Tirar coluna Checklist quando vazia (ou mostrar "2/5" só quando existir).
- Valores como texto simples; dropdown aparece só no hover/clique da célula.
- Checkbox de seleção só aparece no hover (modo seleção em massa); o círculo à esquerda é o "concluir".
- Interações: hover destaca a linha e mostra ações rápidas (data, prioridade, mover); clique no título edita inline; clique na linha abre painel lateral de detalhe; atalhos de teclado (↑↓, espaço = concluir, enter = abrir).
- "Sem projeto" / "Normal" = célula vazia.

### T4 — Visão Semana: "totalmente inútil" (print 4)
**Decisão do Jonny:** em Tarefas **não mostrar agenda** — só tarefas. Google Calendar só aparece **sob pedido**, num botãozinho discreto (toggle "Mostrar agenda"), desligado por padrão.

O que sai da visão Semana em Tarefas:
- "Agenda integrada de todas as tarefas…" (texto explicativo)
- Título "Sua semana" + botões "Criar por pilar" e "Abrir Planejar"
- Card "Jornada de trabalho 08:00–20:00 · America/Sao_Paulo" + "Configurar capacidade"
- Cards "Nesta semana 5 tarefas" / "Para decidir 0 sem data" (mais contagem repetida)
- "Google Agenda conectada", "Lembretes: Publicações / Contas", "Atualizar agenda"
- "Horários locais · America/Sao_Paulo · 08:00–20:00" (fuso aparece 3x na tela!)
- Bloco "Ritmo da semana" (gráfico de barras com "0 blocos" em tudo)
- **Fila de dias duplicada**: tira de dias (SEG 19…DOM 25) + colunas de dias de novo (SEG 19…)
- "6h sem blocos · 08:00–20:00" em cada dia
- Eventos do Google (Almoço, Responder IG e Wpp) misturados com tarefas
- Painel "Para planejar" com campo de nova tarefa próprio (já existe "Nova tarefa")

Proposta (a validar):
- Semana = **7 colunas simples (seg–dom) com as tarefas pelo prazo**, cards compactos (mesmo card do T2), hoje destacado, setas ← → para navegar semana. Arrastar card entre dias muda o prazo.
- Tarefas sem data: faixa pequena recolhível no fim (ou nada — já aparecem na Lista).
- Botão singelo "📅 Agenda" (off por padrão) que sobrepõe os eventos do Google em cinza claro, somente leitura.
- Jornada/capacidade/ritmo/lembretes/blocos → pertencem à tela **Planejar**, não a Tarefas. (Rever lá quando chegarmos nela.)
- Avaliar se Semana e Calendário viram uma coisa só (Calendário com modo semana/mês).

### T5 — Visão Calendário (mês): pequeno e pouco interativo (print 5)
Queixa do Jonny: "também muito pequeno e pouco interativo".

Problemas:
- **Texto das tarefas minúsculo** (~11px) dentro de células grandes — muito espaço vazio e o que importa ilegível.
- **Painel lateral "Dia e… Quin…" cortado** fora da tela (estoura a largura) e mostra "0 tare…" — inútil do jeito que está.
- Atrasadas (dia 3, dia 15) **não aparecem em vermelho** — no mês não dá pra ver o que venceu.
- Sem cor de projeto/prioridade nos itens (só uma bolinha branca/lilás sem significado claro).
- Contador pequeno no canto (2, 3, 1) repete o que já se vê; "+1 tarefas" escondendo item mesmo com espaço sobrando.
- Dias de fora do mês (cinza) pesados; fim de semana sem diferenciação.
- Sem cabeçalho de mês/navegação visível no print (outubro? ← →).

Interação que falta (a validar):
- **Arrastar tarefa para outro dia = muda o prazo.**
- **Clicar no espaço vazio de um dia = cria tarefa já com aquela data** (input inline).
- Clicar no item abre o mesmo painel lateral de detalhe da Lista (T3); círculo para concluir direto no item.
- Hover no item mostra prévia (projeto, prioridade, checklist).
- Clicar no número do dia → abre Semana/dia daquela data.
- Botão "📅 Agenda" (mesmo do T4) para sobrepor Google só sob pedido.

Visual (a validar):
- Itens maiores e legíveis (13–14px), com cor do projeto ou pilar na borda esquerda; atrasada = vermelho; concluída = riscada/apagada.
- Células com altura adaptável (sem "+1" quando cabe).
- Cabeçalho: "Outubro 2026  ← Hoje →" compacto.
- Tirar o painel lateral do dia (ou só abrir ao clicar num dia, por cima).

### T6 — Linha do tempo: "estranho" (print 6)
Por que fica estranho:
- **Não é linha do tempo de verdade**: tarefas só têm prazo (sem início/duração), então cada linha vira **uma bandeirinha solta** num grid de 31 dias. É um calendário desenhado de lado — mais espaço, menos informação.
- **Linhas gigantes** (~110px) para mostrar um ícone de 40px. 7 tarefas ocupam a tela inteira.
- Grid quase todo vazio.
- **Prazo repetido**: data escrita na coluna da esquerda + bandeira na coluna do dia.
- Atrasadas: data vermelha à esquerda, mas a bandeira é igual às outras (não vermelha).
- **Mês repetido 3x no topo**: "Outubro De 2026 · Prazos" + seletor "outubro de 2026" + "Mês atual". "De" com maiúscula errada.
- Letras dos dias ambíguas (q, q / s, s / t) — não dá pra saber se é quarta ou quinta.
- Status ("Priorizado") e projeto em letra minúscula embaixo do título — mais textinho.

Opções (Jonny decide):
- **A) Remover a visão** — Quadro, Lista e Calendário já cobrem prazos. Reduz as abas de 7 para 6 (ou 5, se Semana+Calendário fundirem — ver T4).
- **B) Transformar em linha do tempo real**: barras de início→prazo, agrupadas por projeto, linhas finas (~32px), arrastar borda muda data. Exige campo "início" nas tarefas.
- Recomendação: **A** agora; B só se um dia precisar planejar projetos longos (aí talvez faça mais sentido na tela de Projetos).

### T7 — Foco: tem que ser "bem mais legal e imersivo"
(Referência: captura de QA `lifesystem-task-focus-dark-1440.png`, ainda não publicada.)

Hoje:
- Foco fica **dentro da página de Tarefas**, com sidebar, cabeçalho, chips, filtros, 7 abas e "Foco de execução / Uma coisa de cada vez / A fila respeita…" em volta. Nada de imersão — a tarefa disputa atenção com ~40 elementos.
- Card parece formulário: "Em foco · 1 de 1", textos de ajuda ("O título abre os detalhes…"), status, data, barra cinza, botões quadrados.
- "Na sequência" ao lado repete a mesma tarefa que está em foco.
- Nada acontece com o tempo: sem cronômetro, sem sensação de sessão, sem recompensa ao concluir.

Proposta — **Modo Foco tela cheia** (a validar):
- Entrar no Foco **esconde tudo** (sidebar, cabeçalho, abas, robô). Fundo escuro com o visual do universo/órbita do LIFESYSTEM, animação lenta e sutil.
- No centro: **só o título da tarefa grande**, projeto pequeno acima, checklist logo abaixo (clicar risca o passo com animação).
- **Timer de sessão** (pomodoro 25/5 ou livre), anel/órbita que vai se fechando conforme o tempo passa. Pausar / continuar com espaço.
- **Concluir = momento de recompensa**: animação (estrela/partículas), som curto opcional, e a próxima tarefa entra suave.
- "Próxima" aparece só como uma linha discreta no rodapé ("depois: …"), sem painel lateral.
- Campo rápido de **nota/captura** (atalho) pra jogar ideia na caixa de entrada sem sair do foco — essencial pro TDAH.
- Som ambiente opcional (lo-fi/ruído) — toggle discreto. Ideal pra DJ: playlist/stream escolhível.
- Sair com Esc. Teclas: Espaço = pausa, C = concluir, N = próxima, ↓ = nota.
- Contador da sessão ao sair: "3 tarefas · 1h40 focado".
- Sem textos de ajuda, sem status, sem "1 de 1".

### T6 ✅ Decisão: Linha do tempo REMOVIDA (opção A).
→ Abas finais de Tarefas: **Quadro · Lista · Calendário (semana/mês) · Foco**.

### T9 — Criar/editar tarefa (modal/painel): minimalista, bonito e interativo
(Referência: captura de QA `lifesystem-task-panel-dark-1440.png` — painel lateral "Editar Tarefa".)

Hoje:
- Parece **formulário de cadastro**: "Editar Tarefa / Altere os detalhes da tarefa", rótulo em cima de cada campo (Título, Descrição, Status, Prioridade, Prazo, Projeto, Pilar, Tags…), caixas com borda em tudo.
- Painel muito longo com rolagem: Recorrente, Projeto, Pilar, Tags, "Nova tag…", "Estrutura e esforço", "Tarefa principal", "Esforço previsto · minutos"… tudo aberto ao mesmo tempo.
- Status/Prioridade/Projeto/Pilar como dropdowns grandes; "Nenhum" ocupando espaço.
- Prazo: input de data nativo + 4 botões (Hoje/Amanhã/2 dias/Fim de semana).
- Rodapé com 3 botões (Excluir vermelho gigante, Cancelar, Salvar) — salvar manual.
- Criar e editar provavelmente são telas diferentes / pesadas para criar algo rápido.

Proposta (a validar) — estilo Linear/Things/Notion:
- **Sem rótulos, sem caixas**: título grande editável direto (como documento), descrição logo abaixo em texto livre com markdown renderizado (resolve o "## CONTEXTO" cru).
- **Linha de propriedades em "pílulas"** abaixo do título: `● Fazendo` `⚑ Importante` `📅 23 out` `📁 ARCO LABS` `🏷 design` — clicar abre popover pequeno com busca. Campo vazio = não aparece (só um "+ propriedade" discreto).
- Datas por linguagem natural: digitar "amanhã", "sex", "dia 30" → popover com mini-calendário + atalhos.
- **Checklist** interativo logo após a descrição: Enter cria passo, arrastar reordena, marcar risca com animação, barra de progresso fina.
- Avançado (Recorrência, Pilar, Tarefa principal, Esforço) escondido atrás de "+ Mais" — aparece só se usado.
- **Salvamento automático** (indicador sutil "salvo"). Sem Cancelar/Salvar. Excluir vai pro menu ⋯ com desfazer (toast "Tarefa excluída · Desfazer").
- Topo do painel: só [○ concluir] · ⋯ · ⤢ (expandir para página cheia) · ✕. Botão "Entrar em Foco" nessa tarefa (liga com T7).
- **Criação rápida**: "Nova tarefa" (ou tecla N) abre uma linha/caixinha só de título; propriedades por atalho no texto (`#arco`, `!alta`, `@amanhã`) e Enter cria. Detalhe completo só se quiser.
- Painel lateral estreito (~480px) em desktop; tela cheia deslizando de baixo no celular.
- Animações suaves de abrir/fechar; Esc fecha; ↑↓ navega entre tarefas com o painel aberto.

### T8 — Carga: REMOVER
**Decisão do Jonny:** visão Carga é inútil → sai das abas de Tarefas (código, testes e CSS dela também).

## Visão — erro de carregamento (22/10/2026)

- Print recebido: `/visao` cai no error boundary com `Cannot read properties of undefined (reading 'borderColor')`.
- Causa confirmada no código e reproduzida com dados fictícios: a timeline indexava quatro estados fixos, embora `ProjectStatus` aceite etapas configuráveis. Uma etapa terminal/personalizada ou removida deixava a apresentação indefinida.
- Correção funcional local, separada do polimento visual: usar o tipo compartilhado de Projeto, consultar as etapas cadastradas e garantir rótulo/cores neutros para etapas desconhecidas ou vazias. Não migra nem modifica projetos existentes. A branch continua `feat/polimento-tarefas`, sem merge/deploy.
- Regressões em `tests/vision-project-stages.spec.ts`: etapas terminais/personalizadas/removidas, configuração indisponível, rótulo renomeado e navegação mobile entre Plano/Pilares. Teste falhou com o mesmo TypeError antes da correção; depois, 13 testes de Visão/Cultivar passaram (2.3m, zero retries) em cópia de código isolada, Chrome local e dados sintéticos. Tipos e lint dos arquivos alterados passaram. Build de produção webpack aprovado; os três cenários novos também passaram contra `next start`, com login sintético e middleware ativos (36.1s, zero retries).
- Observação independente: testes existentes do Diário com relógio fixado em setembro emitiram aviso de hidratação por diferença com a data SSR de outubro, mas passaram. Não é o erro de `borderColor`; revisar separadamente se persistir sem relógio de teste. Playwright Chromium não estava instalado nesta máquina; QA usou Chrome instalado, sem baixar dependências.

## Próximas telas
- Hoje / Visão
- Planejar
- Financeiro
- Agentes / Escritório
- Revisão
- Configurações
- Termos

## Decisões gerais (valem pra todas as telas)

Extraídas de Tarefas — viram o padrão das próximas telas:
- **Cabeçalho de 1 linha**: título pequeno + 1 alerta que exige ação + ação principal. Sem sobretítulo, subtítulo, frases poéticas, desenhos decorativos.
- **Número aparece em um lugar só.** Nada de contagem repetida em chips, cards e cabeçalhos.
- **Sem textos de ajuda** na interface ("Título abre detalhes…", "A fila respeita…").
- **Valor vazio/padrão não aparece** ("Normal", "Sem projeto", "Nenhum", "0 blocos").
- **Sem caixa dentro de caixa.**
- **Editar = clicar no valor** (popover), não dropdowns sempre visíveis. Salvamento automático + desfazer.
- **Cada tela mostra só o assunto dela** (ex.: agenda não aparece em Tarefas; Jornada/capacidade é de Planejar).
- Fusos, horários de jornada e configurações → Configurações, não espalhados nas telas.
- Tudo cabe na largura (sem colunas cortadas); 1 rolagem só.
- Interação rica: arrastar, hover com ações rápidas, atalhos de teclado, animações curtas.

## Ordem de trabalho
Status: **Tarefas fechada para anotação** (T1–T9). Execução na branch `feat/polimento-tarefas` (repo `lifesystem`, a partir da main).

1. [x] Remover Carga e Linha do tempo + cabeçalho/controles enxutos (T1, T6, T8) — 22/10, local, não publicado.
2. [x] Card do Quadro e linha da Lista compactos (T2, T3) — 24/10, branch, não publicado.
   - Quadro: card de ~3 linhas (círculo, título até 2 linhas, ⋯ no hover; prazo · projeto · tags · checklist · ícones; prioridade só se ≠ Normal). Sem caixa na coluna, sem "x atrasadas · y urgentes"/barra; atrasadas viram um número vermelho no cabeçalho. Concluída começa recolhida; colunas vazias estreitas. Etapa segue acessível por teclado (select oculto) e pelo ⋯.
   - Lista: linha única (círculo de concluir à esquerda, título, 📝 se tem nota, tags); colunas Projeto · Prazo · Prioridade; Status some quando agrupado por status (mover pelo ⋯ "Mover para…"); Checklist só aparece se alguma tarefa tiver. "Normal"/"Sem projeto" invisíveis até o hover. Seleção e ⋯ aparecem no hover. Sem a faixa "8 tarefas · edição por campo"; Colunas virou ícone no cabeçalho.
   - Celular: campos mantêm 16px (sem zoom do iOS), só desenhados menores.
3. [x] Semana + Calendário (T4, T5) — 24/10, branch, não publicado.
   - Uma visão só, "Calendário", com Semana | Mês. Abas de Tarefas agora: Quadro · Lista · Calendário · Foco.
   - Semana: 7 colunas só com tarefas pelo prazo; hoje destacado; ‹ › e Hoje; + por dia. Saíram jornada, capacidade, ritmo, contagens, fuso, lembretes e a fila de dias duplicada.
   - Mês: tarefas legíveis com círculo de concluir, atrasadas em vermelho, prioridade na borda; clicar no vazio do dia cria tarefa com aquela data; número do dia abre o detalhe embaixo (sem painel lateral cortado); "semana" abre a semana daquele dia.
   - Arrastar tarefa para outro dia muda o prazo (Semana e Mês); tarefa com bloco de horário não move (continua em Planejar).
   - Botão "Agenda" (desligado por padrão): na Semana mostra a agenda completa com Google; no Mês mostra conteúdo e contas.
   - Sem prazo virou uma linha recolhível. Celular: mês vira mapa com barrinhas; tocar no dia mostra a lista.
4. [x] Painel da tarefa + criação rápida (T9) — 24/10, branch, não publicado.
   - Painel lateral de documento (560px): título grande editável, propriedades em pílulas (status, prioridade, prazo com atalhos, projeto, tags), notas livres, checklist com Enter/progresso/riscar; recorrência, pilar e estrutura em "Mais" (abre sozinho se usados).
   - Edição salva sozinha (~1,2s de pausa; "Salvo" no topo); fechar salva o que falta. Concluir/reabrir não salva sozinho: botão "Marcar como concluída" + Salvar, preservando desfazer/recorrência. Excluir/Duplicar no ⋯. Botão "Focar" leva a tarefa ao Foco.
   - Criação rápida: tecla N ou Nova tarefa; "#projeto !alta @sex #tag" vira projeto, prioridade, prazo e tag (mostra o que reconheceu); Enter cria. Lógica em src/lib/task-quick-add.ts + testes.
5. [x] Modo Foco imersivo (T7) — 24/10, branch, não publicado.
   - Tela cheia com céu/órbitas lentas; só a tarefa no centro (projeto, título grande, checklist animado).
   - Timer em anel (25/50 min ou livre), Espaço pausa; som ambiente gerado no navegador (sem serviço externo); som curto + explosão de partículas ao concluir.
   - Captura de ideia sem sair (tecla I → Caixa de entrada); fila em uma linha no rodapé; P próxima, C concluir, Esc sai; resumo "N concluídas · X min focado".
   - Pendente: teste da tecla N (criação rápida) é instável na bateria completa (passa isolado).

## Continuidade (22/10/2026 → Codex)

- Branch: `feat/polimento-tarefas`, a partir da `main` (`bab22b4`). Publicada no GitHub como branch, **não** mesclada na `main` (a `main` dispara deploy na Hostinger).
- Passo 1 entregue em `d721d7e`: cabeçalho de 1 linha, barra única de controles, Filtros consolidado, Carga e Linha do tempo removidas. Build webpack ok, `tsc` ok, lint 0 avisos, 49 testes Playwright de Tarefas/Hoje/auditoria passaram no modo CI (porta 3107, dados sintéticos).
- Próximo: passo 2 (T2 card compacto do Quadro, T3 linha da Lista). Seguir a ordem acima e as decisões gerais.
- O Jonny ainda não aprovou visualmente o passo 1 (recebeu prints). Confirmar com ele antes de mesclar na `main`.
- QA visual local: servidor de dev isolado com `LIFESYSTEM_STORAGE=file` e `LIFESYSTEM_DATA_DIR`/`UPLOAD`/`BACKUP` em pasta temporária, credenciais externas vazias. Nunca usar o servidor/dados pessoais.


## Fase 2 — demais telas (25/10, branch)

- [x] Cabeçalho compartilhado (`WorkspaceHeading`) em 1 linha: título + atalhos pequenos + ações; métricas viram pílulas. Vale para Financeiro, Conteúdo, Editais, Metas, Diário, Visão, Corpo, Profissional, Hermes, Fontes, Dados.
- [x] Financeiro: título "Financeiro" no lugar do hero.
- [x] Planejar: sem cartões "Nesta semana/Para decidir", sem linha de fuso repetida, sem "Ritmo da semana"; tira de dias só no celular.
- Bateria completa: 446/447; a falha (Escritório, copiar resposta longa) não tem relação e passou ao repetir.
- [x] Metas: pilares sem meta em uma linha só (clique cria a meta).
- [x] Profissional: título "Profissional" e números em pílulas.
- [ ] Conteúdo, Editais, Corpo, Profissional, Escritório: passada fina nos mesmos critérios.

## Próximas telas (28–29/10) — decisões: 1 sim, 2 sim, 3 seguir o sistema; feito na branch feat/polimento-2

### C — Conteúdo (Áreas)
- Mesmo amontoado do T1 de Tarefas: **contagem em 4 lugares** (pílulas Biblioteca/Em criação/Publicados, abas de canal com número, chips de etapa com número, cards).
- Duas fileiras de filtro (canal + etapa) + "Filtros" + sanfona "Mais opções de organização" = filtro em 4 lugares.
- Cards altos e vazios (título + 2 etiquetas + "agora"); "Geral" em todos (valor padrão aparecendo).
- Proposta: aplicar o padrão de Tarefas — 1 linha de controles (busca · canal como seletor · visões · Filtros único), etapas como colunas do quadro (como Tarefas), card compacto (título, canal por ícone, data), esconder "Geral", tirar a sanfona.

### F — Fontes & Refs (Sistema)
- Já enxuta. Só o estado vazio grande; ok. Avaliar se sai de Sistema e vai para Organizar junto de Notas (Recursos do PARA).

### E — Escritório (Sistema)
- Tem identidade própria (tema claro bege) e cabeçalho grande "Um lugar para as coisas acontecerem." + estação 3D. Destoa do resto, mas é uma decisão de marca.
- Proposta: cabeçalho de 1 linha "Escritório" e manter a estação; perguntar ao Jonny se o tema bege fica.

## Visual Retrô pixel (31/10) — branch feat/retro-pixel

Pedido: "incorporar bibliotecas mais aesthetic, retrofuturista e pixel art". Decisão de produto: **opt-in**, sem trocar o padrão Astral.

- **Onde liga:** Configurações → Visual (Astral / Retrô pixel) ou botão de controle de videogame no rodapé do menu. Salvo em `localStorage` (`lifesystem-skin`) e aplicado por script no `<head>` antes da pintura (sem piscar). Combina com tema escuro, claro e sistema.
- **Bibliotecas (versões fixas):** `pixelarticons@2.4.1` (ícones pixel, importados um a um por `pixelarticons/react/<Nome>`), `@fontsource-variable/pixelify-sans` (títulos), `@fontsource/silkscreen` (rótulos, botões primários, atalhos), `@fontsource/vt323` (números/terminal). Texto corrido continua em Inter para não cansar a leitura.
- **Escuro:** fliperama noturno — índigo `#0d0a1c`, ciano fósforo `#5ef2d6`, magenta neon `#ff6ad5` (acento de Tarefas/Foco no lugar do violeta). **Claro:** papel de manual `#f4ecd9`, tinta roxa e verde de monitor.
- **Linguagem:** cantos de 2–6px, bordas de 2px, sombra deslocada dura (sprite), botões que "afundam" ao clicar, cursor de seleção piscando no item ativo do menu, grade de pixels no fundo e scanlines de CRT só no escuro (sem interceptar cliques; somem na impressão). Animações respeitam `prefers-reduced-motion`.
- **Pixel art própria:** `src/components/brand/pixel-sprite.tsx` (planeta, foguete, estrela 16×16, cores pelos tokens do tema). Planeta substitui a marca no menu; foguete na **Caixa zerada**, estrela no **dia livre** de Hoje — recompensa visual dos momentos de fechamento do ciclo GTD.
- **Ícones:** `NavIcon` (`src/components/brand/pixel-icons.tsx`) desenha Lucide + pixel e o CSS mostra só o do visual ativo; destinos sem par pixel mantêm o Lucide.
- **Arquivos:** `src/app/retro.css` (tudo sob `[data-skin="retro"]`), `settings.tsx` (`useSkin`), `layout.tsx` (fontes + script), `button.tsx` (`data-variant` para estilizar por variante), menu/dock.
- **Teste:** `tests/retro-skin.spec.ts` — liga pelo menu, troca ícones, persiste após recarregar com fonte pixel no título, volta ao Astral.

## Escritório — Modo História (31/10) — branch feat/retro-pixel

Pedido: "upgrade de navegabilidade, relação entre os elementos e principalmente animações pra explicar a doutrina, como pequenas cenas de filme, diálogos, interfaces… como um videogame moderno".

- **Entrada:** botão `▶ História` na barra do Escritório (abre a Campanha) e, na primeira visita, uma "Transmissão recebida · Hermes" flutuante convidando ao prólogo. Ela é `position: fixed` de propósito: um banner no fluxo empurrava os controles durante a hidratação e fazia cliques errarem o alvo (pego pelos testes de Missões).
- **Campanha:** 7 capítulos com progresso, conquista por capítulo e "próximo" destacado — Prólogo (tripulação e ciclo), Tire da cabeça (capturar), Esclarecer (árvore de decisão + teclas 1–7), Organizar (projeto com próxima ação, áreas com projetos em órbita, nota destilada), Refletir (revisão de segunda em 7 passos), Agir (3 prioridades + Foco), O pacto (proposta → aprovação na tela → recibo). Cada fim de capítulo leva à tela real (Caixa, Projetos, Revisão, Hoje).
- **Cena:** faixas de cinema, cartão de título, diálogo com retrato (constelação do agente), plaqueta de nome, texto digitado; palco com mini-interface animada (`motion/react`) que avança junto com a fala. Espaço/Enter/→ completa e avança, ← volta, Esc sai para o menu. Leitor de tela recebe a fala inteira (`aria-live`); movimento reduzido mostra a fala inteira e corta animações.
- **Honestidade:** o roteiro descreve o sistema real — o mapa de teclas espelha `inbox/page.tsx` (comentado nos dois lados) e "O pacto" segue o contrato de propostas/aprovação/recibo. Progresso fica só no navegador (`lifesystem-office-story`): guia, não registro.
- **Arquivos:** `src/components/office/story/{chapters.ts,cutscene.tsx,stage-props.tsx,campaign.tsx,story.module.css}`, integração em `office.tsx`. No visual Retrô as cenas usam fonte pixel e bordas duras.
- **Testes:** `tests/office-story.spec.ts` (prólogo pelo convite até a conquista, Esc volta ao menu, ← volta fala, "Agora não" persiste). `office-provenance` passou a encerrar suas rotas (`unrouteAll`) porque a sonda em voo vazava para o teste seguinte.
- **Ponte cena → estação (03/11):** cada capítulo tem um anfitrião (`host`); o cartão final oferece "Ver {agente} na estação", que fecha a campanha e focaliza o agente com o painel de comando aberto.
- **Relação entre elementos (03/11):** com um agente em foco, a estação 3D desenha feixes tracejados animados (`AgentLinks` em `scene.tsx`) do posto dele até cada destino da sua área (os mesmos de "Abrir área de trabalho"). Somem na reunião de equipe e congelam com animações pausadas ou movimento reduzido.
- **HUD único (04/11, aprovado pelo Jonny):** os 5 controles do palco viraram ícones (nome em dica e para leitor de tela, mesmos nomes acessíveis) na faixa da doca da tripulação — ao lado dela a partir de 1400px, na faixa sob ela abaixo disso (acima, o painel do agente os cobriria), no alto do palco no celular. Missões mantém o nome por causa dos avisos. A grade "Selecionar agente" saiu do mapa 3D e ficou só na Lista. Saiu o texto de ajuda "arraste para orbitar…"; as teclas 1–6 vão para Configurações → Atalhos.

## Revisão (03/11) — branch feat/polimento-revisao — aprovada inteira e implementada

Leitura feita pelo Claude: dados sintéticos no servidor local + produção vista no Chrome do Jonny (só navegação, nenhuma ação). Produção: "última revisão há 33 dias"; caixa 7, atrasadas 8, projetos sem próxima ação 2, aguardando 0, backlog 2.

### Defeitos
- **B1 — captura sem texto derruba a revisão inteira** (`getTitle` lia `content` indefinido; a API aceitava captura sem `content`). Corrigido na branch: tela tolera e API grava `''`.
- **B2 — "última revisão" fica só no navegador** (`localStorage`): celular e PC mostram datas diferentes e limpar o navegador "esquece" a revisão. Proposta: guardar no servidor.
- **B3 — Direção mostra ids técnicos** (`identity`, `vision_5y`…) quando a Visão ainda não tem documentos.
- **B4 — o Modo História promete** "no fim, você escolhe o que importa na semana", mas a revisão termina sem essa escolha.

### Visual / fluxo
- **R1 — Cabeçalho:** sobretítulo + título grande + régua de 7 passos com rótulos + frase do menu no topo ("Revisar o caminho…"). Proposta: 1 linha "Revisão" + pílula "há 33 dias" (vermelha se > 7) + régua compacta só com pontos.
- **R2 — Número em 3 lugares:** "(7)" no título do passo, selo no menu e "+1 na fila". Proposta: o número fica só no ponto da régua.
- **R3 — Caixa com dois caminhos** ("Converter" em cada item e "Esclarecer um por vez") e lista cortada em 6. Proposta: esclarecer ali mesmo, um item por vez, com as teclas 1–7 da Caixa.
- **R4 — Atrasadas altas:** cada tarefa ocupa ~110px com 3 botões sempre visíveis; com 8 atrasadas o "Próximo" some da tela. Proposta: linha única, "há 10 dias" no lugar da data, ações no hover e teclas (A amanhã, S +7 dias, B backlog, C concluir).
- **R5 — Passos vazios** ("Aguardando (0) — Ninguém te devendo nada") custam um clique. Proposta: passo vazio já vem marcado ✓ e é pulado.
- **R6 — Direção longa e com caixa dentro de caixa:** um cartão por meta. Proposta: uma linha por área com barrinhas, e só as metas atrasadas em destaque.
- **R7 — Final:** "Concluir revisão" no passo 6 e o passo 7 "Pronto" só um parabéns. Proposta: o passo 7 vira "Semana": escolher até 3 prioridades (resolve B4), resumo do que foi feito ("7 esclarecidas · 5 reagendadas") e botão Planejar.
- **R8 — Lembrete:** nada avisa que a revisão está atrasada. Proposta: em Hoje, nas segundas ou após 7 dias, um cartão "Dia de revisão".

### Feito (03/11)
- B1 também protegido na Caixa (`clarify-card.tsx`) e no diálogo de conversão; teste com captura sem texto pela API.
- B2: `POST/GET /api/weekly-review` (coleção `weekly_reviews`, histórico completo). Revisão, Hoje e Visão geral leem do servidor; a data antiga do navegador vale só até a primeira revisão nova.
- B3/R6: Direção em uma linha por área, metas abaixo de 50% em âmbar, seções da Visão com nome legível.
- R1/R2/R5: cabeçalho de 1 linha com pílula de idade; régua de pontos com a contagem no ponto (✓ quando zerado, bússola/estrela em Direção/Semana); abre no primeiro passo com trabalho e pula passos vazios.
- R3: o Esclarecer da Caixa virou componente (`ClarifyCard`) usado também no passo 1, com as teclas 1–7 e S.
- R4: atrasadas em linha única, "há N d", ações no hover (sempre visíveis no toque) e teclas A/S/B/C na linha focada; tarefa com horário mantém "Replanejar horário".
- R7/B4: passo 7 "Sua semana" — até 3 prioridades + resumo da sessão; ao concluir grava no servidor e mostra as escolhidas + Planejar a semana. Hoje mostra a linha "Semana" com elas até a próxima segunda.
- R8: o aviso "Revisão semanal pendente" de Hoje já existia; passou a usar a data do servidor.
- Testes: `tests/weekly-review.spec.ts` (API, captura sem texto, fluxo com passo vazio pulado e prioridades, atalho A). Ajustados `core-workflow`, `system-experience` e `review-recovery`, que fixavam o fluxo antigo.

## Configurações (04/11) — aprovada inteira e implementada

Hoje é um diálogo pequeno (`src/components/layout/settings.tsx`) com Tema, Visual, Dados e Atalhos. Lido no servidor local com dados sintéticos.

- **S1 — Atalhos incompletos e com a tecla errada:** mostra ⌘ (Mac) num PC Windows; faltam Ctrl+D (Metas), Ctrl+B (Diário de bordo), Ctrl+E (Editais), Ctrl+Shift+H (Hermes) e os de tela (N nova tarefa, 1–7 e S na Caixa, A/S/B/C na Revisão, 1–6 tripulação no Escritório, Espaço/P/C/I no Foco). Nomes em inglês ("Command Palette", "INBOX"). Proposta: lista em português, gerada do mesmo mapa que a paleta usa (não diverge mais), com Ctrl ou ⌘ conforme o aparelho, agrupada por tela.
- **S2 — Jornada e fuso moram em Planejar:** pela regra geral, ficam em Configurações. Proposta: seção "Jornada" com início/fim, dias e fuso; Planejar mostra só "Jornada 08–20 · editar".
- **S3 — Fuso é texto livre** ("America/Sao_Paulo" digitado à mão). Proposta: lista de fusos com o do aparelho sugerido.
- **S4 — Parágrafo de ajuda em Dados** (4 linhas). Proposta: uma linha ("Exporta as áreas principais; não substitui o backup do servidor").
- **S5 — Subtítulo "Personalize o LIFESYSTEM"** não diz nada. Proposta: tirar.
- **S6 — Com mais seções o diálogo fica longo.** Proposta: abas Aparência · Jornada · Dados · Atalhos, e link direto (abrir Configurações já na aba Jornada a partir de Planejar).
- **S7 — Dia da revisão fixo na segunda.** Proposta: escolher o dia em Jornada; o aviso de Hoje e a pílula da Revisão seguem esse dia.

### Feito (04/11)
- S1: `src/lib/shortcuts.ts` é a fonte única — a paleta navega e anuncia atalhos a partir dela, e Configurações → Atalhos lista os mesmos grupos em português, com Ctrl no PC e ⌘ no Mac. Corrigido o texto antigo do Escritório: são 7 tripulantes, teclas 1–7.
- S2/S3: a jornada saiu de Planejar (e da Agenda da Semana em Tarefas) para Configurações → Jornada; nas telas fica a linha "Jornada 08:00–20:00 · todos os dias · fuso · Ajustar jornada", que abre a aba direto. O fuso virou lista com o deslocamento (GMT-3) e oferece o fuso do aparelho. Planejar atualiza na hora pelo evento `lifesystem-planning-preferences`.
- S4/S5/S6: diálogo em abas (Aparência · Jornada · Dados · Atalhos), sem subtítulo e com uma linha em Dados; `open-settings` aceita `{ tab }`.
- S7: dia da revisão em `GET/PUT /api/weekly-review/settings` (coleção `weekly_review_settings`), fora do contrato estrito da jornada, que o MCP também lê. Hoje lembra a partir desse dia.
- Corrigido junto: "há N d" das atrasadas na Revisão dependia da hora do dia; agora conta dias de calendário.
- Testes: `tests/settings.spec.ts` (API do dia, atalhos com Ctrl e Ctrl+I navegando, jornada salva atualizando Planejar, lembrete de Hoje pelo dia combinado). `task-relationships-ui` passou a procurar "Ajustar jornada".

## Editais (04/11) — aguardando aprovação do Jonny

Lido no servidor local com 4 editais sintéticos.

- **E1 — Número em 3 lugares:** pílula "4 No radar" (que é o total, e confunde com a etapa Radar = 2), aba "Todos 4" e contagem em cada etapa. Proposta: contagem só nas abas de etapa; pílulas ficam só "1 fecha em 14 dias" e "0 viraram projetos".
- **E2 — Link Projetos duas vezes** (atalho no título e "Projetos →" à direita). Proposta: só o do título.
- **E3 — 5 botões no cabeçalho** (Automação, Etapas, Buscar editais, Analisar com IA, Novo edital) quebram em duas linhas. Proposta: Novo edital + Buscar com IA; Automação, Etapas e Analisar num menu ⋯.
- **E4 — Cartões grandes** (título em serifa de 2 linhas, etapa repetida no cartão). Proposta: Lista em linhas (título · órgão · valor · prazo), no padrão de Tarefas; o Quadro continua para arrastar entre etapas.
- **E5 — Prazo pouco útil** ("09 de nov. · Em breve"). Proposta: contagem regressiva ("em 5 dias", "hoje", "encerrado").
- **E6 — Alarme fora de hora:** edital já Inscrito mostra o prazo vencido em vermelho ("Encerrado"), mas isso é o esperado depois de inscrever. Proposta: vermelho só em Radar e Em análise.
- **E7 — Textos de ajuda** no Cockpit da automação e no formulário. Proposta: só rótulos; os avisos que importam (limite de 6 URLs, só modelos gratuitos) ficam como dica curta.
- **E8 — Título "Editais Culturais"** e menu "Editais". Proposta: "Editais" nos dois.

## Corpo & saúde (04/11) — aguardando aprovação do Jonny

Lido no servidor local com 4 observações sintéticas.

- **B1 — Ordem errada:** a lista diz "Mais recentes primeiro", mas ordena pela hora do registro, não do fato (água de 2h atrás aparece abaixo de uma caminhada de ontem). A API ordena por registro, como prevê o contrato `list_health_observations` do Órion; a correção é só na tela, sem mexer no contrato.
- **C1 — Textos de ajuda e sobretítulos:** "Mais recentes primeiro", "CONTROLE SEU · Antes de registrar" + parágrafo, "CONTEXTO DECLARADO · Seu ritmo é contexto" + parágrafo, "Obrigatório inclusive para peso". Proposta: tirar; os princípios (lacuna é desconhecido, aprovação só na tela) continuam valendo no comportamento.
- **C2 — Caixa dentro de caixa:** linha do tempo é um cartão com cartões dentro; a coluna da direita tem mais dois cartões. Proposta: linhas simples.
- **C3 — Painel de propostas do Órion ocupa espaço vazio.** Proposta: some quando não há proposta; quando há, aparece no topo como "Órion propôs 2 registros · revisar".
- **C4 — Registrar leva 3 passos** (escolher tipo, digitar data e hora do zero, valor). Proposta: botões rápidos por tipo (Água, Sono, Peso, Movimento, Refeição, Energia, Estresse) com "quando" já preenchido como agora, visível e editável — não inventa data, porque é você confirmando.
- **C5 — "Corrigir ›" sempre visível** em cada linha. Proposta: aparece ao passar o mouse (sempre visível no toque).
- **C6 — Nenhuma visão da semana.** Proposta: 7 dias em barrinhas de sono e água por dia; dia sem registro aparece vazio (desconhecido), nunca zero.
- **C7 — Contexto declarado é um bloco de texto.** Proposta: uma linha "Objetivos · Rotinas · Pilares" com Editar.
- **C8 — Apple Saúde:** ver opções abaixo; depende da decisão do Jonny sobre consentimento.

### Apple Saúde — opções
O Apple Saúde não tem API na web: os dados só saem pelo iPhone.
1. **Atalhos do iPhone (gratuito):** uma automação diária do app Atalhos lê passos, sono, peso e treinos do Saúde e envia ao LifeSystem com uma chave própria, só de saúde. Cada amostra entra com origem "Apple Saúde" e identificador da amostra (sem duplicar).
2. **App Health Auto Export (pago):** envia mais tipos de dado sozinho, por automação. Custo recorrente.
3. **Exportação manual (gratuita):** Saúde → Exportar todos os dados → enviar o arquivo; bom para trazer o histórico antigo de uma vez.
Decisão pendente: os dados do Apple Saúde entram direto (são medições do seu próprio aparelho, separadas dos relatos) ou passam por aprovação em lote, como as propostas do Órion? Hoje o sistema não tem nenhum consentimento recorrente ativo; entrar direto cria o primeiro.
