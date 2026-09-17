# Análise completa do LIFESYSTEM — telas, UX, design e código

*Data: 2026-09-17 · Escopo: 15 telas (desktop 1440px + mobile 390px), navegação, temas, arquitetura front, segurança e qualidade. Base: screenshots de `screenshots/astral-review/`, `qa-screenshots/` e leitura integral do código em `src/`.*

---

## Sumário executivo

O LIFESYSTEM está **muito bem construído** pra uma ferramenta pessoal: identidade visual coesa (astral/solar), arquitetura de dados limpa (storage único, locks por coleção, zod nas APIs), decisões de produto registradas em comentários e no Diário de Bordo, e um pipeline de captura → triagem → conversão que é o coração certo pra um segundo cérebro.

Encontrei **2 achados críticos** (um de privacidade, um de CSS que afeta o tema escuro inteiro), **~10 achados de UX/design** de alto impacto e uma camada de inconsistências menores. Nada disso desmonta o sistema — são correções cirúrgicas, na maioria.

| Prioridade | Achado | Esforço |
|---|---|---|
| **P0** | Dados pessoais reais commitados em repo **público** | Médio |
| **P0** | Classes `dark:` não reagem ao toggle de tema (Tailwind v4 sem `@custom-variant`) — cards do INBOX ilegíveis no escuro | Baixo |
| **P1** | Páginas de fila (INBOX/Notas) mal aproveitam telas largas; densidade inconsistente | Médio |
| **P1** | Sobrecarga de ações na toolbar de Tarefas; dupla semântica de "Salvar" | Médio |
| **P1** | Dois CTAs primários competindo em Notas; hierarquia de botões | Baixo |
| **P1** | Home: stats inertes, idioma misturado, contradição "0% conclusão" × "🎉 nada pra hoje" | Médio |
| **P1** | Empty states que expõem jargão de kanban ("Solte aqui") como primeira experiência | Baixo |
| **P1** | Cookie de sessão eterno (HMAC estático, sem expiração) | Baixo |
| **P2** | Código morto: `sidebar.tsx` (377 linhas) sem imports; atalhos ⌘ anunciados não funcionam | Baixo |
| **P2** | Sidebar refetcha tasks+captures a cada navegação, sem cache | Baixo |
| **P2** | Mobile: 5 cards de stats empurram conteúdo acionável pra fora da dobra | Médio |

---

## 1 · O que está bom (manter e proteger)

1. **Identidade visual autoral.** Fraunces display + Inter de leitura, paleta solar (`--color-primary: #ecc48d` no dark) e decoração contida por trás do conteúdo (`.astral-workspace` com gradientes radiais a 6-10% de opacidade). O manifesto "decoration belongs behind content, never behind form text" no topo do `astral.css` é o tipo de regra que mantém um design system vivo.
2. **Movimento com propósito.** `layoutId="nav-active"` na sidebar, transições de página de 280ms, `whileHover` só onde há affordance de clique — e `prefers-reduced-motion` respeitado globalmente (astral.css, fim do arquivo). Raro ver isso em projeto pessoal.
3. **Arquitetura de dados honesta.** `src/lib/storage/index.ts`: escrita atômica (tmp + rename), fila de lock por coleção, conversão de captura idempotente (`convertCapture` com override de targetId). APIs com zod (`src/lib/validation.ts`). Isso é a base certa pra migrar pra Postgres/Supabase depois sem reescrever telas.
4. **Pensamento de produto real.** O loop INBOX → Revisão Semanal → destinos é GTD de verdade, não cosmética. `CaptureTargetType` já inclui `'reference'` — porta aberta exata pra Central de Fontes (doc irmã desta análise). Copiloto com confirmação explícita antes de escrita (`copiloto/tools.ts`). MCP com escopos por chave.
5. **Segurança com decisões documentadas.** Auth fail-closed (sem env → ninguém entra), guard SSRF completo em `fetch-page.ts` (localhost/PRs/loopback, cap de bytes, content-type), rate limit em login/MCP, CSRF origin-check escrito a partir de um incidente real (comentário no `proxy.ts`). E os testes: 7 specs Playwright cobrindo APIs, auth e domínio, rodando no CI com `tsc --noEmit` + build.
6. **Documentação viva.** `DIARIO_DE_BORDO.md` é um changelog técnico com filosofia de priorização explícita. Esse hábito é o maior ativo do projeto.

---

## 2 · P0 — corrigir antes de qualquer feature nova

### 2.1 Dados pessoais em repositório público 🔴

O repo `jonnyakbal/lifesystem` está **público** e o `data/` está commitado com dados **reais**, não seed:

