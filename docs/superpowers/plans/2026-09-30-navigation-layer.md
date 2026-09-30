# Camada de navegação — plano de implementação

**Objetivo:** tornar páginas, menus, ações e próximos passos uma experiência contínua em desktop e mobile.

**Arquitetura:** `navigation.ts` é a fonte de destinos e relações. `workspace-sidebar.tsx` apresenta os percursos e o dock. `workspace-heading.tsx` exibe dois próximos destinos sem substituir as ações específicas. CSS compartilhado sustenta o refinamento visual e o movimento acessível.

- [x] Escrever testes de navegação para grupos, rota ativa, mobile e ligações dos heros; confirmar falha antes da mudança.
- [x] Organizar grupos e vínculos no modelo de navegação.
- [x] Reformular sidebar, folha mobile, dock e breadcrumb preservando captura/busca.
- [x] Adicionar trilhas de continuidade aos heros e frases contextuais sem poluir o conteúdo.
- [x] Refinar estados de foco, hover e movimento reduzido em CSS; conferir visualmente 320/390/1440 px.
- [x] Rodar testes focados, regressões de navegação, lint, tipos, build e diff-check em dados sintéticos.

## Evidências locais

- TDD: 3 testes novos falharam antes da implementação em `C:/dev/jonny/lifesystem-navigation-red-local.log`.
- Fluxos de captura, planejamento e menu: 8 passed (47.7s), `C:/dev/jonny/lifesystem-navigation-focused-green-local.log`. Estado final das 3 jornadas: 3 passed em `C:/dev/jonny/lifesystem-navigation-final-focused-local.log`.
- Auditoria visual das 22 rotas em 1440 px escuro, 390 px escuro e 1440 px claro: 66 cenários, 1 teste passed (2.6m), `C:/dev/jonny/lifesystem-navigation-visual-audit-local.log`. Mobile 320 px validado separadamente em `C:/dev/jonny/lifesystem-navigation-mobile-local.png`.
- `npx tsc --noEmit`: exit 0. `npm run lint`: exit 0, 0 erros e 96 avisos existentes. `git diff --check`: exit 0.
- `npm run build` com webpack: exit 0, compilação em 13,0 s, TypeScript em 5,6 s e 48/48 páginas geradas, `C:/dev/jonny/lifesystem-navigation-build-final-local.log`.
- Capturas para revisão: `C:/dev/jonny/lifesystem-navigation-desktop-local.png`, `C:/dev/jonny/lifesystem-navigation-mobile-local.png`, `C:/dev/jonny/lifesystem-navigation-hero-local.png`.

## Ajustes após revisão independente

- Pilares permanece como aba de Visão, acessível por essa página e pelo endereço legado; a entrada duplicada saiu do menu.
- Fontes não repete o botão Notas no mesmo hero; a revisão aberta dentro da Inbox não sugere iniciar outra revisão.
- Financeiro agora apresenta as ligações Planejar e Metas sob seu cabeçalho próprio.
- Os quatro cenários falharam antes das correções em `C:/dev/jonny/lifesystem-navigation-review-red-local.log`; depois, os nove testes de navegação passaram em `C:/dev/jonny/lifesystem-navigation-review-final-local.log`.
- Após esses ajustes: tipos exit 0, lint exit 0 (0 erros, 96 avisos), diff-check exit 0 e build webpack exit 0, registrados em `C:/dev/jonny/lifesystem-navigation-types-postreview-local.log`, `C:/dev/jonny/lifesystem-navigation-lint-postreview-local.log`, `C:/dev/jonny/lifesystem-navigation-diff-postreview-local.log` e `C:/dev/jonny/lifesystem-navigation-build-postreview-local.log`.
- As regressões conectadas de Fontes, Financeiro e Revisão passaram: **16 passed (31.0s)** em `C:/dev/jonny/lifesystem-navigation-connected-regressions-local.log`.

As verificações usam armazenamento isolado e dados sintéticos. Não houve commit, push ou deploy nesta etapa.
