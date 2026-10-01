# LIFESYSTEM

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/jonnyakbal/lifesystem/actions/workflows/ci.yml/badge.svg)](https://github.com/jonnyakbal/lifesystem/actions/workflows/ci.yml)

Sistema open source e auto-hospedado para organizar tarefas, projetos, conteúdo, finanças pessoais e calendário integrado.

**ARCOLABS** — Uma base modular para reduzir a carga cognitiva de gerir a vida num só lugar. Cada instalação é isolada; marca e módulos podem ser personalizados.

## O que é o LIFESYSTEM

O LIFESYSTEM é um espaço de planejamento e execução que pode ser adaptado para cada instalação. A configuração atual é single-user; o projeto não afirma oferecer multi-tenancy.

**Princípios que guiaram as decisões de produto:**
- **Captura rápida, processamento deliberado.** O INBOX existe pra tirar qualquer ideia da cabeça em segundos; a Revisão Semanal e o Wizard "Planejar" são os momentos deliberados de decidir o que aquilo vira.
- **Pilares como eixo central.** A instalação vem com seis pilares de exemplo, que podem ser personalizados.
- **BHAG em cima, indicadores operacionais embaixo.** Cada pilar tem uma meta grande de ano e metas menores/recorrentes.
- **Privacidade por instalação.** Os dados ficam no ambiente auto-hospedado e não são compartilhados entre instalações.
- **Mobile-first na prática, não só em CSS.** PWA instalável, bottom nav, ajuste de fontes.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript** (strict mode)
- **React 19**
- **Tailwind CSS v4**
- **Tiptap 3** (editor Notion-style)
- **Motion** (Framer Motion)
- **Radix UI** (primitivos de acessibilidade)
- **JSON File Storage** (local no servidor — migração fácil pra Postgres/Supabase depois)
- **MCP Server** (integração com AI agents)

## Features

### Áreas do aplicativo

- **Home** — Dashboard unificado com confetti quando completa tasks do dia
- **INBOX** — Captura rápida estilo sticky notes com cores determinísticas
- **Notas** — Hub de conhecimento com editor Notion-style completo
- **Hoje** — Visão diária unificada (tarefas, indicadores, conteúdo agendado)
- **Planejar** — Semana integrada, tarefas sem data e ritual opcional por pilar
- **Visão** — Visão + Pilares com constelação SVG animada
- **Projetos** — Kanban board com tags e cover images
- **Tarefas** — Kanban completo (1683 linhas!) com prioridades e recorrência
- **Conteúdo** — Gestão de conteúdo (blog/YouTube/Instagram/TikTok)
- **Indicadores** — Tracking de metas por pilar com 5 tipos
- **Financeiro** — Controle financeiro completo (contas, cartões, orçamentos), com meses navegáveis e previsão separada de pagamentos ([regras de período](docs/financeiro-periodos.md))
- **Diário** — Journal pessoal com check-ins por pilar
- **Diário de Bordo** — Log técnico (templo vivo, editável via MCP)
- **Revisão** — Revisão semanal 5 passos (GTD)
- **Hermes** — Gestão de integração AI (MCP + prompt tester)

### Infraestrutura

- **MCP Server** — ferramentas por escopo para agentes externos (Hermes Agent via Telegram)
- **PWA** — Instalável no celular com service worker
- **Auth** — Cookie HMAC-SHA256 (fail closed)
- **Command Palette** — Busca global (Cmd+K)
- **Dark/Light Theme** — Tema cósmico/roxo

## Rodando local

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`

Uma instalação nova começa sem registros pessoais. Execute `npm run seed:demo` uma vez para criar seis pilares de exemplo; o comando preserva um `pillars.json` existente. Arquivos `data/*.json` são privados e não devem ser enviados ao Git. Antes de publicar uma versão open source, revise também o histórico do repositório, pois remover arquivos do índice atual não remove versões já publicadas.

## Estrutura

```
src/
├── app/
│   ├── api/                 # 23 REST API route groups + MCP server
│   ├── (dashboard)/         # áreas autenticadas
│   ├── login/
│   └── layout.tsx
├── components/
│   ├── layout/              # sidebar, command-palette, settings
│   ├── ui/                  # 18 primitivos (button, card, dialog, etc.)
│   └── *.tsx                # componentes de fluxo (500+ linhas cada)
├── lib/
│   ├── storage/             # camada de dados única (JSON files)
│   ├── mcp/                 # servidor + ferramentas MCP com escopos e auditoria
│   ├── auth.ts              # HMAC session token
│   └── api.ts               # wrapper de fetch pro frontend
├── types/index.ts           # tipos de domínio (359 linhas)
└── middleware.ts            # gate de auth cookie-based
data/                        # dados locais privados; somente README versionado
```

## API Routes

| Endpoint | Método | Descrição |
|---|---|---|
| `/api/tasks` | GET/POST | Listar/criar tarefas (suporta batch) |
| `/api/tasks/[id]` | PATCH/DELETE | Atualizar/deletar tarefa |
| `/api/captures` | GET/POST | Listar/criar capturas (INBOX) |
| `/api/captures/[id]` | PATCH/DELETE | Atualizar/deletar captura |
| `/api/projects` | GET/POST | Listar/criar projetos |
| `/api/projects/[id]` | PATCH/DELETE | Atualizar/deletar projeto |
| `/api/pillars` | GET/POST | Listar/criar pilares |
| `/api/indicators` | GET/POST | Listar/criar indicadores/metas |
| `/api/content` | GET/POST | Listar/criar conteúdo |
| `/api/financial` | GET/POST | Dados financeiros |
| `/api/journal` | GET/POST | Entradas do diário |
| `/api/mcp` | GET/POST/DELETE | Servidor MCP Streamable HTTP |

## Deploy (Hostinger Node.js)

1. Conecte o repositório à integração nativa do GitHub na Hostinger e configure `npm run build` como comando de build.
2. Faça push para a branch `main`. A Hostinger detecta o push, cria uma nova versão e publica a aplicação.
3. O workflow `.github/workflows/ci.yml` também roda TypeScript, build e Playwright como validação; ele não é responsável pelo deploy.
4. Configure `LIFESYSTEM_DATA_DIR` para uma pasta persistente com permissão de escrita, fora do checkout.

Um `401` do conector Hostinger no Codex indica que ele não pode consultar o hPanel naquela sessão; não indica falha no push nem no deploy nativo. Confira o site público e os recursos da versão servida para verificar o release. O conector só é necessário para consultar dados da conta, como logs de build e variáveis de ambiente. Consulte [o procedimento e as evidências de deploy](docs/deploy-producao.md).

### Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `AUTH_USER` | ✅ (produção) | Credencial de login |
| `AUTH_PASSWORD` | ✅ (produção) | Senha de login |
| `MCP_API_KEYS` | ✅ (Hermes/MCP) | JSON de credenciais nomeadas e escopadas para agentes |
| `MCP_API_KEY` | ❌ (migração) | Chave ampla legada; substitua por credenciais escopadas |
| `NOUS_API_KEY` | ❌ | Chave API Nous Research |
| `LIFESYSTEM_DATA_DIR` | ✅ (produção) | Diretório persistente fora da pasta do deploy |
| `GOOGLE_CALENDAR_CLIENT_ID` | ❌ | Cliente OAuth Web do Google Agenda |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | ❌ | Segredo OAuth do Google Agenda |
| `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY` | ❌ | Chave hexadecimal de 64 caracteres para cifrar o token de Agenda |

## Servidor MCP (integração com AI agents)

`/api/mcp` expõe ferramentas via [Model Context Protocol](https://modelcontextprotocol.io) para agentes que suportem Streamable HTTP. A tela `/hermes` mostra configuração, última chamada e histórico de ferramentas; ter uma chave configurada não prova que o agente na VPS esteja conectado.

**Ferramentas disponíveis:**
- Tasks: list, create, update, delete
- Captures: list, create, update, delete
- Projects: list, create, update, delete
- Pillars: list, update
- Indicators: list, create, update, delete
- Content: list, create, update, delete
- Log entries: list, create, update, delete
- Editais: list, create, update, delete
- Financeiro: lançamentos, contas, orçamentos, cartões, favorecidos, faturas, metas e resumo mensal
- Ações de produto: conversão idempotente de capturas e planejamento/remover/adotar blocos de tarefas
- Google Agenda: leitura de eventos, eventos gerenciados e blocos de tarefas espelhados; a criação solta antiga só permanece para `calendar:legacy`

**Autenticação:** `Authorization: Bearer <token>` (separado do login web)

Para criar um lançamento financeiro pelo MCP, `idempotencyKey` é obrigatória. O Hermes deve reutilizar a mesma chave apenas ao repetir a mesma solicitação e gerar outra chave para cada despesa distinta; isso permite ao LIFESYSTEM devolver o lançamento já criado quando uma chamada é reenviada, sem duplicá-lo.

Para clientes com acesso limitado, configure `MCP_API_KEYS` como JSON no ambiente do servidor. Cada item tem `id`, `key` (mínimo de 32 caracteres) e `scopes`, por exemplo `[{"id":"hermes-mcp","key":"substitua-por-um-segredo-com-32-caracteres-ou-mais","scopes":["tasks:read","tasks:plan","captures:convert","calendar:read","calendar:write","agent:heartbeat"]},{"id":"hermes-ai","key":"outro-segredo-com-32-caracteres-ou-mais","scopes":["ai:invoke"]}]`. Além de `domínio:read`, `domínio:write`, `domínio:delete` e `domínio:*`, há `captures:convert`, `tasks:plan`, `calendar:read`, `ai:invoke` e `agent:heartbeat`. Exclusões exigem o escopo explícito `domínio:delete`. Use identidades distintas para ferramentas e inferência. A chave legada `MCP_API_KEY` permanece compatível somente durante a migração e aparece como `legacy` no histórico.

### Google Agenda

Em **Planejar**, escolha o dia da tarefa; essa mesma data é o prazo (`dueDate`) mostrado em **Tarefas**. Se reservar horário, o bloco é opcional e pode ser espelhado na agenda principal. Mover o dia atualiza o prazo e o mesmo evento Google; devolver ao planejamento remove a data. A conexão Google precisa estar autorizada antes de ativar o espelho.

A visão **Semana** de Tarefas usa o mesmo planejamento. No celular, selecione um dia; no desktop, compare os sete dias. A jornada, os dias de trabalho e o fuso são configuráveis em Planejar e Carga; o padrão continua 08h–20h todos os dias. Intervalos consideram a união dos horários ocupados, sem contar eventos transparentes ou de dia inteiro. Disponibilidade só aparece com tarefas, jornada e agenda carregadas; use **Atualizar agenda** após mudanças externas. O calendário mensal continua sendo uma visão de prazos. Carga compara esforço informado com jornada bruta e não calcula tempo livre do Google. [Regras de estrutura, esforço e recorrência](docs/task-structure-capacity.md).

O cartão mostra se o bloco foi sincronizado ou ficou pendente. Falhas preservam os dados locais e permitem **Tentar sincronizar**. Se o evento foi alterado no Google, **Adotar bloco do Google** importa título e horário após confirmação. **Devolver ao planejamento** pede confirmação antes de remover o evento gerenciado. **Excluir tarefa** permite revisar a remoção conjunta do espelho; vínculos com outras tarefas precisam ser removidos antes. Concluir preserva o evento como histórico.

Esta entrega suporta um bloco por tarefa na agenda principal. Planejar já apresenta referências locais de publicações agendadas e vencimentos em aberto; isso não cria eventos. Espelhamento de finanças/conteúdos, múltiplas agendas, sync incremental e múltiplos blocos estão [especificados](docs/agenda-expansion-contracts.md), mas ainda não implementados. Alterações de título feitas fora de Planejar chegam ao Google ao salvar/sincronizar o bloco. O storage JSON usa locks por coleção entre processos cooperantes do mesmo host; réplicas distribuídas exigem armazenamento e coordenação compartilhados. [Limites do storage](docs/storage-hardening.md).

O LIFESYSTEM concentra a conexão OAuth e cifra o token no diretório de dados. Configure as três variáveis `GOOGLE_CALENDAR_*`, habilite a Google Calendar API e cadastre `https://SEU_DOMINIO/api/google-calendar/callback` como URI de redirecionamento no Google Cloud. Depois, acesse `/api/google-calendar/connect` uma vez para autorizar a conta. Clientes MCP que precisem criar eventos devem receber somente o escopo `calendar:write`; o token Google nunca é exposto pelo MCP.

**Para conectar o Hermes Agent:**
1. Configure o MCP do Hermes em `https://lifesystem.oj0nny.com/api/mcp` com a chave `hermes-mcp`.
2. Configure o endpoint OpenAI compatível em `https://lifesystem.oj0nny.com/api/ai/v1` com a chave `hermes-ai`. Ela só possui `ai:invoke` e não acessa ferramentas.
3. Faça o Hermes enviar `POST /api/hermes/heartbeat` a cada cinco minutos com uma chave exclusiva `hermes-heartbeat`, limitada a `agent:heartbeat`, status, versão e ferramentas detectadas. O job script-only não chama o modelo; veja [deploy-producao](docs/deploy-producao.md).
4. Execute `npm run mcp:smoke` na própria VPS com a URL e chave reais do Hermes. O teste faz handshake e uma leitura permitida sem imprimir dados.
5. Confirme no `/hermes` a chamada MCP e o heartbeat nomeado. Configuração, atividade e saúde da VPS são sinais distintos.

## Storage Layer

O `data/*.json` é a camada de dados. A interface `src/lib/storage/index.ts` abstrai CRUD, serializa escritas por coleção e grava via arquivo temporário com rename atômico.

Em produção, configure `LIFESYSTEM_DATA_DIR` para um diretório persistente fora do checkout/release do Git. Nunca use a pasta versionada do projeto como banco de produção: um novo deploy pode substituir os JSON runtime pelos dados do repositório.

Antes da primeira troca, copie os dados atuais para o diretório persistente e valide permissões de leitura e escrita. Faça também um backup antes de cada deploy.

O deploy da Hostinger faz uma cópia antes do build (`prebuild`), quando `LIFESYSTEM_DATA_DIR` está disponível no ambiente de compilação. Há também um backup diário às 03:00 configurado na conta de hospedagem, como ponto de recuperação independente. As cópias ficam em `lifesystem-backups`, fora das versões de deploy. Em desenvolvimento/CI sem diretório persistente, o hook informa que foi ignorado.

Backup manual:

```bash
npm run backup:data
```

Use `LIFESYSTEM_BACKUP_DIR` para escolher outro destino fora do checkout. Confira o log do build para validar o backup pré-deploy; o backup diário não substitui essa verificação.

**Coleções:** tasks, captures, projects, pillars, indicators, content, financial, accounts, budgets, bills, cards, payees, journal, vision, wiki-collections, log-entries

## Testes

```bash
# Rodar testes
npm test

# Rodar com UI
npm run test:ui

# Ver relatório
npm run test:report
```

**Cobertura atual:** APIs de tarefas, capturas e projetos; validação financeira e autorização/confiabilidade MCP; planejamento e Google Calendar; segurança de APIs; smoke tests e auditoria visual das rotas desktop/mobile. O GitHub Actions executa `npx tsc --noEmit`, `npm run build` e `npm test` em pushes e pull requests para `main`.

## Roadmap e qualidade

O [roadmap atual](docs/ROADMAP.md) separa implementação, evidência em produção e pendências reais. Análises e planos datados são registros históricos.

Para revisar sem dados pessoais nem reutilizar um servidor aberto: `npx playwright test --config playwright.readiness.config.ts`. A [auditoria de privacidade](docs/privacidade-historico.md) precisa ser concluída antes da divulgação à comunidade.

## Licença

MIT - veja [LICENSE](LICENSE) para detalhes.