- `data/journal.json` — entradas de diário pessoal ("HOJE O BAGULHO FOI DOIDO", gratidão, check-ins por pilar);
- `data/financial.json` — lançamentos reais ("Moradia — mãe — R$ 400");
- `data/projects.json`, `data/tasks.json`, `data/captures.json`, `data/vision.json` — projetos, clientes, TCC, visão de vida (Plano de Voo inteiro em `vision.json`);
- `data/accounts.json` — tipos de conta/bancos.

O próprio `docs/astral-redesign.md` manda "não publicar dados reais", e o `.gitignore` já exclui `data/runtime/`, `data/backups/` e `data/google-calendar.json` — o problema é só o seed que virou dado real ao usar o app local apontando pro `data/` do repo.

**Plano de correção (nessa ordem):**
1. **Curto prazo imediato:** tornar o repo **privado** enquanto o histórico não é limpo (1 clique; o CI e o deploy da Hostinger continuam funcionando por integração).
2. Substituir `data/*.json` por **seed anônimo e plausível** (nomes fictícios, valores redondos, sem diário real) — o app já lê qualquer coleção vazia, então o seed serve só pra demo/local.
3. **Limpar o histórico** com `git filter-repo` (ou BFG) removendo `data/*.json` de todo o histórico, adicionar `/data/*.json` ao `.gitignore` (exceto `data/README.md` e um `data/seed/` versionado) e force-push.
4. Production já segue a regra certa (`LIFESYSTEM_DATA_DIR` fora do release — `.env.example` documenta). Local passa a usar `data/runtime/` (já ignorado).
5. Rotacionar credenciais que possam ter vazado junto: nenhuma chave está commitada (verifiquei), mas **revalidar** `GOOGLE_CALENDAR_*` e chaves de IA por precaução, já que o Diário de Bordo registra que chaves de IA passaram por texto em conversa.

> Escolha: se o objetivo declarado de "abrir o LIFESYSTEM como open source" (roadmap §8) vale pra esse repo, o passo 2-3 é obrigatório de qualquer forma. Se não vale, privado já resolve hoje.

### 2.2 `dark:` quebrado no tema escuro 🔴

**Sintoma:** no screenshot dark do INBOX, o sticky azul-claro tem texto branco (`text-foreground/90`) — ilegível. No light, o mesmo card fica correto.

**Causa raiz:** o app usa Tailwind **v4** (`@import "tailwindcss"` em `globals.css`) e liga/desliga tema via **classe** `.dark` no `<html>` (toggle do `settings.tsx`). Mas em v4 a variante `dark:` por padrão escuta `prefers-color-scheme` do **sistema operacional**, não classe. Não existe `@custom-variant` em nenhum dos dois CSS. Resultado: **todas** as classes `dark:` do codebase (stickies do INBOX, badges, hover states) seguem o SO e ignoram o toggle do app — e os screenshots de QA foram tirados numa máquina com SO em light, o que **mascaro** o bug nas validações visuais.

**Correção (1 linha em `globals.css`):**

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Depois, re-auditar visualmente dark/light **com o toggle do app** (não o do SO): INBOX stickies, componentes `ui/` que usam `dark:`, e as cores determinísticas de captura. Adicionar ao `qa-*.js` um teste que alterna o tema **dentro** do app antes de fotografar — hoje a suíte não conseguiria detectar essa classe de bug.

---

## 3 · P1 — UX e design (por tela)

### 3.1 Densidade e largura — "o oceano vazio"

Desktop 1440px: **INBOX** renderiza a fila inteira dentro de `max-w-xl` (busca) e um grid de stickies de 4 colunas, deixando ~55% da tela morta à direita; **Notas** tem o catálogo vazio numa única coluna larga com muito respiro desperdiçado quando há conteúdo. Enquanto isso **Tarefas/Projetos/Conteúdo** (kanbans) usam a largura toda com competência.

**Proposta:** padronizar 3 templates de página no `page-wrapper`:
- **Fila** (INBOX, Hoje): grid fluido `repeat(auto-fill, minmax(240px, 1fr))` sem max-width — sticky notes preenchem o espaço disponível;
- **Biblioteca** (Notas, Conteúdo): conteúdo em `max-w-6xl` + painel lateral de filtros/categorias persistente no desktop (hoje os filtros são chips soltos acima da lista);
- **Leitura/edição** (editor de nota, futuro leitor de fontes): medida de leitura ~68ch centrada — aqui o vazio é intencional.

### 3.2 Toolbar de Tarefas — sobrecarga de ações

A linha de ações tem: busca, Filtros, **Salvar**, Selecionar, lápis (renomear colunas?), 4 alternadores de view (kanban/lista/calendário/agenda) e **+Nova**. São 8 controles concorrendo, dois deles com peso visual de ação primária. "Salvar" manual junto de views que já persistem na hora cria dúvida: *o que exatamente ele salva?*

