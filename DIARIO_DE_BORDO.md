# Diário de Bordo — LIFESYSTEM

> Registro técnico e de produto do LIFESYSTEM: stack, infraestrutura, segurança, testes, linha do tempo de evolução e roadmap. Atualizado conforme o sistema evolui — cada entrada nova vai no topo da seção "Linha do tempo".

---

## 1. O que é o LIFESYSTEM (visão de produto)

Um "segundo cérebro" pessoal do Jonny — não um produto pra terceiros, é ferramenta de uso próprio, de uso diário, feita pra reduzir a carga cognitiva de gerir a vida (Dona Maria, ARCO LABS/PASS, TCC, saúde, finanças, criação de conteúdo) num só lugar.

**Princípios que guiaram as decisões de produto até aqui:**
- **Captura rápida, processamento deliberado.** O INBOX existe pra tirar qualquer ideia da cabeça em segundos; a Revisão Semanal e o Wizard "Planejar" são os momentos deliberados de decidir o que aquilo vira. Memória/revisão é ato intencional, não algo gerado silenciosamente por trás — decisão explícita registrada no código (`weekly-review-flow.tsx`).
- **6 Pilares como eixo central.** Fé & Propósito, Físico/Corpo, Mente/Conhecimento, Profissional/Talentos, Dinheiro & Patrimônio, Comunidade. Tarefas, Metas, Conteúdo e Projetos se conectam a esses pilares — é o "framework" pessoal do Jonny, não um conceito genérico de produtividade.
- **BHAG em cima, indicadores operacionais embaixo.** Cada pilar tem uma meta grande de ano (`Pillar.target`) e metas menores/recorrentes (`Indicator`) — direção de longo prazo não se mistura com o check-in diário.
- **Single-user por design.** Não é multi-tenant, não tem plano de virar SaaS — é o sistema pessoal do Jonny. Isso simplifica auth, dados e infraestrutura em todas as decisões técnicas abaixo.
- **Mobile-first na prática, não só em CSS.** Jonny opera o Dona Maria e o resto da vida do celular a maior parte do tempo — cada fase de desenvolvimento revisou UX mobile explicitamente (PWA instalável, bottom nav, ajuste de fontes).

---

## 2. Stack técnica

| Camada | Tecnologia | Observação |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | SSR/CSR híbrido, Route Handlers como API |
| Linguagem | TypeScript | strict via `tsc --noEmit` como gate de qualidade |
| UI | React 19 + Tailwind CSS v4 | design system próprio sobre Radix UI (dialog, dropdown, select, tabs, tooltip, etc.) |
| Componentes base | Radix UI + `class-variance-authority` + `tailwind-merge` | padrão shadcn-like, sem depender do pacote shadcn em si |
| Animação | `motion` (Framer Motion) | usado em praticamente toda transição de UI (steppers, cards, modais) |
| Editor de texto rico | Tiptap 3 (`@tiptap/*`) | Notion-style: slash commands, drag handle, tabelas, task lists, sub-páginas embutidas |
| Ícones | `lucide-react` | |
| Scroll suave | `lenis` | |
| Comandos/busca | `cmdk` | Command Palette (⌘K) |
| Notificações UI | `sonner` | toasts |
| Datas | `date-fns` | |
| Imagens | `sharp` | processamento de upload |
| IDs | `uuid` | geração de id em `storage.create` |
| Validação/schemas | `zod` v4 | usado nas ferramentas MCP |
| Integração de IA | `@modelcontextprotocol/sdk` | servidor MCP (ver seção 4.3) |
| Testes/QA | Playwright (`@playwright/test`) | scripts ad-hoc de screenshot, não suíte de asserções (ver seção 5) |
| Persistência | JSON em arquivo (`data/*.json`) | sem banco de dados — ver seção 4.2 |
| Auth (web) | Cookie HMAC-SHA256 próprio | sem NextAuth/Clerk/etc, ver seção 4.4 |
| Deploy | Hostinger (hospedagem compartilhada Node.js) | ver seção 4.1 |

