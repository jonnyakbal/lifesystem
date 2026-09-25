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

- **Onde:** Hostinger, hospedagem Node.js compartilhada (a mesma conta hospeda vários domínios do Jonny) — `https://lifesystem.oj0nny.com`.
- **Como:** integração nativa Hostinger↔GitHub. Push no branch `main` → build (`npm run build`, `output: standalone`) → `npm start` serve a app. Cada deploy faz um checkout novo em `~/domains/lifesystem.oj0nny.com/hbuilds/versions/<hash>/` e reaponta o symlink `current` pra lá — a versão anterior fica órfã, não é atualizada in-place.
- **Runtime:** Node.js 24 configurado em 2026-09-15 para acompanhar o requisito de engine das dependências de sanitização; o build seguinte validará essa mudança.
- **Sem infra própria** (sem Docker, sem VPS pro LIFESYSTEM em si — a VPS é onde o Hermes Agent roda, separado).
- **Sem staging.** Todo push em `main` vai direto pra produção — por isso o padrão desta sessão de sempre rodar `tsc`/`build`/teste manual *antes* de cada commit, e só dar `git push` quando o Jonny pede explicitamente.
- **Acesso SSH** existe e está ativo (`Avançado → Acesso SSH` no hPanel), mas não é usado por padrão — só foi habilitado numa sessão pontual pra diagnosticar o incidente de 2026-09-09 (ver seção 7). A chave adicionada pra isso deve ser removida quando não estiver mais em uso ativo.
- **Cuidado com o Gerenciador de Arquivos web da Hostinger:** ao abrir pela tela do site, a opção "acessar todos os arquivos da hospedagem" pode escopar pra um domínio diferente do esperado dentro da mesma conta — confirme sempre o caminho real (via SSH, se precisar de certeza) antes de assumir que uma pasta criada ali está no lugar certo.

### 4.2 Storage

- **JSON local em arquivo**, um arquivo por coleção em `data/*.json` (`tasks.json`, `projects.json`, `captures.json`, `pillars.json`, `indicators.json`, `content.json`, `financial.json`, `accounts.json`, `budgets.json`, `bills.json`, `cards.json`, `payees.json`, `journal.json`, `vision.json`, `wiki-collections.json`).
- Camada única de acesso: `src/lib/storage/index.ts` (`getAll`, `getById`, `create`, `update`, `delete`, `query`) — toda rota REST e toda ferramenta MCP passa por ela. Isso é o que tornou o servidor MCP barato de construir: zero lógica de dados duplicada.
- Escritas são serializadas por coleção dentro do processo e persistidas com arquivo temporário + rename atômico. Se o app passar a rodar em mais de um processo/instância, será necessário lock compartilhado entre processos.
- Pasta `data/` precisa de permissão de escrita no ambiente de deploy (documentado no README).
- **`LIFESYSTEM_DATA_DIR` está configurada e validada em produção desde 2026-09-09** (`/home/u115768626/domains/lifesystem.oj0nny.com/lifesystem-data`, fora da pasta que cada deploy recria do zero). Antes disso, apesar de documentada, nunca tinha valor real na Hostinger — dois incidentes de perda de dados (2026-09-05 e 2026-09-09) tiveram exatamente essa causa. Ver seção 7 pra como foi validado (deploy real de teste, não só configuração).
- Backup `npm run backup:data`: rotina diária às 03:00 cadastrada na conta Hostinger em 2026-09-15. O build também executa `prebuild` quando `LIFESYSTEM_DATA_DIR` está disponível e copia os dados persistentes para `lifesystem-backups`, fora das versões de deploy. A primeira execução do cron e do hook ainda precisa ser conferida nos logs.

### 4.3 Integração de IA — servidor MCP, Copiloto embutido e provedores

