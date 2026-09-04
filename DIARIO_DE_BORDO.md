# Diário de Bordo — LIFESYSTEM

> **Este diário agora também vive dentro do app**, em `/diario-bordo` — uma timeline editável (categoria, data, texto rico), com as 4 entradas da seção 7 abaixo como registro inicial. O Hermes Agent também pode escrever entradas ali via MCP (`create_log_entry`). Novas entradas de evolução do dia a dia devem ser adicionadas por lá; este arquivo continua como a referência técnica mais completa (stack, infra, segurança, roadmap) — as duas seções abaixo (stack e infra) não são duplicadas na UI.

Registro técnico e de produto do LIFESYSTEM: stack, infraestrutura, segurança, testes, linha do tempo de evolução e roadmap.

**Autor:** Jonny Akbal — ARCOLABS

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

## 1.1 Manifesto — Por que o LIFESYSTEM existe

### O problema que resolvemos

A vida moderna fragmenta a atenção. Calendários, tarefas, finanças, hábitos, anotações, projetos — tudo vive em apps diferentes, com interfaces diferentes, lógicas diferentes. O cérebro humano não foi projetado pra gerenciar 12 abstrações simultâneas. O custo cognitivo de simplesmente *lembrar* de tudo que precisa ser feito já consome energia que deveria estar sendo usada pra *fazer*.

Existem soluções. Notion, Todoist, Habitica, YNAB, Google Calendar, Apple Reminders. Cada um resolve uma fatia. Mas a fragmentação persiste — e piora: quanto mais apps, mais fricção pra capturar uma ideia, mais chance de algo cair no esquecimento, mais tempo gasto alternando contexto entre ferramentas.

### O que o LIFESYSTEM propõe

Um único lugar. Não um "hub" que consulta outros apps, mas o sistema de registro. A fonte única de verdade pra tudo que importa: o que você quer ser (Visão), onde você está indo (Pilares), o que precisa ser feito hoje (Tarefas), o que você está aprendendo (Notas), o que você tem (Financeiro), e o que você está sentindo (Diário).

A premissa é simples: **se não está no LIFESYSTEM, não existe.**

### Os princípios

**1. Captura é sagrada.**
A distância entre pensar algo e registrá-lo deve ser zero. O INBOX existe pra isso — um botão, uma nota, acabou. Não formulário, não categoria, não.decisão. Classificar vem depois, na Revisão Semanal. Primeiro você captura. Sempre.

**2. Processamento é ritual, não automação.**
A tentação é deixar a IA classificar, priorizar, organizar. Mas a revisão deliberada — olhar pra cada item, decidir o que importa, descartar o que não importa — é o ato que mantém o sistema vivo. O LIFESYSTEM não decide por você. Ele te dá os dados pra você decidir melhor.

**3. Os Pilares são a bússola.**
Tarefa sem pilar é ruído. Meta sem pilar é métrica vazia. Conteúdo sem pilar é mais um post no feed. Tudo se conecta a um dos seis eixos da vida — e é essa conexão que transforma "coisas pra fazer" em "vida sendo vivida de propósito".

**4. Simplicidade é Features.**
JSON files em vez de Postgres. Cookie HMAC em vez de NextAuth. Um usuário em vez de multi-tenant. Cada decisão técnica que reduz complexidade é uma decisão que mantém o sistema funcionando, maintenido, e acessível. O LIFESYSTEM não precisa escalar pra milhão de usuários. Precisa escalar pra uma vida inteira de uso.

**5. Mobile-first não é responsivo.**
Não é "funciona no celular". É "é melhor no celular". Bottom nav, captura por toque, gestos, fontes legíveis em tela pequena. A maioria das interações acontece entre uma reunião e outra, no transporte, antes de dormir. O celular é o contexto primário.

**6. IA como ferramenta, não como dono.**
O Hermes pode escrever no Diário de Bordo, criar tarefas, consultar indicadores. Mas ele é um assistente — não um curador. As decisões de produto são do humano. A IA executa, registra, lembra. Não decide o que é importante.

**7. Transparência total.**
O código é aberto. Os dados são seus. Não há telemetria, não há analytics, não há "nós melhoramos o serviço usando seus dados". O LIFESYSTEM é uma ferramenta, não um serviço. Você o mantém, você o controla, você o conhece.