**Dependência instalada mas não usada em produção hoje:** `@supabase/ssr` e `@supabase/supabase-js` — preparadas pro dia da migração de storage (ver Roadmap), mas o app roda 100% em JSON local.

---

## 3. Estrutura do projeto

```
src/
├── app/
│   ├── api/                 # Route Handlers — uma pasta por coleção (tasks, content, captures, pillars, indicators, projects, financial, etc.) + /api/mcp
│   ├── (dashboard)/         # páginas autenticadas: inbox, hoje, planejar, notas, visao, projetos, tarefas, conteudo, indicadores, financeiro, diario, revisao
│   ├── login/
│   └── layout.tsx
├── components/
│   ├── layout/               # sidebar, command-palette, settings, notification-center
│   ├── ui/                   # primitivos (button, card, dialog, input, ...)
│   └── *.tsx                 # componentes de fluxo (weekly-review-flow, planning-wizard, content-editor, status-label-editor-dialog, ...)
├── lib/
│   ├── storage/               # camada de dados única (getAll/getById/create/update/delete/query)
│   ├── mcp/                   # servidor + ferramentas MCP
│   ├── auth.ts                 # HMAC session token, timing-safe compare
│   ├── api.ts                   # wrapper de fetch pro frontend (apiFetch/showError)
│   ├── recurring.ts             # lógica de tarefas recorrentes
│   └── status-labels.ts         # overrides de rótulo de status (localStorage)
├── types/index.ts             # única fonte de verdade dos tipos de domínio
└── middleware.ts               # gate de auth cookie-based (produção only)
data/*.json                    # "banco de dados" — 14 coleções hoje
```

---

## 4. Infraestrutura

### 4.1 Deploy

- **Onde:** Hostinger, hospedagem Node.js compartilhada — `https://lifesystem.oj0nny.com`.
- **Como:** integração nativa Hostinger↔GitHub. Push no branch `main` → build (`npm run build`, `output: standalone`) → `npm start` serve a app.
- **Sem infra própria** (sem Docker, sem VPS pro LIFESYSTEM em si — a VPS é onde o Hermes Agent roda, separado).
- **Sem staging.** Todo push em `main` vai direto pra produção — por isso o padrão desta sessão de sempre rodar `tsc`/`build`/teste manual *antes* de cada commit, e só dar `git push` quando o Jonny pede explicitamente.

### 4.2 Storage

- **JSON local em arquivo**, um arquivo por coleção em `data/*.json` (`tasks.json`, `projects.json`, `captures.json`, `pillars.json`, `indicators.json`, `content.json`, `financial.json`, `accounts.json`, `budgets.json`, `bills.json`, `cards.json`, `payees.json`, `journal.json`, `vision.json`, `wiki-collections.json`).
- Camada única de acesso: `src/lib/storage/index.ts` (`getAll`, `getById`, `create`, `update`, `delete`, `query`) — toda rota REST e toda ferramenta MCP passa por ela. Isso é o que tornou o servidor MCP barato de construir: zero lógica de dados duplicada.
- **Risco conhecido:** escrita não é atômica nem lockada — duas escritas concorrentes na mesma coleção podem se pisar (aceitável hoje: 1 usuário, tráfego baixo; vira problema se o Hermes e a UI escreverem ao mesmo tempo com frequência alta — ver Roadmap/Dívida técnica).
- Pasta `data/` precisa de permissão de escrita no ambiente de deploy (documentado no README).

### 4.3 Integração de IA — servidor MCP