**MCP (agentes externos, ex: Hermes):**
- `/api/mcp` expõe CRUD completo (Model Context Protocol) sobre Tarefas, Conteúdo, INBOX/Notas, Pilares (leitura+update), Metas, Projetos, Editais e as entradas deste próprio Diário de Bordo — geradas por uma factory (`registerCrudTools` em `src/lib/mcp/tools.ts`) pra não repetir o mesmo código por entidade.
- Transporte: `WebStandardStreamableHTTPServerTransport` do SDK oficial, modo stateless (uma instância de servidor MCP por request — sem estado de sessão entre chamadas).
- Consumidor alvo: **Hermes Agent** (open source, Nous Research), instância pessoal do Jonny rodando na própria VPS, conectando por Telegram — configuração ainda pendente do lado do Hermes (ver Roadmap).
- Toda chamada de ferramenta é registrada (`src/lib/mcp/log.ts`, `data/mcp-logs.json`, cap de 200 entradas) e fica visível na tela `/hermes`, junto com status de configuração de `MCP_API_KEY` e um testador de prompt direto contra a API de inferência configurada.

**Copiloto embutido (chat dentro do próprio app, ⌘M):**
- `src/lib/copiloto/tools.ts` gera ferramentas de tool-calling (formato OpenAI) sobre os mesmos dados que o MCP expõe — chama `storage` direto, sem passar pelo transporte MCP. É uma segunda porta pra mesma casa, não um sistema paralelo.
- `POST /api/copiloto` — loop de agente stateless: cliente ecoa o histórico bruto a cada turno. Ferramentas de leitura executam e o loop continua (encadeia lookups, ex: resolver "aquela tarefa do TCC" via `list_tasks` antes de agir); ferramentas de escrita sempre pausam pra um card de confirmação explícito antes de tocar em dado.
- Painel flutuante (`src/components/layout/copiloto-panel.tsx`), montado globalmente junto do Command Palette.

**Provedores de IA (`src/lib/ai.ts`) — usado pelos Editais e pelo Copiloto:**
- Lista de provedores nomeados e configuráveis por env var (`AI_GROQ_API_KEY`/`AI_OPENROUTER_API_KEY`/`AI_MISTRAL_API_KEY`, mais um modo legado via `AI_API_KEY`/`AI_BASE_URL`), cada um com sua própria cadeia de modelos de fallback — necessário porque **provedores e modelos gratuitos mudam de regra e de catálogo sem aviso** (ver linha do tempo, 2026-09-09, pra dois exemplos reais aconteceram na mesma sessão).
- `askAI`/`askAIForJson` — prompt único, resposta em texto/JSON. `chatCompletion` — multi-turno com tool-calling, base do Copiloto.

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
- O rate limiting de login e MCP é local à instância e reinicia com o processo; usar várias instâncias pede armazenamento compartilhado.
- `MCP_API_KEY` continua com acesso amplo para manter o Hermes funcionando. `MCP_API_KEYS` agora aceita chaves separadas com escopos de leitura/escrita por domínio; migrar o Hermes para uma chave nova e restrita exige atualizar o segredo no próprio Hermes.

---

## 6. Testes & QA

**O que existe hoje:**
- `npx tsc --noEmit -p .` — gate de tipo, rodado antes de todo commit desta sessão em diante.
- `npm run build` — garante que a build de produção (a que a Hostinger vai rodar) não quebra.
- `npm test` — suíte Playwright com testes de API, MCP, planejamento, calendário, segurança e auditoria visual desktop/mobile (89 aprovados na verificação de 2026-09-25).
- GitHub Actions (`.github/workflows/ci.yml`) roda TypeScript, build e Playwright em push/PR para `main`. Esse workflow é CI, não deploy.
- **Deploy:** integração nativa Hostinger↔GitHub; push em `main` dispara build e publicação. Um `401` do conector Hostinger no Codex bloqueia apenas a leitura do hPanel, não prova falha de deploy. Verifique o site público e os assets servidos; para consultar logs/variáveis da conta, reautorize o conector. Não trocar o fluxo normal por SSH.
- Scripts Playwright **ad-hoc** (`qa-mobile.js`, `qa-flows.js`, `qa-financeiro.js`, `qa-mobile-new-features.js`, `capture-screenshots.js`) — rodados via `node qa-*.js` diretamente, não pelo test runner do Playwright. Eles navegam páginas-chave, tiram screenshots (`qa-screenshots/`) e em alguns casos fazem um fluxo de criar+limpar um registro de teste (ex: Financeiro). **Não são asserções automatizadas** — servem pra revisão visual manual, não pra CI.
- Verificação manual em navegador (via ferramentas de browser automation) a cada feature nova, com dados descartáveis, nunca tocando os dados reais do Jonny — esse foi o padrão seguido em toda a sessão de 2026-08-31 (10 itens da fila + Wizard + MCP), incluindo teste do endpoint MCP via `curl` isolado numa porta separada pra não afetar o servidor de dev do Jonny.

