# Coordenação entre agentes (Codex e Claude)

A partir de 07/11/2026 o Jonny trabalha principalmente com o **Codex**. O Claude pode voltar a qualquer momento. Os dois usam o mesmo checkout (`C:\dev\jonny\lifesystem`) e o mesmo GitHub, então estas regras valem para ambos.

## Regras

1. **Antes de começar:** `git status`, `git fetch`, `git log --oneline HEAD..origin/main` e `git worktree list`. Se houver mudança local que não é sua, **não** descarte nem faça commit dela: pergunte ao Jonny.
2. **Uma branch por agente e por tarefa:** `codex/<tarefa>` ou `claude/<tarefa>` (as antigas `feat/…` seguem válidas). Nunca faça commit na branch do outro sem o Jonny pedir.
3. **Um agente por vez no checkout principal.** Se o outro pode estar ativo, trabalhe em worktree própria (`git worktree add ../lifesystem-codex-<tarefa> -b codex/<tarefa> origin/main`). Não rode `next dev`, build ou `npm install` num checkout com `next dev` de outra sessão ativo.
4. **`main` só avança por fast-forward, com autorização explícita do Jonny** (push na main publica na Hostinger). Nada de force-push.
5. **Ao terminar ou pausar:** atualize a seção "Estado atual" abaixo (branch, o que falta, o que está publicado) e faça commit. É assim que o próximo agente sabe onde parar.
6. As regras de [AGENTS.md](../AGENTS.md) continuam valendo: QA com dados sintéticos, sem ler `.env`/credenciais/dados pessoais, não mexer em Hermes nem Arco CRM, build `next build --webpack`.

## Gate de QA (o mesmo do CI)

Cópia limpa do commit (worktree), diretórios vazios em `LIFESYSTEM_DATA_DIR`/`UPLOAD_DIR`/`BACKUP_DIR`, variáveis do `.github/workflows/ci.yml`, `npm run build` e `npx playwright test --config=playwright.ci.config.ts`. Falha conhecida só no Windows: `office-provenance` (área de transferência). Rodadas com o PC suspendendo geram falhas falsas (`ERR_NETWORK_IO_SUSPENDED`, Chrome sem abrir): repita os arquivos afetados.

## Estado atual (24/11/2026, faturas e vencimentos)

- `codex/financeiro-fatura-unica` parte de `ceffe9f`. **Lançamentos** e a Visão Geral usam uma saída por cartão e ciclo. A linha da fatura exibe o valor total e abre as compras e parcelas em **Cartões e faturas**. O previsto de uma fatura parcial considera o valor em aberto.
- Ao editar um previsto antigo sem vencimento, o formulário sugere a data original do registro. O usuário pode ajustar a data antes de salvar. A edição individual usa a API existente e preserva compras, parcelas, pagamentos e histórico. As ferramentas, schemas e escopos MCP permanecem os mesmos. Sem mudança em aprovações ou recibos.
- `npm run build`, ESLint dos arquivos alterados e 45 testes do Financeiro no Chromium com a configuração de CI passaram. A verificação usou dados sintéticos e cobriu a linha única, a navegação para a fatura, a quitação e a edição de vencimento.
- A publicação destes ajustes está pendente. O redesenho anterior segue publicado.

## Histórico (24/11/2026, interface do Financeiro)

- O redesenho de `codex/financeiro-painel` está no commit `4d8efac`, sobre `dc7eb8b`. A publicação foi autorizada em 24/11/2026 pelo fluxo nativo da Hostinger acionado por `main`. O build no domínio deve ser conferido após o push.
- A Visão Geral destaca o saldo das contas, diferencia os resultados realizado e previsto e compara o resultado com o período anterior quando existem dados. Pontos, barras e categorias dos gráficos abrem os recortes correspondentes.
- Lançamentos tem totais filtrados, atalhos por situação, ordenação, filtro por dia e uma lista responsiva que exibe conta, cartão, data e situação. A navegação dos gráficos posiciona o foco no início da lista.
- Build Webpack, ESLint dos arquivos alterados e 40 testes do Financeiro passaram com dados sintéticos. Conferidas as capturas em desktop e viewport móvel. APIs e ferramentas MCP mantêm nomes, entradas e escopos.

## Histórico (24/11/2026, caixa)

- `codex/financeiro-caixa` inclui `d2e0dd9` (saldo consolidado, filtros, aba única e edição de cartões) e adiciona data da conferência de saldo, transferências entre contas e quitação pela conta pagadora.
- `PATCH /api/accounts/[id]` marca a conferência quando recebe `balance`. `GET /api/transfers` lista os recibos recentes. `POST /api/transfers` recebe `id`, `fromAccountId`, `toAccountId` e `amount` em reais. `POST /api/bills/[id]` recebe `accountId` e quita o valor restante. Os recibos impedem reaplicação em tentativas repetidas.
- O MCP mantém nomes, schemas de entrada e escopos. `create_account` e `update_account` registram a conferência quando recebem saldo. `update_bill` e `delete_bill` preservam faturas com débito registrado.
- O build Webpack, o lint dos arquivos alterados e 51 testes do Financeiro e MCP passaram com dados sintéticos. A suíte cobre repetição de transferência e retomada da quitação após o débito.
- A projeção de caixa, revisão de duplicatas e importação de extrato seguem no roadmap. A publicação desta remessa usa o deploy nativo do LifeSystem acionado por `main`.

