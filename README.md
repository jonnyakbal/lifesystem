# LIFESYSTEM

Sistema pessoal de gestão da vida — "segundo cérebro" do Jonny.

Centraliza: capturas (INBOX), visão (Plano de Voo), pilares, projetos, tarefas, indicadores, finanças e diário.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript**
- **Tailwind CSS v4**
- **JSON File Storage** (local no servidor — migração fácil pra Postgres/Supabase depois)

## Rodando local

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`

## Estrutura

```
src/
├── app/                    # App Router
│   ├── api/                # API Routes (JSON storage)
│   ├── (dashboard)/        # Páginas autenticadas
│   │   ├── inbox/          # Captura rápida
│   │   ├── visao/          # Plano de Voo
│   │   ├── pilares/        # 6 pilares
│   │   ├── projetos/       # Kanban
│   │   ├── tarefas/        # Tasks com prioridade
│   │   ├── indicadores/    # Métricas
│   │   ├── financeiro/     # Controle financeiro
│   │   └── diario/         # Journal
│   └── layout.tsx
├── components/
│   └── layout/sidebar.tsx
├── lib/storage/            # JSON storage layer
└── types/                  # TypeScript types
data/                       # JSON "banco" (gerado em runtime + seed)
```

## Deploy (Hostinger Node.js)

1. Build: `npm run build` (gera `output: standalone`)
2. Push pro GitHub (branch `main`)
3. Na Hostinger: conectar o repositório com integração nativa do GitHub
4. Comando de build: `npm run build`
5. Pasta do app: `data/` deve ter permissão de escrita

### Variáveis de ambiente

- `AUTH_USER` / `AUTH_PASSWORD` — credenciais de login da interface web.
- `MCP_API_KEY` — token usado por agentes de IA externos (ex: Hermes Agent) pra chamar `/api/mcp` (ver seção abaixo). Gere um valor aleatório longo; sem essa variável configurada, o endpoint MCP fica bloqueado (fail closed).
- `NOUS_API_KEY` — opcional. Chave da API de inferência da Nous Research (portal.nousresearch.com), usada só pelo testador de prompt em `/hermes`. Sem ela, essa seção fica desabilitada; o resto do app funciona normalmente.

## Servidor MCP (integração com Hermes Agent)

`/api/mcp` expõe as ferramentas do LIFESYSTEM (Tarefas, Conteúdo, INBOX/Notas, Pilares, Metas, Projetos — CRUD completo) via [Model Context Protocol](https://modelcontextprotocol.io), pra qualquer agente de IA que suporte MCP (ex: [Hermes Agent](https://hermes-agent.nousresearch.com/), que roda na VPS do Jonny e conecta por Telegram).

- Autenticação própria por `Authorization: Bearer <MCP_API_KEY>` — não usa o login/cookie da interface web.
- Implementação: `src/lib/mcp/tools.ts` (definição das ferramentas), `src/lib/mcp/server.ts` (instancia o servidor), `src/app/api/mcp/route.ts` (endpoint HTTP).
- Pra conectar o Hermes: configurar nele um MCP server apontando pra `https://lifesystem.oj0nny.com/api/mcp` com o `MCP_API_KEY` como Bearer token.
- Pra testar manualmente: `npx @modelcontextprotocol/inspector` apontado pro endpoint local ou de produção.

## Storage Layer

O `data/*.json` é a camada de dados. A interface `src/lib/storage/index.ts` abstrai CRUD.
Quando precisar de banco robusto, basta trocar a implementação (ex: Supabase) sem tocar nas rotas.

## Roadmap próximo

- [ ] Sistema de IA (classificação de capturas, review semanal)
- [ ] Página de detalhe de projeto
- [ ] Subtarefas
- [ ] Gráficos de indicadores
- [ ] Migração pra Supabase quando necessário