**Dívidas de teste conhecidas:**
- Ainda falta um teste automatizado do fluxo de conversão de captura ponta a ponta; a cobertura atual testa CRUD, não todos os destinos de conversão.
- Ainda falta um teste automatizado de regressão visual para contraste/legibilidade ao alternar tema.
- A suíte passou localmente em 2026-09-25, mas o workflow do commit `8a40e02` terminou com falha na etapa Playwright. O log detalhado não estava acessível durante a revisão; identificar o teste específico continua pendente.

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

### 2026-09-04 — Revisão geral de qualidade e correções de integridade

- **Segurança:** previews Markdown e conteúdo HTML do Tiptap passaram a ser sanitizados com allowlist antes de `dangerouslySetInnerHTML`; protocolos e atributos executáveis são removidos.
- **Diário/Pilares:** o Diário passou a carregar os pilares reais e a API normaliza registros históricos que usavam as chaves numéricas `1`–`6`; humor passou a ser persistido.
- **Datas:** datas sem horário passaram a ser formatadas pelo calendário local, evitando deslocamentos causados por UTC em tarefas, diário, finanças e dashboard.
- **Recorrência:** tarefas mensais agora limitam o dia ao último dia do mês destino, evitando que 31 de janeiro salte para março.
- **Preferências:** sidebar e configurações passaram a compartilhar a chave `lifesystem-theme`.
- **Testes:** adicionados testes de regressão para datas locais, recorrência mensal e sanitização HTML.
- **Persistência:** camada JSON passou a aceitar `LIFESYSTEM_DATA_DIR`, serializar escritas por coleção, gravar via arquivo temporário/rename atômico e executar batches em uma única leitura/gravação.
- **Financeiro:** `spent` de orçamento passou a ser derivado das transações do mês e recorrência legada é normalizada na leitura.
- **Segurança operacional:** upload agora reprocessa imagens com Sharp, limita dimensões/tamanho e login recebeu bloqueio temporário por excesso de tentativas; middleware valida Origin em requisições mutáveis.
- **Pendências encontradas na revisão:** configurar `LIFESYSTEM_DATA_DIR` persistente na Hostinger, adicionar escopos MCP, concluir schemas nas demais APIs, corrigir lint acumulado e validar a recuperação dos dados organizados.

### 2026-09-05 — Incidente de dados e proteção do ciclo de deploy

- **Incidente:** a organização de tarefas e projetos feita na instância online foi perdida depois de um deploy. O repositório versionava `data/*.json`; o checkout local continha dados-base antigos e podia sobrescrever os dados runtime da produção.
- **Causa provável:** dados de produção e código compartilhavam o mesmo diretório de deploy. A camada JSON também fazia operações concorrentes de leitura-modificação-gravação, permitindo que a última requisição sobrescrevesse mudanças anteriores.
- **Decisão estrutural:** `data/*.json` deixa de ser considerado banco de produção. A produção deve usar `LIFESYSTEM_DATA_DIR` fora do checkout e `LIFESYSTEM_UPLOAD_DIR` fora da release. O diretório versionado fica apenas como seed/desenvolvimento até a migração operacional ser concluída.
- **Proteções implementadas:** lock por coleção, escrita temporária com rename atômico, operações batch em uma única gravação, tratamento explícito de JSON corrompido, normalização do Diário/Pilares, validação Zod de APIs críticas e backup via `npm run backup:data`.
- **Segurança implementada:** sanitização HTML/Markdown, reprocessamento de uploads com Sharp, limite de tamanho/dimensões, bloqueio temporário de tentativas de login e verificação de Origin em requisições mutáveis.
- **Regra operacional:** nenhum novo deploy deve ser feito antes de copiar os dados atuais da Hostinger para o diretório persistente, configurar as variáveis de ambiente e validar contagem de tarefas/projetos após o deploy.
- **Recuperação pendente:** procurar o backup/snapshot da Hostinger anterior ao incidente. O workspace local contém apenas os dados-base versionados, não a organização perdida.