### A filosofia de desenvolvimento

**Iterativo e incremental.** Não existem sprints de 2 semanas. Existem pedidos do Jonny, implementação, validação, commit. Cada mudança é testada antes de ir pra produção. Cada feature é construída em cima do que já existe, não substituindo.

**Documentação como memória.** Este diário não é burocracia. É a memória do projeto. Cada decisão técnica, cada trade-off, cada bug encontrado e corrigido — registrado pra que o próximo desenvolvedor (seja o Jonny daqui a 6 meses, seja um contribuidor externo) entenda o *porquê*, não só o *o quê*.

**Qualidade como hábito.** `tsc --noEmit` antes de todo commit. Build limpa antes de push. Verificação manual em navegador. Não é CI/CD sofisticado — é disciplina manual que funciona pra um projeto solo. Quando o projeto crescer, a infraestrutura de teste cresce junto.

### O que o LIFESYSTEM não é

- Não é um productividade porn (ferramenta bonita que você mostra mas não usa).
- Não é um SaaS disfarçado de open source.
- Não é um framework genérico de life management.
- Não é um projeto acadêmico (embora o TCC use ele).

É uma ferramenta pessoal que acontece de ser útil pra outras pessoas. Se alguém mais usar, ótimo. Se ninguém usar, continua funcionando pro Jonny.

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

- `/api/mcp` expõe CRUD completo (Model Context Protocol) sobre Tarefas, Conteúdo, INBOX/Notas, Pilares (leitura+update), Metas, Projetos e as entradas deste próprio Diário de Bordo — 26 ferramentas ao todo, geradas por uma factory (`registerCrudTools` em `src/lib/mcp/tools.ts`) pra não repetir o mesmo código 7 vezes.
- Transporte: `WebStandardStreamableHTTPServerTransport` do SDK oficial, modo stateless (uma instância de servidor MCP por request — sem estado de sessão entre chamadas).
- Consumidor alvo: **Hermes Agent** (open source, Nous Research), instância pessoal do Jonny rodando na própria VPS, conectando por Telegram — o LIFESYSTEM vira uma "ferramenta" que o Hermes descobre e usa sozinho, sem glue code manual.
- Testado ponta a ponta manualmente via `curl` antes do commit: handshake, listagem das 22 tools (depois 26, ver 2026-08-31 mais abaixo), `create_task` → confirmado gravado em `data/tasks.json` → `list_tasks` com filtro → `delete_task` → confirmado removido.
- Toda chamada de ferramenta é registrada (`src/lib/mcp/log.ts`, `data/mcp-logs.json`, cap de 200 entradas) e fica visível na tela `/hermes`, junto com status de configuração de `MCP_API_KEY`/`NOUS_API_KEY` e um testador de prompt direto contra a API de inferência da Nous.

### 4.4 Ideia futura registrada — visão integrada de calendários (Google Agenda)

Jonny quer uma visão que unifique todos os "calendários" internos do LIFESYSTEM (prazos de Tarefa, `scheduledDate` de Conteúdo, vencimentos Financeiros — já existe um calendário unificado interno, ver Fase 5 na linha do tempo) e que **espelhe/conecte com o Google Agenda** de verdade (não só visualmente parecido — sincronizar ou pelo menos importar/exportar eventos reais). Referências citadas: Notion Calendar e ClickUp já resolvem esse tipo de espelhamento bem. Ainda não tem escopo definido — precisa de uma rodada própria de perguntas antes de virar plano (via API do Google Calendar com OAuth? sincronização de mão única ou nas duas direções? o Hermes participa disso também, já que ele processa linguagem natural?). Registrado aqui e no arquivo de plano ativo pra não perder — é o último item pendente da rodada de feedback de 2026-08-31.

### 4.5 Ideia futura registrada — abrir o LIFESYSTEM como open source

Decisões já validadas, execução fica pra depois: repositório privado atual continua rodando em produção por ora; a ideia é migrar aos poucos pra um repo público separado, tirando o contexto pessoal (Dona Maria, TCC, finanças) — que fica só no `data/*.json` privado — e deixando a base do sistema disponível pra outras pessoas configurarem do jeito delas. Licença cogitada: fonte-disponível com cláusula comercial (tipo BSL), pra manter viável futuramente vender uma versão autohospedada de um clique por um valor anual baixo. Objetivo declarado: virar base de conteúdo + consolidar autoridade + abrir porta pra consultoria. Ver detalhes completos no arquivo de plano ativo.

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

