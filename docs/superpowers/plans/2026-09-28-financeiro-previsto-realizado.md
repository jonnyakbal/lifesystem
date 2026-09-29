# Meses futuros no Financeiro — plano de implementação

> **Execução:** implementar localmente nesta sessão, sem commit, push, deploy ou alterações externas. O pedido do usuário de 28/09/2026 é a especificação deste plano.

**Objetivo:** navegar por meses completos, lançar despesas futuras e consultar o mesmo resultado pela interface e pelo MCP sem misturar previsão com caixa realizado.

**Arquitetura:** uma função pura define a data efetiva e os totais mensais. A tela e `get_financial_summary` consomem essa função; `date` permanece como data registrada no lançamento, sem migração de dados. A navegação troca o período exibido e nunca gera ocorrências recorrentes.

**Stack:** Next.js 16, React, TypeScript, Playwright, MCP SDK.

## Regra de domínio

- `status === 'paid'`: realizado no mês de `paidDate`, com fallback para `date`.
- `status` pendente, atrasado ou ausente: previsto no mês de `dueDate`, com fallback para `date`.
- Um lançamento entra em apenas um mês e em apenas um grupo; recorrência não cria cópias.
- A data do registro (`date`) não é reescrita quando vencimento ou pagamento mudam.
- Contas e faturas de cartão mantêm seus próprios saldos e ciclos; o resumo de lançamentos não deve somá-las novamente.

## Trabalho e verificação

- [x] Criar `src/lib/financial-period.ts` com data efetiva, limites de mês/trimestre/ano, navegação e totais separados. Testar vencimento futuro, pagamento em outro mês, fallbacks, mês vazio e virada do ano em `tests/financial-period.spec.ts`.
- [x] Usar as funções no filtro e indicadores de `src/app/(dashboard)/financeiro/page.tsx`; mostrar mês/ano, setas e retorno ao mês atual. Aplicar a mesma base a categorias, tendência, orçamento e listagem, preservando o ciclo próprio das faturas de cartão.
- [x] Tornar situação e vencimento claros no lançamento rápido. Criar previsão pendente com `date` de registro e `dueDate` escolhido; registrar `paidDate` somente após ação explícita de pagamento. Testar formulário e navegação em `tests/financial-quick-add.spec.ts`.
- [x] Fazer `get_financial_summary` usar a função compartilhada; descrever `date`, `dueDate`, `paidDate` e `status` nas ferramentas MCP. Testar meses previstos e pagos em `tests/mcp-protocol.spec.ts`.
- [x] Revisar texto e documentação; executar testes relevantes, ESLint e `tsc --noEmit`. Inspecionar o diff e deixar tudo sem commit para revisão.

## Atenção na revisão

1. Pendente sem vencimento deve permanecer no mês de `date`.
2. Pago com vencimento em outro mês deve aparecer apenas no mês de `paidDate`.
3. `overdue` continua previsto, mesmo quando o vencimento já passou.
4. Filtro de trimestre/ano deve cobrir o período inteiro, inclusive dias futuros.
5. Mês futuro vazio deve exibir zero e permitir continuar a navegação.