### 2026-09-06 — Central de Fontes de Conteúdos (Content Hub)

- **Feature:** sistema completo de centralização de fontes externas (RSS/Atom, sites, YouTube, newsletters) com leitura, parsing, clipping para o INBOX e análise por IA.
- **Dados:** `ContentSource` (fonte) e `ContentItem` (item lido), armazenados em `content-sources.json` e `content-items.json` com atomic writes e locks.
- **APIs:** CRUD completo para fontes e itens, refresh de fonte (fetch + parse RSS/Atom/HTML), clip para INBOX (cria Capture), análise IA (summarize + classify).
- **MCP:** `create_content_source`, `list_content_sources`, `update_content_source`, `create_content_item`, `list_content_items`, `update_content_item` — Hermes pode gerenciar fontes e itens via conversa.
- **Parsing:** parser RSS/Atom robusto (namespaces dc:creator, content:encoded, atom:published), parsing de HTML para sites genéricos, sanitização de HTML, extração de imagens e tags.
- **UI:** página `/content-hub` com cards de fontes (status, contagem, último fetch), lista de itens com filtros (fonte, status, busca), reader dialog com conteúdo completo, clipping para INBOX, status visual (unread/reading/read/archived).
- **Sidebar:** entrada "Fontes" na seção "Capturar" com badge de itens não lidos.
- **Validação:** schemas Zod para `ContentSource` e `ContentItem`, validação de URL, limites de tamanho.
- **Próximos passos:** auto-refresh periódico (cron ou on-login), categorização automática por IA, integração com o planejador semanal, exportação OPML.
- **⚠️ Resolvido só em 2026-09-09, não neste dia.** A "decisão estrutural" acima foi registrada mas `LIFESYSTEM_DATA_DIR` nunca chegou a ser configurada de fato na Hostinger — ficou só como variável documentada no README, sem valor definido em produção. Resultado: o mesmíssimo incidente se repetiu quatro dias depois, dessa vez apagando um planejamento real feito pelo Jonny direto em produção. Ver a entrada de 2026-09-09 para a correção validada de ponta a ponta (com deploy real de teste).

### 2026-09-09 — Editais com IA, Copiloto embutido, e o incidente de dados resolvido de vez

Sessão longa com três frentes: automação de IA nos Editais Culturais, um agente de chat embutido no próprio app, e a resolução definitiva (com prova real) do incidente de persistência aberto desde 2026-09-05.

**Busca e análise de editais com IA:**
- `POST /api/editais/analisar` — recebe um link ou texto colado, busca a página (com guarda contra SSRF — recusa URLs de rede interna — e contra arquivos não-texto/PDF grandes), e pede pra IA extrair título/órgão/valor/prazo, dar uma nota de aderência ao perfil do Jonny (cruzando com Pilares e Projetos reais) e sugerir os documentos a reunir.
- `POST /api/editais/descobrir` — varre as fontes cadastradas no cockpit de configurações (`edital-settings`), uma por requisição (um provedor gratuito de IA pode levar ~1min por chamada, então paralelizar ou empacotar tudo numa request estourava timeout de proxy), deduplica contra o que já está no Radar e descarta abaixo da nota mínima configurada.
- Fontes de editais **não têm API estruturada e gratuita viável**: o Mapas Culturais do MinC está atrás de Cloudflare; a maioria dos sites de cultura renderiza a listagem no cliente (SPA), então o HTML puro chega vazio não importa a qualidade do prompt. A lista de fontes ficou como configuração curável no cockpit, não hardcoded — cada fonte precisa ser validada manualmente como "realmente lista editais abertos em HTML puro" antes de entrar na lista.

