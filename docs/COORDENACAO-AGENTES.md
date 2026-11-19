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

## Estado atual (10/11/2026, Claude)

- `main` = `origin/main` em `1e02d4c` (correção de faturas do Codex, no ar segundo o repasse).
- **Branch `feat/polimento-profissional` rebaseada sobre `1e02d4c` e NÃO publicada.** Nenhum arquivo em comum com a correção financeira. Gate em cópia limpa: tsc 0, build ok, 43 testes (`tests/professional*`, `tests/financial*`) passaram. Falta: autorização do Jonny para publicar (fast-forward).
- **Depois de publicar:** em produção, trocar a marca do projeto ARCO PASS de Ateliê Studio para **Arcopass**.
- Pendente do Codex: validar compra real vinculada ao cartão na fatura certa (Jonny).
- Backlog do polimento: Indicadores, Pilares, Visão, Dados, Diário pessoal, Hermes; passada fina em Conteúdo e Escritório.

### OpenBot pessoal (20/11/2026, Codex)

- No Marketplace do OpenBot Oracle, o cadastro `lifesystem` foi confirmado restrito ao Agente Pessoal. O teste reconheceu duas ferramentas. A ponte na Oracle seguiu em modo de cadastro, com execução bloqueada.
- A branch `codex/openbot-oauth` acrescenta autorização direta no LifeSystem conforme o [guia de integração](integrations/openbot-oauth.md). O OAuth começa com leitura de tarefas e Inbox. A validação final depende do consentimento do proprietário no OpenBot.
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