**Proposta:**
- **Exibição** (kanban/lista/calendário/agenda + densidade) vira um único segmented-control ou dropdown "Exibir" — é um grupo conceitual, não 4 botões soltos;
- **Salvar** só existe onde há estado não persistido; se todas as mutações já são PATCH-on-action, remover o botão e confiar no autosave (padrão que Notas já usa);
- **Selecionar** (modo batch) é ação secundária — vira item de menu "⋯" junto com configurar colunas;
- Na tela ficam: busca, Exibir, Filtros, ⋯, **+Nova** (única primária).

### 3.3 Notas — dois CTAs primários

"Categorias" (preenchido, roxo) e "+ New" (preenchido, roxo) lado a lado. Categorias é *gestão*, não *ação principal do fluxo*. **Proposta:** "Categorias" vira `ghost/outline` ou popover; única primária é **+ Nova nota**. Aproveitar e renomear "+ New" → "+ Nova" (o app inteiro é PT-BR; hoje mistura "Command Center", "+ New", "Todos").

### 3.4 Home ("Command Center")

- **Idioma:** "Command Center" em EN no app mais PT-BR do mundo. Sugestão: "Seu dia em órbita" / "Painel" / "Hoje no seu universo" — mantém a voz astral em PT.
- **Stats inertes:** os 5 cards (Capturas/Tarefas/Concluídas/Projetos/Pilares) não são clicáveis. Cada um deveria navegar pro respectivo módulo com o filtro aplicado (card Projetos → /projetos; card Capturas → /inbox). Hoje são decoração com número.
- **Contradição de estado:** "Nenhuma tarefa para hoje 🎉" (positivo) em cima de "Taxa de Conclusão 0%" (vermelho implícito de fracasso) no mesmo viewport. Quando não há nada planejado, a taxa deve ficar em estado neutro ("—" ou escondida), não zero.
- **Ordem de prioridade invertida:** stats antes do conteúdo. Em 1440px a primeira dobra é quase toda métrica; a agenda do dia e as capturas recentes — o que gera *ação* — ficam abaixo. **Proposta:** "Tarefas de Hoje" e "Últimas Capturas" primeiro, stats como faixa compacta clicável acima ou abaixo.
- **Pipeline de Conteúdo** como barra única esconde os itens; mostrar os 2-3 conteúdos mais próximos de publicar (agendados/rascunho), linkando pro kanban.

### 3.5 Hoje — três vazios empilhados

"Tarefas de hoje (0)" + "Metas do dia" + "Conteúdo agendado hoje" como três cards vazios consecutivos = tripla dose de "nada aqui". **Proposta:** consolidar num único card **"Seu plano de hoje"** com seções internas e um empty state unificado com CTA ("Montar meu dia →" abrindo o Wizard de Planejar). Metas do dia merece destaque — é o bloco mais usado do fluxo diário (os −/+ de indicadores), pode virar a primeira seção.

### 3.6 Editais — jargão como primeira experiência

Com a base vazia, a tela mostra 4 colunas com "Solte aqui" — instrução de *drag* como única mensagem. **Proposta:** empty state do módulo (não da coluna): "Nenhum edital no radar. **Buscar editais com IA**" (o detector já existe!) + "Adicionar manualmente". Os "Solte aqui" aparecem só depois de haver ≥1 card, ou hover durante drag real.

### 3.7 INBOX — o resto

- Card sticky ilegível no dark = bug P0 2.2 (corrigir resolve).
- **Ação ambígua:** clique no card abre `CaptureConversionDialog` (converter), mas o rótulo do card não diz isso; a seta ↗ no rodapé sugere "abrir". **Proposta:** clique abre **o cartão da captura** (visualizar/editar título, categoria, link) com "Converter para…" como ação primária dentro dele — igual ao fluxo de /notas?open=.
- A Revisão Semanal como botão gigante fixo no topo é bom lembrete, mas deveria **recolher para um banner discreto** quando a revisão foi feita nos últimos 7 dias (a data de conclusão existe no fluxo).

### 3.8 Mobile

- **Home:** 5 stats cards (2 colunas × 2+1) ocupam a dobra inteira; "Tarefas de Hoje" só aparece rolando. Reduzir stats pra **faixa horizontal de 2-3 métricas compactas** (scrollável) e subir Hoje/Capturas.
- **Conteúdo:** chips de canal + chips de estágio + busca + 4 ícones de view + Filtros + Salvar + lápis + Novo = 3 linhas de controles numa tela de 390px. Mesmo tratamento da 3.2 (colapsar view em dropdown, ⋯ para o resto).
- **Header:** o badge do sino (notifications) aparece constante nos screenshots — garantir que contador zera ao abrir o centro e que notificações velhas expiram, senão vira "menagem" ignorada.
- **Safe areas / alvos:** dock e header respeitam `env(safe-area-inset-*)` ✅; os alvos do kanban (menus de card) já têm 40px+ ✅. Bom.

