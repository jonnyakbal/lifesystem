# LIFESYSTEM

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/jonnyakbal/lifesystem/actions/workflows/ci.yml/badge.svg)](https://github.com/jonnyakbal/lifesystem/actions/workflows/ci.yml)

Sistema pessoal de gestão da vida — "segundo cérebro" do Jonny.

**ARCOLABS** — Ferramenta pessoal de uso diário, feita pra reduzir a carga cognitiva de gerir a vida num só lugar.

## O que é o LIFESYSTEM

Um "segundo cérebro" pessoal — não um produto pra terceiros, é ferramenta de uso próprio, de uso diário, feita pra reduzir a carga cognitiva de gerir a vida num só lugar.

**Princípios que guiaram as decisões de produto:**
- **Captura rápida, processamento deliberado.** O INBOX existe pra tirar qualquer ideia da cabeça em segundos; a Revisão Semanal e o Wizard "Planejar" são os momentos deliberados de decidir o que aquilo vira.
- **6 Pilares como eixo central.** Fé & Propósito, Físico/Corpo, Mente/Conhecimento, Profissional/Talentos, Dinheiro & Patrimônio, Comunidade.
- **BHAG em cima, indicadores operacionais embaixo.** Cada pilar tem uma meta grande de ano e metas menores/recorrentes.
- **Single-user por design.** Não é multi-tenant, não tem plano de virar SaaS — é o sistema pessoal do Jonny.
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

### Core Dashboard (15 páginas autenticadas)

- **Home** — Dashboard unificado com confetti quando completa tasks do dia
- **INBOX** — Captura rápida estilo sticky notes com cores determinísticas
- **Notas** — Hub de conhecimento com editor Notion-style completo
- **Hoje** — Visão diária unificada (tarefas, indicadores, conteúdo agendado)
- **Planejar** — Wizard de planejamento por pilar (Dia/Semana/Mês)
- **Visão** — Visão + Pilares com constelação SVG animada
- **Projetos** — Kanban board com tags e cover images
- **Tarefas** — Kanban completo (1683 linhas!) com prioridades e recorrência
- **Conteúdo** — Gestão de conteúdo (blog/YouTube/Instagram/TikTok)
- **Indicadores** — Tracking de metas por pilar com 5 tipos
- **Financeiro** — Controle financeiro completo (contas, cartões, orçamentos)
- **Diário** — Journal pessoal com check-ins por pilar
- **Diário de Bordo** — Log técnico (templo vivo, editável via MCP)
- **Revisão** — Revisão semanal 5 passos (GTD)
- **Hermes** — Gestão de integração AI (MCP + prompt tester)

### Infraestrutura

- **MCP Server** — 26 tools pra AI agents (Hermes Agent via Telegram)
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

## Estrutura

```
src/
├── app/
│   ├── api/                 # 23 REST API route groups + MCP server
│   ├── (dashboard)/         # 15 páginas autenticadas
│   ├── login/
│   └── layout.tsx
├── components/
│   ├── layout/              # sidebar, command-palette, settings
│   ├── ui/                  # 18 primitivos (button, card, dialog, etc.)
│   └── *.tsx                # componentes de fluxo (500+ linhas cada)
├── lib/
│   ├── storage/             # camada de dados única (JSON files)
│   ├── mcp/                 # servidor + ferramentas MCP (26 tools)
│   ├── auth.ts              # HMAC session token
│   └── api.ts               # wrapper de fetch pro frontend
├── types/index.ts           # tipos de domínio (359 linhas)
└── middleware.ts            # gate de auth cookie-based
data/                        # JSON "banco" (15 coleções)
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
| `/api/mcp` | POST | Servidor MCP (26 tools) |

## Deploy (Hostinger Node.js)

1. Build: `npm run build` (gera `output: standalone`)
2. Push pro GitHub (branch `main`)
3. Na Hostinger: conectar o repositório com integração nativa do GitHub
4. Comando de build: `npm run build`
5. Pasta do app: `data/` deve ter permissão de escrita

### Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `AUTH_USER` | ✅ (produção) | Credencial de login |
| `AUTH_PASSWORD` | ✅ (produção) | Senha de login |
| `MCP_API_KEY` | ✅ (MCP) | Token pra agentes de IA |
| `NOUS_API_KEY` | ❌ | Chave API Nous Research |

## Servidor MCP (integração com AI agents)

`/api/mcp` expõe CRUD completo via [Model Context Protocol](https://modelcontextprotocol.io) pra qualquer agente de IA que suporte MCP.

**26 ferramentas disponíveis:**
- Tasks: list, create, update, delete
- Captures: list, create, update, delete
- Projects: list, create, update, delete
- Pillars: list, update
- Indicators: list, create, update, delete
- Content: list, create, update, delete
- Log entries: list, create, update, delete
- Vision: get, update
- Wiki collections: list, create, update, delete

**Autenticação:** `Authorization: Bearer <MCP_API_KEY>` (separado do login web)

**Para conectar o Hermes Agent:**
1. Configure um MCP server apontando pra `https://lifesystem.oj0nny.com/api/mcp`
2. Use o `MCP_API_KEY` como Bearer token
3. O Hermes descobre e usa as ferramentas automaticamente

## Storage Layer

O `data/*.json` é a camada de dados. A interface `src/lib/storage/index.ts` abstrai CRUD com operações atômicas.

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

**Testes existentes:**
- Tasks API (CRUD + batch)
- Captures API (CRUD)
- Projects API (CRUD)

## Roadmap próximo

- [ ] Sistema de IA (classificação de capturas, review semanal)
- [ ] Página de detalhe de projeto
- [ ] Subtarefas
- [ ] Gráficos de indicadores
- [ ] Calendário integrado (Google Calendar)
- [ ] Rate limiting no login e MCP

## Licença

MIT - veja [LICENSE](LICENSE) para detalhes.