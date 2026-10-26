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