### 2026-08-31 (continuação) — Diário de Bordo vivo, fix no modal de Tarefa, reorganização de menu, tela Hermes
- **Feature nova — Diário de Bordo vivo** (`/diario-bordo`): esse próprio documento ganhou uma versão dentro do app — timeline editável (categoria, data, texto rico via `NotionEditor`), com as 4 entradas históricas da seção 7 como registro inicial. Exposto também via MCP (`list_log_entries`/`create_log_entry`/`update_log_entry`/`delete_log_entry`), então o Hermes pode registrar entradas por conversa.
- **Fix**: modal de "Editar Tarefa" estourava o viewport em tarefas com muito conteúdo (checklist, tags, vínculos) e escondia os botões Salvar/Cancelar/Excluir — agora o header e o footer ficam fixos e só o corpo rola.
- **Remoção real (não cosmética)**: campo `Task.assignee`/"Responsável" removido de ponta a ponta (tipo, API, filtros, agrupamento, badge do kanban) — sistema é de uso pessoal, o campo nunca fez sentido.
- **UX**: seção "Vínculos" no modal de Tarefa só aparece quando a tarefa tem de fato algo vinculado, com uma linha explicando o que é (antes aparecia sempre, vazia e sem contexto).
- **Arquitetura de informação**: menu lateral (13 itens numa lista só) reorganizado em 4 seções com cabeçalho — Capturar (Inbox, Notas), Planejar (Hoje, Planejar, Visão), Executar (Projetos, Tarefas, Conteúdo, Metas), Sistema (Financeiro, Diário, Diário de Bordo, Hermes).
- **Feature nova — tela Hermes** (`/hermes`, seções 4.3 e 8): status de configuração de `MCP_API_KEY`/`NOUS_API_KEY`, log das últimas chamadas MCP (nova infraestrutura de auditoria, `src/lib/mcp/log.ts`), e um testador de prompt direto contra a API de inferência da Nous Research (modelos Hermes-4.3-36B/4-70B/4-405B).
- Registradas duas iniciativas grandes pra depois (não implementadas ainda): calendário integrado espelhando Google Agenda (seção 4.4, com Notion Calendar/ClickUp como referência) e abrir o LIFESYSTEM como open source com licença fonte-disponível tipo BSL (seção 4.5).

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
- **Visão integrada de calendários + espelhamento com Google Agenda** (seção 4.4) — precisa de rodada de escopo própria antes de virar plano. Último item pendente da rodada de 2026-08-31.
- **Abrir o LIFESYSTEM como open source** (seção 4.5) — decisões de licença/repo já tomadas, execução fica pra quando o Jonny pedir.

### Dívida técnica que deveria virar trabalho em algum momento (levantada nesta sessão, ver seções 4 e 5-6)
- Suíte de testes automatizados de verdade (mesmo que pequena — cobrir as rotas de API críticas seria o maior ganho por esforço).
- Rate limiting no login e no `/api/mcp`.
- ~~Registro de auditoria de o que o agente alterou~~ — feito em 2026-08-31 (`/hermes`, log das últimas chamadas MCP). Ainda falta granularidade de escopo no `MCP_API_KEY` em si (hoje é tudo ou nada).
- Lock/transação na camada de storage se o volume de escrita concorrente crescer (especialmente relevante assim que o Hermes começar a escrever de verdade).

### Do README original (roadmap de produto, ainda válido)
- Página de detalhe de projeto.
- Subtarefas.
- Gráficos de indicadores.
- Migração de storage JSON pra Supabase quando o volume/necessidade justificar (dependências já instaladas, nunca ativadas).

### Filosofia de priorização até aqui
Peso maior pra: (1) o que reduz fricção no uso diário real do Jonny (mobile, captura rápida, Hoje), (2) o que fecha loops que já existiam pela metade (recorrência, vínculos, calendário unificado) antes de (3) abrir superfícies novas (Wizard, MCP). A ordem de execução dentro de cada fila também sempre foi do menor pro maior risco, validando incrementalmente.