- `/api/mcp` expõe CRUD completo (Model Context Protocol) sobre Tarefas, Conteúdo, INBOX/Notas, Pilares (leitura+update), Metas e Projetos — 22 ferramentas ao todo, geradas por uma factory (`registerCrudTools` em `src/lib/mcp/tools.ts`) pra não repetir o mesmo código 6 vezes.
- Transporte: `WebStandardStreamableHTTPServerTransport` do SDK oficial, modo stateless (uma instância de servidor MCP por request — sem estado de sessão entre chamadas).
- Consumidor alvo: **Hermes Agent** (open source, Nous Research), instância pessoal do Jonny rodando na própria VPS, conectando por Telegram — o LIFESYSTEM vira uma "ferramenta" que o Hermes descobre e usa sozinho, sem glue code manual.
- Testado ponta a ponta manualmente via `curl` antes do commit: handshake, listagem das 22 tools, `create_task` → confirmado gravado em `data/tasks.json` → `list_tasks` com filtro → `delete_task` → confirmado removido.

### 4.4 Ideia futura registrada — visão integrada de calendários (Google Agenda)

Jonny quer uma visão que unifique todos os "calendários" internos do LIFESYSTEM (prazos de Tarefa, `scheduledDate` de Conteúdo, vencimentos Financeiros — já existe um calendário unificado interno, ver Fase 5 na linha do tempo) e que **espelhe/conecte com o Google Agenda** de verdade (não só visualmente parecido — sincronizar ou pelo menos importar/exportar eventos reais). Ainda não tem escopo definido — precisa de uma rodada própria de perguntas antes de virar plano (via API do Google Calendar com OAuth? sincronização de mão única ou nas duas direções? o Hermes participa disso também, já que ele processa linguagem natural?). Registrado aqui e no arquivo de plano ativo pra não perder.

---

## 5. Segurança

**Modelo de auth (interface web):**
- Cookie `lifesystem_session`, httpOnly + secure + sameSite=lax, 30 dias.
- Token = HMAC-SHA256(secret=`AUTH_PASSWORD`, mensagem fixa) — token único e estático (não é um JWT por sessão, é um "segredo compartilhado" simplificado: se você tem o cookie certo, está autenticado). Suficiente pro caso de uso (1 usuário, sem necessidade de revogar sessões individuais), mas **não escala pra multi-usuário** sem redesenho.
- Comparação de credenciais e de token via `timingSafeStringEqual` (comparação em tempo constante, evita timing attack).
- **Fail closed:** se `AUTH_USER`/`AUTH_PASSWORD` não estiverem configurados em produção, o middleware bloqueia a aplicação inteira com 503 em vez de deixar passar.
- Gate só roda em produção (`NODE_ENV === 'production'`) — dev local fica aberto de propósito.

**Modelo de auth (MCP / agentes externos):**
- Totalmente separado do cookie acima. `Authorization: Bearer <MCP_API_KEY>`, comparado via `timingSafeStringEqual`.
- Fail closed: sem `MCP_API_KEY` configurado, o endpoint recusa qualquer request (401), nunca abre sem querer.
- `/api/mcp` está na lista `PUBLIC_PATHS` do middleware (o cookie-gate não se aplica a ela), mas isso não significa "sem auth" — significa "auth diferente, verificada dentro da própria rota".

**Dívidas/riscos de segurança conhecidos (honestos, não resolvidos ainda):**
- Sem rate limiting em nenhuma rota (nem login, nem MCP) — um ataque de força bruta lento não é bloqueado, só mitigado pela comparação em tempo constante.
- `MCP_API_KEY` dá acesso de **CRUD completo** a tudo — não tem granularidade de escopo (ex: "só pode ler Tarefas") nem expira sozinha. Rotacionar exige trocar a env var manualmente.
- Sem logs de auditoria — não dá pra saber depois se uma alteração veio da UI ou do Hermes.
- Escrita em arquivo sem lock, como citado na seção 4.2 — tecnicamente uma janela de corrupção de dado sob concorrência.

---

## 6. Testes & QA