**`src/lib/ai.ts` — camada de IA multi-provedor:**
- Motivo de existir: **provedores de IA gratuitos mudam de regra sem aviso.** O primeiro provedor usado (OpenCode Zen) respondia bem em 2026-09-06 e em 2026-09-07 passou a recusar toda chamada externa com "OpenCode's free tier can only be used in OpenCode" — o free tier virou exclusivo do próprio cliente deles.
- Arquitetura atual: lista de provedores nomeados (`groq`, `openrouter`, `mistral`), cada um com sua própria chave (`AI_GROQ_API_KEY` etc.) e sua própria cadeia de modelos de fallback: se um 429, tenta o próximo modelo do mesmo provedor antes de passar pro próximo provedor. `AI_PROVIDER_ORDER` permite reordenar sem mexer em código.
- IDs de modelo de free tier **também mudam de uma hora pra outra** — `llama-3.3-70b-versatile` (Groq) e `llama-3.3-70b-instruct:free` (OpenRouter), hardcoded numa manhã, já não existiam mais horas depois. A lista de modelos de cada provedor é override­ável por env var (`AI_GROQ_MODELS` etc.) exatamente por causa disso.
- Achado técnico: modelos de raciocínio (`openai/gpt-oss-120b` no Groq, por exemplo) gastam parte do `max_tokens` "pensando" num campo `reasoning` antes do `content` — com orçamento de token apertado, a resposta chega vazia mesmo com HTTP 200. A extração de JSON (`askAIForJson`) cai pro próximo modelo/provedor quando isso acontece, em vez de tratar como erro definitivo.
- `chatCompletion()` foi adicionado depois, em paralelo ao `askAI`/`askAIForJson` existentes (que continuam servindo os Editais), pra suportar tool-calling de verdade — é a base do Copiloto abaixo.

**Copiloto embutido (`/api/copiloto` + painel flutuante, ⌘M):**
- Um agente de chat dentro do próprio LIFESYSTEM, complementar ao MCP (que serve o Hermes remotamente) — mesma camada de dados (`storage`), duas portas diferentes. Ferramentas de leitura (list_*) executam na hora e o loop continua, encadeando lookups; ferramentas de escrita (create_/update_/delete_) sempre param o loop e voltam pro usuário como um card de confirmação — só executam de verdade numa segunda chamada explícita.
- Servidor é stateless: o cliente guarda e ecoa o histórico bruto (formato OpenAI) a cada turno.
- Revisão com múltiplos agentes encontrou e corrigiu, antes de ir pro ar: (1) um turno com mais de uma `tool_call` simultânea podia deixar uma delas sem resposta depois que a escrita pausava pra confirmação — quebra a conversa na chamada seguinte pra qualquer provedor compatível com OpenAI, corrigido resolvendo/adiando toda `tool_call` do turno antes de retornar; (2) uma confirmação reenviada por falha de rede podia **executar a escrita duas vezes** — corrigido com uma trava de `tool_call_id` já executado, independente do histórico que o cliente manda de volta; (3) campos obrigatórios de criação/atualização passaram a ser validados antes do card de confirmação aparecer, em vez de deixar o usuário confirmar uma ação que só podia falhar.

