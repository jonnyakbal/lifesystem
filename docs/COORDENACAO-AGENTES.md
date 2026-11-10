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