**O que existe hoje:**
- `npx tsc --noEmit -p .` — gate de tipo, rodado antes de todo commit desta sessão em diante.
- `npm run build` — garante que a build de produção (a que a Hostinger vai rodar) não quebra.
- Scripts Playwright **ad-hoc** (`qa-mobile.js`, `qa-flows.js`, `qa-financeiro.js`, `qa-mobile-new-features.js`, `capture-screenshots.js`) — rodados via `node qa-*.js` diretamente, não pelo test runner do Playwright. Eles navegam páginas-chave, tiram screenshots (`qa-screenshots/`) e em alguns casos fazem um fluxo de criar+limpar um registro de teste (ex: Financeiro). **Não são asserções automatizadas** — servem pra revisão visual manual, não pra CI.
- Verificação manual em navegador (via ferramentas de browser automation) a cada feature nova, com dados descartáveis, nunca tocando os dados reais do Jonny — esse foi o padrão seguido em toda a sessão de 2026-08-31 (10 itens da fila + Wizard + MCP), incluindo teste do endpoint MCP via `curl` isolado numa porta separada pra não afetar o servidor de dev do Jonny.

**O que NÃO existe (dívida técnica conhecida):**
- Nenhuma suíte de testes automatizados com asserções (unit, integration ou E2E de verdade). `@playwright/test` está instalado mas nenhum `.spec.ts` existe.
- Nenhum CI configurado (sem GitHub Actions) — a Hostinger builda no push, mas isso não é um pipeline de teste, é só um deploy automático.
- Sem teste de regressão pra API routes (ex: não há garantia automática de que `POST /api/tasks` continua aceitando o shape certo depois de uma mudança).

---

## 7. Linha do tempo (changelog técnico)

### 2026-08-31 — Fila de 10 alterações + Wizard "Planejar" + Servidor MCP
Sessão longa de evolução guiada por uma fila de pedidos do Jonny (protocolo: mandar item por item, só implementar no "VAI").
- **Fix**: bug de HTML cru aparecendo nas "Últimas Capturas" da Home.
- **UX**: reordenação da Home (Pilares/Diário-Streak pra baixo de Projetos), seção de Conteúdo do dia sempre visível na página Hoje, INBOX virou grid de sticky notes com cor/rotação por hash determinístico do id.
- **Fluxo**: Revisão Semanal saiu do menu lateral e virou botão animado dentro do INBOX que abre um modal (extraído pra componente `WeeklyReviewFlow` reaproveitado pela rota `/revisao` e pelo modal).
- **Dado real + migração**: `Project.stack` renomeado pra `Project.tags` em 6 arquivos de código + migração dos 9 projetos existentes em `data/projects.json`.
- **Modelo de dado**: cards de Pilar pararam de mostrar uma lista de ações de texto livre (não usada, 0 dados reais) e passaram a mostrar as Metas (`Indicator`) linkadas por `pillarId`; o campo `Pillar.target` (já existia) foi promovido visualmente a "Meta do Ano / BHAG", destacado acima da "Situação Atual" — sem indicadores/`Pillar.target` novos serem criados na tabela.
- **Consolidação de páginas**: `/visao` e `/pilares` viraram uma página só com abas internas; `/pilares` passou a redirecionar (client-side) pra `/visao?tab=pilares`, preservando bookmarks antigos.
- **Feature nova**: editor de rótulos de status (Tarefas, Projetos, Conteúdo) — renomeia só o texto exibido de cada coluna/status via overrides em `localStorage`, sem mexer nos union types fixos do TypeScript nem virar um CRUD de colunas.
- **Feature nova — Wizard "Planejar"** (`/planejar`): fluxo passo-a-passo (modo Dia/Semana/Mês → um passo por Pilar) que cria Tarefas/Conteúdo/Notas reais via API direto de dentro do wizard, tagueados com o pilar de origem. Desenhado deliberadamente separado da Revisão Semanal (aquela processa o que já existe; este cria pra frente).
- **Feature nova — Servidor MCP** (`/api/mcp`): integração com o Hermes Agent (ver seções 4.3 e 5). Decisão de MCP em vez de API REST simples validada com o Jonny depois de confirmar que o Hermes suporta MCP nativamente — evita manutenção manual de descrição de ferramentas do lado do agente.
- Todas as 12 entregas passaram por `tsc`/`build` limpos + verificação manual em navegador antes do commit; nenhuma tocou dados reais do Jonny além das migrações intencionais (stack→tags).