**O incidente de dados de 2026-09-05, resolvido de vez:**
- Pediu pra testar se as mudanças de tarefas feitas direto em produção sobreviviam a um deploy. Testei — e não sobreviveram: um `git push` trivial resetou tarefas/projetos/editais pro snapshot committado no repo, apagando um planejamento real que o Jonny tinha acabado de fazer no site. Backup automático da Hostinger é diário (00h) e não cobria o período entre o planejamento e o teste — essa parte específica não teve como recuperar.
- Causa raiz confirmada: `LIFESYSTEM_DATA_DIR` nunca tinha sido configurada com valor real na Hostinger (apesar de documentada desde a entrada de 2026-09-05) — a app usava `cwd()/data`, dentro da própria pasta de deploy (`hbuilds/versions/<hash>/`, um checkout novo do zero a cada deploy via symlink `current`).
- Corrigido com acesso SSH real ao servidor (chave adicionada pelo Jonny, removível depois de uso): `LIFESYSTEM_DATA_DIR=/home/u115768626/domains/lifesystem.oj0nny.com/lifesystem-data` (fora de `hbuilds/`, dentro da pasta do domínio — não confundir com o gerenciador de arquivos web da Hostinger, que por padrão abre escopado num domínio diferente da conta e quase levou a copiar os dados pro lugar errado).
- **Validado com deploy real, não só em teoria:** criada uma tarefa de teste, disparado `git push` de verdade, nova versão publicada (`hbuilds/current` reapontado), tarefa de teste conferida presente via API depois do deploy, depois removida.
- Também corrigido no caminho: o middleware (`src/middleware.ts`) rejeitava **toda escrita** em produção com "Origem não permitida" — `request.nextUrl.origin` é montado a partir do Host que o Next.js enxerga direto, que atrás do proxy reverso da Hostinger não bate com o `Origin` real enviado pelo navegador. Passou a aceitar via `X-Forwarded-Host`/`-Proto` (padrão pra esse cenário), com um segundo fallback por hostname puro.
- O backup diário às 03:00 está cadastrado e o hook `prebuild` tenta criar uma cópia antes do build quando `LIFESYSTEM_DATA_DIR` está disponível. Conferir logs após a primeira execução de cada rotina.

## 8. Roadmap

### Confirmado e já registrado (não é lista de desejo, é o que já foi validado com o Jonny e está pendente de implementação ou é ideia explicitamente guardada pra depois)
- **Visão integrada de calendários + espelhamento com Google Agenda** (seção 4.4) — precisa de rodada de escopo própria antes de virar plano. Último item pendente da rodada de 2026-08-31.
- **Abrir o LIFESYSTEM como open source** (seção 4.5) — decisões de licença/repo já tomadas, execução fica pra quando o Jonny pedir.

### Dívida técnica que deveria virar trabalho em algum momento (levantada nesta sessão, ver seções 4 e 5-6)
- ~~Rate limiting de login e MCP~~ — feito nesta rodada; armazenamento em memória por instância é suficiente enquanto a aplicação permanecer single-process.
- ~~Escopos por chave MCP~~ — suporte a `MCP_API_KEYS` implementado; Hermes legado ainda usa `MCP_API_KEY` amplo até a rotação coordenada no cliente.
- Lock entre processos na camada de storage se o app passar a rodar com múltiplas instâncias; hoje há fila por coleção e rename atômico dentro de um processo.
- Conferir nos logs a primeira execução do backup diário e do hook pré-build.
- Rotacionar as chaves de IA (`AI_GROQ_API_KEY`/`AI_OPENROUTER_API_KEY`/`AI_MISTRAL_API_KEY`) que passaram por texto em conversa durante a configuração de 2026-09-09 — baixo risco mas por precaução.
- Remover a chave SSH adicionada pra diagnosticar o incidente de 2026-09-09, se não estiver mais em uso ativo.

### Do README original (roadmap de produto, ainda válido)
- Página de detalhe de projeto.
- Subtarefas.
- Gráficos de indicadores.
- Migração de storage JSON pra Supabase quando o volume/necessidade justificar (dependências já instaladas, nunca ativadas).

### Filosofia de priorização até aqui
Peso maior pra: (1) o que reduz fricção no uso diário real do Jonny (mobile, captura rápida, Hoje), (2) o que fecha loops que já existiam pela metade (recorrência, vínculos, calendário unificado) antes de (3) abrir superfícies novas (Wizard, MCP). A ordem de execução dentro de cada fila também sempre foi do menor pro maior risco, validando incrementalmente.
