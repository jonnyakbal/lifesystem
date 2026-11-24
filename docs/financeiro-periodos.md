# Períodos, previsões e pagamentos no Financeiro

O Financeiro mostra o mês, trimestre ou ano completo selecionado, inclusive datas futuras. As setas avançam e voltam pelo período; **Mês atual** retorna ao presente. O saldo das contas é o saldo atual cadastrado e não muda apenas por navegar no calendário.

Cada lançamento é contado uma vez em um único mês:

| Situação | Mês exibido | Coluna do resumo |
| --- | --- | --- |
| `paid` | `paidDate`, ou `date` quando não existe data de pagamento | Realizado |
| `pending` ou `overdue` | `dueDate`, ou `date` quando não existe vencimento | Previsto |
| Sem `status` em registros antigos | `dueDate`, ou `date` | Previsto |

`date` registra o dia original do lançamento; informar um vencimento ou pagar não reescreve esse campo. **Novo lançamento** abre um diálogo que começa em **Previsto**. Selecionar **Pago** ou **Recebido** mostra a data do pagamento, inicialmente hoje e editável. Depois de salvar, a tela abre o período em que o lançamento será mostrado. A ação de pagar um registro existente abre esse mesmo diálogo para confirmar valor e data; ao devolvê-lo para pendente, `paidDate` é limpo. Remover um vencimento envia `dueDate: null` e restaura o fallback em `date`. Não são geradas ocorrências recorrentes adicionais.

Os cartões **Recebido**, **Despesas pagas** e **Resultado realizado** somam apenas lançamentos pagos. A faixa **A receber/A pagar · previsto** soma apenas pendentes e atrasados. A lista e os gráficos usam a data efetiva acima. Orçamentos mostram gasto realizado e previsão separadamente; o ciclo de faturas de cartão continua agrupando compras pela data da compra e não é somado novamente ao resumo de lançamentos.

O MCP `get_financial_summary` aplica a mesma regra e devolve `realized`, `projected` e a quantidade de lançamentos do mês. Clientes como o Hermes devem enviar `date` como data do registro, `dueDate` como vencimento, `status: pending` para previsão ou `status: paid` para pagamento, e `paidDate` quando o pagamento efetivamente ocorreu. Para registros sem vencimento ou data de pagamento, a consulta usa `date` sem alterar dados existentes.

## Panorama e insights

- Os agregados compartilhados com o MCP são calculados em centavos. Isso evita divergências como `0.1 + 0.2`.
- **Resultado com previsões** soma resultado realizado e resultado em aberto. Não inclui o saldo manual das contas e não extrapola gastos futuros.
- **Evolução** mostra o resultado acumulado no período; a linha tracejada inclui as previsões registradas. Degraus representam movimentos nas datas dos lançamentos, sem inventar valores intermediários.
- **6 meses** termina no mês selecionado e separa recebido, pago, a receber e a pagar. Controles permitem abrir cada mês.
- **Para onde vai** alterna despesas pagas e em aberto. Cada categoria abre os lançamentos correspondentes, incluindo a situação selecionada. Todos os valores do gráfico podem ser lidos na tabela de apoio.
- Os insights são cálculos locais, sem envio a IA: atrasos no período, resultado com previsões e maior categoria paga. Atraso é derivado de `dueDate < hoje` ou `status: overdue`; sem vencimento, não se presume atraso. Isso não altera o status armazenado.
- Orçamentos sempre indicam seu mês, mesmo quando a visão principal está em trimestre/ano. O tipo fixo/variável é escolhido no cadastro. Pago e previsto aparecem separadamente.

## Contas, cartões e faturas

**Atualizar saldo** grava o valor informado e a data da conferência. Contas antigas mostram a data a partir da primeira atualização. Lançamentos comuns e previsões continuam separados dos saldos das contas.

**Transferir entre contas** registra uma movimentação já feita. As duas contas são atualizadas juntas e o recibo fica em **Transferências recentes**. O valor líquido no conjunto das contas é zero.

Faturas usam o mês em que fecham. Em **Registrar pagamento**, selecione a conta que pagou o valor restante da fatura. A quitação desconta esse valor da conta escolhida e marca as compras como pagas. O sistema conserva o débito por fatura para retomar uma tentativa interrompida. O registro da quitação evita uma segunda despesa no resumo financeiro.

## Interface e referência

Gráficos com Recharts 3, carregados em um módulo separado. O componente `src/components/ui/line-charts-1.tsx` adapta a referência fornecida de [ReUI / Sean Hello — Line Charts 1](https://21st.dev/@sean0205/components/line-charts-1): marcadores, linhas, área e tooltip configuráveis. Preserva os tokens astral, os componentes Radix/shadcn existentes, suporte a teclado, valores zero no tooltip e movimento reduzido. Não importa dados de demonstração para a aplicação.

Os testes de interface interceptam APIs com registros fictícios; os testes MCP usam um diretório temporário. Screenshots de revisão também contêm apenas dados sintéticos.
