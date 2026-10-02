<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Continuidade desta sessão — 01/10/2026

Atualização de 02/10: Jonny autorizou publicar as pendências/documentação para Claude na nuvem. Comece por `docs/CONTINUIDADE-CLAUDE-CLOUD.md`; esta sessão cuida de código/UI/APIs LifeSystem, a outra da configuração/consumidor Hermes pessoal na VPS. Não alterar nenhuma instalação Hermes nem Arco CRM aqui. A conversa da estação já está publicada/testada; seguir o plano incremental, sem reinstalá-la. A restrição documental de não publicar no repasse anterior abaixo é histórica e não impede esta publicação expressamente solicitada; não amplia a autorização para reescrita pública ou mudanças de runtime.

- Leia `docs/HANDOFF-CLAUDE.md` antes de implementar; ele consolida evidências, pendências, contratos e próximos passos. `docs/ROADMAP.md` mantém as prioridades; planos datados são registros históricos.
- Confira HEAD, origin/main, alterações locais e worktrees antes de trabalhar. Preserve o trabalho concorrente do Escritório; não restaure main a uma branch antiga. Não descarte arquivos ignorados ao limpar worktrees.
- O repasse de 01/10 foi documental e local; a atualização de 02/10 autoriza publicar esses documentos e o plano cloud. Isso não autoriza reescrita pública: ela exige autorização específica para referências, candidata e janela após revisão privada.
- Não altere Hermes ou Arco CRM nesta continuidade sem nova autorização que mude explicitamente esse escopo. Nunca altere/reinicie a instalação Hermes empresarial Dona Maria. Consulte referências privadas somente quando necessárias e sem copiar seus dados para o Git.
- Não consulte/imprima `.env`, tokens, credenciais, registros financeiros ou relatos pessoais reais durante QA. Testes e builds usam dados sintéticos e diretórios temporários; não reutilize o servidor pessoal.
- Preserve os pedidos do usuário: título de tarefa abre detalhes, conclusão tem controle explícito e recuperação; prazo e dia planejado são a mesma data; Foco/Carga estão incluídos e Gantt está excluído; previsto financeiro não é pagamento realizado.
- Toda entrega deve registrar comandos/resultados reais, nomes/schemas/escopos MCP afetados, aprovações/recibos e evidência de publicação separada da CI. Não marcar preparação, conversa ou telemetria como execução profissional certificada.

## Production deploy memory

- Production deploys through Hostinger's native GitHub repository integration. A push to `main` triggers Hostinger's build and release.
- `.github/workflows/ci.yml` runs quality checks; it does not deploy the app. A failed GitHub Actions test run is separate from Hostinger's deployment status.
- A `401 Unauthenticated` from the Hostinger Codex connector means only that the connector cannot inspect hPanel. It does not mean the GitHub push or production deploy failed. For routine deploy verification, check the public app and its current build assets. Use the Hostinger connector only for account details such as build logs or environment variables; if it returns an auth error without opening sign-in, report it and stop instead of switching to SSH as a workaround.
- Verified release receipt (2026-09): commit `9cdac5120742d0b1dc8058a3879c985cf23d18a7` is on `origin/main`; after its push, the public Planejar page loaded the new shared agenda UI, including the “Atualizar agenda” control and 08:00–20:00 availability summaries. Treat this public UI evidence as confirmation that the feature reached the site; it does not expose Hostinger build logs. Detailed repeatable checks are in `docs/deploy-producao.md`.
- Verified release receipt (2026-09-29): Hostinger hPanel showed `77419ac7ecc6647ff15254a32d6f76c502dbf207` as Completed/Current; the public app exposed the new accessible “Salvar captura” control, Google Calendar stayed connected, and Hermes heartbeat stayed Online. Earlier `81c11c4`, `98ced9e`, and `0adc054` builds had failed. Production builds now use `next build --webpack`: the authenticated failure log showed a Turbopack CSS worker process exiting before connection. Keep this supported build option unless a replacement is verified on Hostinger; do not assume push or green CI alone means published.