### 3.9 Sistema de design — pequenas derivas

- **Botões:** `+ Nova`, "Adicionar", "Criar Primeira Nota", "Capturar uma ideia" — 4 verbos pra o mesmo ato de criar. Padronizar: **"Nova tarefa/nova nota/nova captura"** (substantivo + gênero) em todos os CTAs primários.
- **Emojis como ícone de dado:** indicadores usam 💪 💧 🎯 direto do usuário. Funciona, mas destoa da linguagem Lucide e quebra em alguns densities — renderizar dentro de um "avatar" circular com fundo `muted` normaliza o peso visual sem tirar a graça.
- **Topbar:** breadcrumb "Meu espaço / X" + frase fixa "Um passo de cada vez." — a frase é charmosa 1×/semana e ruído 20×/dia. Sugestão: variar entre micro-mensagens contextuais por módulo (ex.: no Financeiro, " regime: este mês") ou remover.

---

## 4 · P2 — código, navegação e infraestrutura

1. **`src/components/layout/sidebar.tsx` é código morto** (377 linhas, zero imports — o ChromeGate usa `workspace-sidebar.tsx`). Pior: é nele que vivem os atalhos ⌘H/⌘I/⌘T anunciados como `<kbd>`… que portanto **não funcionam** na UI viva. Deletar o arquivo e implementar os atalhos de verdade no `command-palette.tsx` (que já tem a infra de hotkeys), reexibindo o `<kbd>` nos itens do palette.
2. **Contadores da sidebar:** `WorkspaceSidebar` faz 2 fetches (`/api/tasks`, `/api/captures`) **a cada mudança de pathname**, sem cache nem dedupe. Extrair pra um `NavCountsProvider` com SWR-style: busca 1×, invalida por evento (após create/convert/delete) via `window.dispatchEvent('ls:counts:dirty')`. Menos tráfego, números sempre certos, e permite contar INBOX *não lido* em vez de `captures.length` (que conta processadas — número errado hoje).
3. **Sessão eterna:** o token é `HMAC(AUTH_PASSWORD, 'lifesystem-authenticated')` — determinístico, sem expiração. Quem copiar o cookie uma vez, entra pra sempre (e o valor é o mesmo em todos os devices/sessões). **Proposta mínima:** `HMAC(secret, `${dayBucket}`)` com `dayBucket` = semana ISO + `Max-Age` de 7d — mantém simples e dá rotação semanal automática (logout natural ao trocar a semana; aceitável num app single-user). Documentar no Diário de Bordo.
4. **`fetch-page.ts` é a fundação certa pra Central de Fontes**, mas hoje só tira tags por regex — sem `<title>`, sem Open Graph, sem article extraction, sem RSS. A spec da feature nova (doc irmã) já nasce estendendo esse arquivo com os mesmos guards (SSRF, bytes, content-type).
5. **Testes:** os specs de API são bons. Falta: (a) teste de **conversão de captura** (o fluxo mais crítico do produto — hoje coberto só por `qa-flows.js` manual), (b) um teste de tema (toggle → snapshot de contraste do sticky), (c) rodar `qa-*.js` agendado no CI semanal pra pegar regressões visuais.
6. **CI:** roda em push/PR pra `main` ✅; a branch de trabalho desta sessão não dispara CI — considerar `branches: [main, 'arena/**']` se quiser ver checks aqui.

---

## 5 · Ordem de execução sugerida

1. **Hoje (30 min):** repo privado → substituir `data/` por seed → `@custom-variant dark` → auditoria visual dark.
2. **Rodada UX 1 (meio dia):** INBOX (grid fluido, card clicável correto, revisão colapsável) + Notas (CTA único, categorias ghost) + deletar `sidebar.tsx` morto.
3. **Rodada UX 2 (meio dia):** Tarefas/Conteúdo (toolbar consolidada, autosave honesto) + Home (stats clicáveis, ordem, idioma) + Hoje unificado + Editais empty state.
4. **Infra (2h):** sessão com rotação semanal, `NavCountsProvider`, atalhos ⌘ reais no command palette.
5. **Só depois:** Central de Fontes (spec completa em `docs/central-de-fontes-spec.md`) — feature nova merece o chão limpo, e ela *depende* do dark: corrigido (o leitor é uma tela de leitura longa; tema é o coração da experiência).