## Histórico (23/11/2026, Codex)

- `codex/financeiro-navegacao` parte de `09dc55b`, verificado no GitHub como o mesmo commit de `main`. A alteração está em revisão local. A publicação deste lote está pendente.
- O Financeiro agora destaca a soma dos saldos informados das contas ativas, separa o resultado do período, reúne cartões e faturas e permite editar os dados de cada cartão. Os filtros de lançamentos incluem conta, cartão e categoria.
- A edição usa `PATCH /api/cards/[id]`. Os campos opcionais `limit`, `closingDay`, `dueDay` e `accountId` aceitam `null` para limpar o valor. As ferramentas e os escopos MCP seguem os mesmos.
- Webpack, TypeScript e ESLint dos arquivos alterados passaram. A suíte do Financeiro passou com 37 testes em ambiente isolado e dados sintéticos. A revisão visual cobriu a visão geral no desktop e no celular, além da edição de cartão no celular.

## Histórico (10/11/2026, Claude)

- `main` = `origin/main` em `1e02d4c` (correção de faturas do Codex, no ar segundo o repasse).
- **Branch `feat/polimento-profissional` rebaseada sobre `1e02d4c` e NÃO publicada.** Nenhum arquivo em comum com a correção financeira. Gate em cópia limpa: tsc 0, build ok, 43 testes (`tests/professional*`, `tests/financial*`) passaram. Falta: autorização do Jonny para publicar (fast-forward).
- **Depois de publicar:** em produção, trocar a marca do projeto ARCO PASS de Ateliê Studio para **Arcopass**.
- Pendente do Codex: validar compra real vinculada ao cartão na fatura certa (Jonny).
- Backlog do polimento: Indicadores, Pilares, Visão, Dados, Diário pessoal, Hermes; passada fina em Conteúdo e Escritório.

### OpenBot pessoal (20/11/2026, Codex)

- No Marketplace do OpenBot Oracle, o cadastro `lifesystem` foi confirmado restrito ao Agente Pessoal. O teste reconheceu duas ferramentas. A ponte na Oracle seguiu em modo de cadastro, com execução bloqueada.
- A branch `codex/openbot-oauth` publicou a autorização direta no LifeSystem. O proprietário confirmou o acesso e o OpenBot validou o catálogo de leitura de tarefas e Inbox.
- QA local em dados sintéticos: 25 testes OAuth/MCP, quatro testes do setup de CI, TypeScript, lint e build Webpack aprovados. O servidor local de produção retornou metadados 200, MCP anônimo 401 e, após trocar um código sintético, `tools/list` 200 com as duas ferramentas esperadas.
- Após a primeira publicação, o formulário de consentimento enviava `Origin: null` no Chromium. A correção mantém a verificação de origem, altera a política apenas no HTML do consentimento e adiciona um teste do envio pelo Chromium. QA da correção: 26 testes relevantes e build Webpack aprovados.

### Diário pessoal no MCP (19/11/2026, Codex)

- Branch local `codex/journal-mcp`. Escopos explícitos `journal:read` e `journal:write`. O Diário usa o mesmo armazenamento da interface e exige a versão atual para edição pelo agente.
- Catálogo, contrato e lacunas em [mcp-cobertura.md](mcp-cobertura.md).
- O Diário faz parte da candidata local para ampliar o acesso OAuth do Agente Pessoal.

### Catálogo do agente pessoal (Codex)

- Na branch local `codex/journal-mcp`, o catálogo agora classifica leitura e escrita. Criações com idempotência conferem também os argumentos e preservam a intenção após falha do recibo.
- Disponibilidade semanal, revisão, Notas/Wiki e Visão estão disponíveis localmente com os novos escopos documentados no [mapa MCP](mcp-cobertura.md). O rascunho da revisão é somente de leitura.
- O OAuth com leitura de tarefas e Inbox está publicado. As ferramentas novas da candidata ainda precisam de publicação e consentimento.
- Verificação: 37 testes MCP e de calendário, TypeScript, ESLint dos arquivos envolvidos e build Webpack passaram com dados sintéticos.

### Ampliação do OAuth para o Agente Pessoal

- Candidata local `codex/openbot-personal-full` preparada para revisão. Reaproveita os commits do Diário e das consultas pessoais. A ponte antiga fica fora desta entrega.
- O [guia OpenBot](integrations/openbot-oauth.md) lista os escopos e o [mapa MCP](mcp-cobertura.md) descreve os contratos novos. A credencial Bearer da ponte e as concessões OAuth existentes conservam suas permissões.
- QA isolado confirmou 68 ferramentas no consentimento ampliado, uma escrita sintética no Diário via token OAuth e a recusa dos escopos fora do perfil. Passaram 40 testes, TypeScript, ESLint e build Webpack.
- Para ativar a candidata depois de aprovada, publicar o código, conferir agentes e papéis no OpenBot, renovar o consentimento e validar o catálogo sem consultar registros reais.
