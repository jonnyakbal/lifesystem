# Movimentações entre contas e quitação de faturas

**Objetivo** — Exibir a última conferência do saldo e registrar transferências e quitações com os saldos das contas atualizados.

1. Registrar a data quando o saldo for informado. Manter contas antigas sem uma data simulada.
2. Usar uma única atualização da coleção de contas para transferência e recibo. Identificar repetição pelo identificador da operação.
3. Registrar o valor restante da fatura na conta pagadora. Guardar o débito por identificador de fatura para retomar a quitação em caso de falha e preservar o resumo de receitas e despesas.
4. Integrar os formulários e o histórico às abas Contas e Cartões e faturas.
5. Validar com dados sintéticos, conferir o commit remoto e verificar a aplicação após o deploy nativo da Hostinger.
