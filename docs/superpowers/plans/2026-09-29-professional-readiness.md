# Confiabilidade, privacidade e experiência principal

**Objetivo:** executar os quatro itens aprovados por Jonny: auditoria de privacidade do histórico, validação Hermes/produção, revisão mobile do ciclo principal e consolidação do backlog.

**Arquitetura:** preservar o armazenamento e os contratos atuais; corrigir falhas reproduzidas; testar exclusivamente com dados sintéticos. Documentar evidência e limitações sem registrar dados pessoais ou credenciais.

**Stack:** Next.js 16, React 19, Playwright, MCP SDK, JSON em disco.

**Restrições:** não modificar dados reais, Calendar ou Hermes da empresa. Não fazer force-push nem rotacionar credenciais sem autorização específica. Revisão local em `chore/professional-readiness-2026-09-29`, criada a partir de `98ced9e`.

**Foco da revisão:** isolamento dos testes, prevenção de duplicação, acessibilidade mobile, documentação coerente e limites das evidências de produção.

## Execução

- [x] 1. Inventariar caminhos de risco no histórico e preparar saneamento reversível; publicação e auditoria de conteúdo permanecem pendentes.
- [x] 2. Verificar conexão pessoal Hermes e exercitar retry financeiro sintético; recibo exato do build de produção permanece pendente.
- [x] 3. Corrigir falhas reproduzidas no ciclo principal e verificar mobile 360/390 px e desktop.
- [x] 4. Consolidar roadmap e atualizar documentos contraditórios.
- [x] Concluir a execução final da suite após os ajustes do isolamento e do teste integrado.
- [x] Executar tipos, lint, build e revisão final independente.

## Evidências e limites

1. Privacidade: 0 caminhos de risco rastreados atualmente; 100 históricos (18 JSON e 82 artefatos). Backup privado verificado, duas branches remotas incluídas na candidata, auditoria dos refs candidatos com 0 caminhos de risco. Histórico original e GitHub preservados. Ver `docs/privacidade-historico.md`.
2. Hermes: conexão pessoal autenticada descobriu as ferramentas; painel público mostrou heartbeat recente e Online. Nenhuma escrita real. O conector Hostinger respondeu 401; conectividade não certifica SHA ou schema em execução.
3. Correções com regressão reproduzida: captura não apaga rascunho nem anuncia sucesso em HTTP de erro; bloqueia envios concorrentes; revisão não conclui após falha de carregamento; MCP não recria lançamento se a escrita do recibo falhar após a criação financeira.
4. Auditoria visual: smoke de 18 rotas em desktop/mobile; ciclo completo em 360 px. Isso não certifica acessibilidade completa ou UX de todos os módulos secundários.
5. Revisão independente: corrigidos isolamento de `NOUS_API_KEY` e uploads no diretório temporário de QA. Não houve achados críticos adicionais no código revisto.
6. Teste integrado: uma rodada com servidor novo expôs navegação antes da resposta de planejamento. O teste agora aguarda PUT, fechamento do diálogo e verifica `dueDate` persistido. Nova execução isolada: `1 passed (20.6s)`.
7. Verificações já concluídas: suite anterior `140 passed (3.1m)`; TypeScript exit 0; lint 0 erros e 125 avisos existentes; build exit 0. A rodada final atual será registrada abaixo, sem ocultar falhas intermediárias.

### Resultado final

- `npx playwright test --config playwright.readiness.config.ts`: `140 passed (3.5m)`, exit 0, servidor novo e dados sintéticos isolados.
- `npx tsc --noEmit`: exit 0.
- `npm run lint`: `125 problems (0 errors, 125 warnings)`, exit 0.
- `npm run build`: `Compiled successfully in 8.0s`, TypeScript concluído e exit 0; executado com diretório temporário vazio e integrações desabilitadas.
- `git diff --check`: exit 0.
- Auditoria do checkout original: exit 1 esperado, 0 caminhos atuais e 100 históricos; candidato saneado com 0 caminhos de risco e bundle verificado.

Logs privados fora do checkout: `C:/dev/jonny/lifesystem-readiness-tests-final-local.log`, `lifesystem-readiness-lint-local.log` e `lifesystem-readiness-build-local.log`. Até o encerramento da revisão local, nenhum commit, push, deploy ou alteração de dados reais havia sido realizado.

### Integração autorizada

Após revisar o resultado, Jonny autorizou avançar. As correções seguem para `main` e a integração nativa Hostinger. O envio ao GitHub e a confirmação da nova versão no site são registrados separadamente em `docs/deploy-producao.md`. A autorização não inclui reescrever o histórico público nem alterar dados reais.

- `0adc054` enviado a `main`; CI GitHub concluída com sucesso. Hostinger falhou no processo de compilação CSS do Turbopack, conforme log autenticado.
- Correção do build: `next build --webpack`; export `DashboardAnimatedNumber` sem uso removido de `page.tsx`, depois de o build reproduzir o erro de export não permitido. Novo build compilou em 11.3s, gerou 45 páginas e terminou com exit 0.
- Correção de segurança: somente `fast-uri` 3.1.6 → 3.1.8 no lockfile; auditoria npm voltou a `found 0 vulnerabilities`. Suite depois da atualização: `140 passed (6.1m)`, exit 0. Lint: 0 erros, 125 avisos existentes.

## Decisões de execução

- Manter o resultado local e revisável, sem commit/push/deploy nesta revisão. Custo: correções novas ainda não protegem o runtime público até integração e publicação.
- Preparar histórico em cópia descartável e manter backup privado; não reescrever refs públicos automaticamente. Custo: os caminhos antigos continuam acessíveis no GitHub até o saneamento autorizado.
- Manter o modelo de processo único do armazenamento JSON. A prevenção de duplicação verificada não promete transação entre réplicas; esse limite continua documentado no roadmap.

## Registro de decisões

- 2026-09-29: execução direta autorizada pelo usuário; não abrir nova rodada de aprovação de design para correções desta revisão.
- Reescrita de histórico público fica como ação final sujeita a autorização específica: altera SHAs e afeta clones/PRs.
- Produção usa integração nativa Hostinger/GitHub; CI não é recibo de deploy.
