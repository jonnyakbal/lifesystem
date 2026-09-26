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
- **Financeiro** — Controle financeiro completo (contas, cartões, orçamentos)
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

Um `401` do conector Hostinger no Codex indica que ele não pode consultar o hPanel naquela sessão; não indica falha no push nem no deploy nativo. Confira o site público e os recursos da versão servida para verificar o release. O conector só é necessário para consultar dados da conta, como logs de build e variáveis de ambiente.

### Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `AUTH_USER` | ✅ (produção) | Credencial de login |
| `AUTH_PASSWORD` | ✅ (produção) | Senha de login |
| `MCP_API_KEY` | ✅ (MCP) | Token pra agentes de IA |
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
- Google Agenda: criação direta de eventos com `calendar:write`; `/planejar` também mostra eventos da semana após conexão OAuth

**Autenticação:** `Authorization: Bearer <token>` (separado do login web)

Para clientes com acesso limitado, configure `MCP_API_KEYS` como JSON no ambiente do servidor. Cada item tem `id`, `key` (mínimo de 32 caracteres) e `scopes`, por exemplo `[{"id":"hermes-leitura","key":"substitua-por-um-segredo-com-32-caracteres-ou-mais","scopes":["tasks:read","financial:read"]}]`. Escopos seguem `domínio:read` ou `domínio:write`; `domínio:*` permite ambos. Use um `id` exclusivo para o Hermes: ele aparece no histórico de chamadas sem expor a chave e permite distinguir o agente de outros clientes. A chave existente em `MCP_API_KEY` permanece compatível e mantém acesso amplo até a migração do cliente; chamadas com essa chave aparecem como `legacy` e não identificam a origem.

### Google Agenda

Em **Planejar**, abra uma tarefa e escolha **Reservar horário** para definir início e duração. O prazo (`dueDate`) permanece independente do bloco. Ative **Espelhar no Google Agenda** para criar um evento na agenda principal; salvar um replanejamento atualiza o mesmo evento. A conexão Google precisa estar autorizada antes de ativar o espelho.

O cartão mostra se o bloco foi sincronizado ou ficou pendente. Falhas preservam os dados locais e permitem **Tentar sincronizar**. Se o evento foi alterado no Google, **Adotar bloco do Google** importa título e horário após confirmação. **Devolver ao planejamento** pede confirmação antes de remover o evento gerenciado; exclua esse bloco antes de excluir uma tarefa espelhada. Concluir a tarefa preserva o evento como histórico.

Esta entrega suporta um bloco por tarefa na agenda principal. Espelhamento de finanças/conteúdos, múltiplas agendas, sincronização de alterações em segundo plano e múltiplos blocos continuam no roadmap. Mudanças no título feitas fora de Planejar chegam ao Google ao salvar ou sincronizar novamente o bloco. A persistência JSON e os bloqueios atuais pressupõem uma instância do servidor; múltiplas réplicas exigem armazenamento e coordenação transacionais compartilhados.

O LIFESYSTEM concentra a conexão OAuth e cifra o token no diretório de dados. Configure as três variáveis `GOOGLE_CALENDAR_*`, habilite a Google Calendar API e cadastre `https://SEU_DOMINIO/api/google-calendar/callback` como URI de redirecionamento no Google Cloud. Depois, acesse `/api/google-calendar/connect` uma vez para autorizar a conta. Clientes MCP que precisem criar eventos devem receber somente o escopo `calendar:write`; o token Google nunca é exposto pelo MCP.

**Para conectar o Hermes Agent:**
1. Configure um MCP server apontando pra `https://lifesystem.oj0nny.com/api/mcp`
2. Use uma chave de `MCP_API_KEYS` com os escopos necessários como Bearer token; a chave legada `MCP_API_KEY` continua aceita, mas dá acesso amplo
3. Teste o mesmo endpoint e a mesma chave do agente com `MCP_URL` e `MCP_API_KEY` no ambiente e `npm run mcp:smoke`. O teste executa o handshake, descobre as ferramentas e chama `list_tasks` quando permitido, sem imprimir os dados
4. Confirme a chamada em `/hermes`: configuração no servidor e tráfego real são estados distintos

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

## Roadmap próximo

- [ ] Sistema de IA (classificação de capturas, review semanal)
- [ ] Página de detalhe de projeto
- [ ] Subtarefas
- [ ] Gráficos de indicadores
- [x] Rate limiting no login e MCP

## Licença

MIT - veja [LICENSE](LICENSE) para detalhes.
