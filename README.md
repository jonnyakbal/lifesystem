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

Nenhuma necessária no MVP (storage é arquivo local).

## Storage Layer

O `data/*.json` é a camada de dados. A interface `src/lib/storage/index.ts` abstrai CRUD.
Quando precisar de banco robusto, basta trocar a implementação (ex: Supabase) sem tocar nas rotas.

## Roadmap próximo

- [ ] Sistema de IA (classificação de capturas, review semanal)
- [ ] Página de detalhe de projeto
- [ ] Subtarefas
- [ ] Gráficos de indicadores
- [ ] Migração pra Supabase quando necessário