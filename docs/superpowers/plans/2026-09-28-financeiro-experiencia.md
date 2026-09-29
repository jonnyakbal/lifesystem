# Financeiro: clareza antes de complexidade

## Direção aprovada no pedido

Reestruturar a experiência financeira, com identidade astral refinada, mobile como prioridade, gráficos interativos e insights explicáveis. Implementação local para revisão; esta etapa não publica uma nova versão.

## Experiência

- Cabeçalho editorial, navegação entre períodos e ação principal de lançamento.
- Resumo separando recebido/pago de a receber/a pagar. Resultado do período não é saldo bancário.
- Panorama com evolução do resultado, composição das despesas e histórico mensal em Recharts, carregado sob demanda. Cores vêm dos tokens existentes; teclado, tabela alternativa e movimento reduzido fazem parte da interface.
- Insights determinísticos: vencimentos atrasados, compromissos do período e concentração por categoria. Nenhuma previsão inventada, consulta externa ou aconselhamento de investimento.
- Formulário em diálogo acessível, com detalhes opcionais, edição e data de pagamento explícita. Recorrência continua sendo metadado, sem gerar novas ocorrências.
- Lista adaptada a mobile, com filtros e passagem dos gráficos para os lançamentos correspondentes.
- Saldos de contas continuam manuais, com ajuste de valor exato. Não transformar saldos existentes em um livro-caixa sem reconciliação.
- Preservar contas, cartões, faturas, metas, orçamentos e cadastros; corrigir falhas encontradas no caminho.

## Contrato dos números

Previsto: `dueDate || date`. Realizado: `paidDate || date`, exclusivamente quando `status === 'paid'`. Cada lançamento entra uma vez. Resultado com previsões = resultado realizado + entradas em aberto − saídas em aberto. Isso não inclui saldo manual das contas. Faturas continuam um controle separado e não são somadas aos lançamentos novamente.

Orçamentos são mensais, com tipo de despesa explícito. Atraso derivado do vencimento serve à exibição e não altera registros automaticamente. Valores e séries são agregados em centavos. Sem migração nem exclusão de dados existentes.

## Sequência e evidência

1. Investigar página, APIs, validação, MCP e padrões de testes (concluído).
2. Escrever regressões com fixtures sintéticas para datas, séries, insights, edição, desfazer e navegação.
3. Separar cálculo, gráficos e edição da página; implementar o novo panorama.
4. Refinar listagem, contas e diálogos; tratar erro de carregamento sem exibir um falso zero.
5. Rodar testes, lint, tipos, build e revisar screenshots mobile/desktop com dados fictícios.

## Referências

- https://recharts.github.io/en-US/api/ComposedChart/ — composição, responsividade e camada de acessibilidade.
- https://recharts.github.io/en-US/guide/installation/ — instalação e licença MIT.
- Documentação instalada do Next.js: lazy loading de componentes cliente.
- Referência enviada durante a implementação: https://21st.dev/@sean0205/components/line-charts-1. Adaptada em `src/components/ui/line-charts-1.tsx`, usando os componentes compartilhados existentes e os dados financeiros do app.

## Entrega local e verificações — 29/09/2026

Implementados panorama, filtros interativos a partir dos indicadores e categorias, gráficos/tabela, insights determinísticos, edição/pagamento com data explícita, ajuste exato de saldo e diálogos Radix. Corrigidos payload de desfazer, tipo de orçamento, seleção de cartão/mês da fatura, limites dos dias de fatura, remoção de vencimento via API/MCP e agregação em centavos. Sem alteração de registros existentes, push ou deploy.

Evidências executadas:

- `npx playwright test tests/financial-workspace.spec.ts tests/financial-quick-add.spec.ts tests/financial-insights.spec.ts tests/financial-period.spec.ts tests/mcp-protocol.spec.ts --workers=1`: **32 passed (32.7s)**.
- Teste visual adicional, incluído depois: `npx playwright test tests/financial-workspace.spec.ts -g 'prévia visual' --workers=1`: **1 passed (5.3s)**.
- `npm run lint`: **0 errors, 125 warnings** preexistentes fora dos arquivos alterados. Lint direcionado dos componentes financeiros: saída limpa.
- `npx tsc --noEmit`: **exit 0**.
- `npx next build`: **exit 0**, compilação em 13.6s, TypeScript em 10.6s, 45 páginas geradas. O comando evita o hook de backup do script `npm run build`.
- `git diff --check`: **exit 0**.
- Prévias inspecionadas: `screenshots/financial-redesign-preview.png`, `financial-redesign-mobile.png`, `financial-redesign-light.png`. Apenas fixtures sintéticas, nenhuma leitura de dados financeiros reais.

Limite mantido e explícito na interface: contas/metas são informadas manualmente, e a quitação de faturas é um controle separado. Esta entrega não transforma os saldos existentes em contabilidade reconciliada nem publica uma nova versão.
