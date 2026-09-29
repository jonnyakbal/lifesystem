# Períodos, previsões e pagamentos no Financeiro

O Financeiro mostra o mês, trimestre ou ano completo selecionado, inclusive datas futuras. As setas avançam e voltam pelo período; **Mês atual** retorna ao presente. O saldo das contas é o saldo atual cadastrado e não muda apenas por navegar no calendário.

Cada lançamento é contado uma vez em um único mês:

| Situação | Mês exibido | Coluna do resumo |
| --- | --- | --- |
| `paid` | `paidDate`, ou `date` quando não existe data de pagamento | Realizado |
| `pending` ou `overdue` | `dueDate`, ou `date` quando não existe vencimento | Previsto |
| Sem `status` em registros antigos | `dueDate`, ou `date` | Previsto |

`date` registra o dia original do lançamento; informar um vencimento ou pagar não reescreve esse campo. O lançamento rápido começa em **Previsto**. Selecionar **Pago** ou **Recebido** registra `paidDate` como hoje. Depois de salvar, a tela abre o período em que o lançamento será mostrado. Ao marcar um lançamento existente como pago, o dia do pagamento passa a ser hoje; ao devolvê-lo para pendente, `paidDate` é limpo. Não são geradas ocorrências recorrentes adicionais.

Os cartões **Recebido**, **Despesas pagas** e **Resultado realizado** somam apenas lançamentos pagos. A faixa **A receber/A pagar · previsto** soma apenas pendentes e atrasados. A lista e os gráficos usam a data efetiva acima. Orçamentos mostram gasto realizado e previsão separadamente; o ciclo de faturas de cartão continua agrupando compras pela data da compra e não é somado novamente ao resumo de lançamentos.

O MCP `get_financial_summary` aplica a mesma regra e devolve `realized`, `projected` e a quantidade de lançamentos do mês. Clientes como o Hermes devem enviar `date` como data do registro, `dueDate` como vencimento, `status: pending` para previsão ou `status: paid` para pagamento, e `paidDate` quando o pagamento efetivamente ocorreu. Para registros sem vencimento ou data de pagamento, a consulta usa `date` sem alterar dados existentes.