### 2026-08-30 — INBOX vira captura rápida de verdade
- Split do INBOX antigo em duas telas: uma fila de triagem rápida (INBOX) e um hub mais profundo de edição (Notas) — a distinção "captura vs. nota processada" que sustenta o fluxo da Revisão Semanal e do Wizard hoje.

### 2026-08-25 — Seis fases de maturação do produto core
Sequência de fases que transformou o app de "telas isoladas por entidade" pra um sistema conectado:
1. **Vínculos** — camada de cross-entity linking entre Tarefas/Projetos/Conteúdo/Capturas.
2. **Hoje** — visão unificada do dia (tarefas com prazo, indicadores, conteúdo agendado, diário).
3. **Revisão Semanal** — ritual guiado de 5 passos (processar INBOX, revisar Metas, tarefas atrasadas, Visão, conclusão).
4. **Tarefas recorrentes** — fecha o loop de hábito (uma tarefa concluída gera a próxima ocorrência).
5. **Calendário unificado** — Tarefas + Conteúdo + Financeiro num só calendário.
6. **Mobile bottom nav + busca global** (⌘K cobrindo todas as entidades).

### 2026-08-22 a 2026-08-24 — Fundação
- Commit inicial do app (estrutura base, todas as telas principais).
- Deploy na Hostinger ajustado (`$PORT` dinâmico).
- Primeira camada de segurança: Basic Auth → depois substituída por login de verdade com página própria (o modelo de cookie HMAC descrito na seção 5), corrigindo no processo um bug de cache que permitia bypass de auth (fix: forçar renderização dinâmica em toda a app).
- Tema claro implementado (o toggle já existia, faltava o CSS).
- Editor de texto ganhou slash commands e bubble menu estilo Notion.
- PWA: app instalável no celular.
- Rodada de polish mobile (fontes, layout do editor de captura).
- "Indicadores" renomeado pra "Metas"; indicadores de saúde adicionados.

---

## 8. Roadmap

### Confirmado e já registrado (não é lista de desejo, é o que já foi validado com o Jonny e está pendente de implementação ou é ideia explicitamente guardada pra depois)
- **Visão integrada de calendários + espelhamento com Google Agenda** (seção 4.4) — precisa de rodada de escopo própria antes de virar plano.

### Dívida técnica que deveria virar trabalho em algum momento (levantada nesta sessão, ver seções 4 e 5-6)
- Suíte de testes automatizados de verdade (mesmo que pequena — cobrir as rotas de API críticas seria o maior ganho por esforço).
- Rate limiting no login e no `/api/mcp`.
- Escopo/granularidade no `MCP_API_KEY` (hoje é tudo ou nada) e algum registro de auditoria de o que o agente alterou.
- Lock/transação na camada de storage se o volume de escrita concorrente crescer (especialmente relevante assim que o Hermes começar a escrever de verdade).

### Do README original (roadmap de produto, ainda válido)
- Página de detalhe de projeto.
- Subtarefas.
- Gráficos de indicadores.
- Migração de storage JSON pra Supabase quando o volume/necessidade justificar (dependências já instaladas, nunca ativadas).

### Filosofia de priorização até aqui
Peso maior pra: (1) o que reduz fricção no uso diário real do Jonny (mobile, captura rápida, Hoje), (2) o que fecha loops que já existiam pela metade (recorrência, vínculos, calendário unificado) antes de (3) abrir superfícies novas (Wizard, MCP). A ordem de execução dentro de cada fila também sempre foi do menor pro maior risco, validando incrementalmente.
