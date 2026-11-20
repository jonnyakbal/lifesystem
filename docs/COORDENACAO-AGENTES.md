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

### Diário pessoal no MCP (19/11/2026, Codex)

- Branch local `codex/journal-mcp`. Escopos explícitos `journal:read` e `journal:write`. O Diário usa o mesmo armazenamento da interface e exige a versão atual para edição pelo agente.
- Catálogo, contrato e lacunas em [mcp-cobertura.md](mcp-cobertura.md).
- Sem publicação. A credencial e a ponte do OpenBot na Oracle continuam pendentes.

### Catálogo do agente pessoal (Codex)

- Na branch local `codex/journal-mcp`, o catálogo agora classifica leitura e escrita. Criações com idempotência conferem também os argumentos e preservam a intenção após falha do recibo.
- Disponibilidade semanal, revisão, Notas/Wiki e Visão estão disponíveis localmente com os novos escopos documentados no [mapa MCP](mcp-cobertura.md). O rascunho da revisão é somente de leitura.
- Validação local com credencial sintética. A ponte, a credencial e o teste pelo OpenBot real continuam pendentes.
- Verificação: 37 testes MCP e de calendário, TypeScript, ESLint dos arquivos envolvidos e build Webpack passaram com dados sintéticos.

### Ponte OpenBot na Oracle (Codex)

- Protótipo local em [integrations/openbot-mcp](../integrations/openbot-mcp/README.md). O container OpenBot 0.71.0 na Oracle compartilha a rede atual com o Arco OS. A ponte proposta escuta somente no loopback do namespace OpenBot.
- Três testes HTTP locais passaram com token sintético. Sem instalação, credencial ou validação no OpenBot real. A API da Hostinger mascara valores e substitui todas as variáveis ao escrever; a entrada exclusiva deve ser acrescentada no editor individual de MCP_API_KEYS pelo operador.

### Ponte OpenBot na Oracle (20/11/2026, Codex)

- Serviço separado `lifesystem-openbot-bridge-bridge-1` iniciado na Oracle com imagem oficial Node 24 fixada por digest. O serviço escuta no loopback do namespace do OpenBot, sem porta publicada.
- `initialize` e `tools/list` passaram pela ponte na Oracle. O catálogo da credencial é `list_tasks` e `list_captures`, correspondendo a `tasks:read` e `captures:read`.
- Falta cadastrar `http://127.0.0.1:4193/mcp` como Streamable HTTP nas configurações MCP do servidor Oracle no OpenBot, atribuir ao agente pessoal e validar pelo próprio OpenBot. A automação do navegador não abriu nesta sessão.
- O código das ferramentas novas segue local, sem publicação. A alteração de credencial no hPanel foi aplicada pelo Jonny.

- A ponte ativa foi posta em modo de cadastro. Na Oracle, tools/list retornou apenas list_captures e list_tasks. O modo também recusou tools/call com HTTP 403, sem chegar ao LifeSystem. Quatro testes locais da ponte passaram.
- OpenBot Nightly 0.71.0 tem controle MCP por agente, mas o padrão de uma entrada recém-criada permite todos. Validar a regra de acesso do agente pessoal na interface antes de liberar a execução da ponte. A interface ainda não foi inspecionada, pois o controle do Chrome falhou.
