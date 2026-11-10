// Motor de faturas de cartão de crédito: regras puras, iguais às do banco.
//
// - A fatura é identificada pelo mês em que FECHA (`YYYY-MM`), como as faturas já gravadas.
// - Compra feita ANTES do dia de fechamento entra na fatura que fecha neste mês; no dia do
//   fechamento ou depois, entra na fatura seguinte ("melhor dia de compra" = dia do fechamento).
// - O vencimento é o primeiro dia de vencimento DEPOIS do fechamento (pode cair no mesmo mês
//   do fechamento, quando o vencimento é maior que o fechamento, ou no mês seguinte).
// - Parcelado: o total é dividido em centavos; a sobra de centavos vai na primeira parcela.
//   A parcela 1 entra na fatura da compra, a 2 na seguinte, e assim por diante.

export interface InvoiceCard {
  closingDay?: number;
  dueDay?: number;
}

export interface InvoiceCycle {
  month: string; // mês de fechamento, YYYY-MM
  closeDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
}

const DEFAULT_CLOSING_DAY = 1;
const DEFAULT_DUE_DAY = 10;
export const MAX_INSTALLMENTS = 48;

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return { y, m };
}

export function shiftMonth(month: string, delta: number) {
  const { y, m } = parseMonth(month);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

function dayIn(month: string, day: number) {
  const { y, m } = parseMonth(month);
  const clamped = Math.min(Math.max(1, Math.trunc(day)), daysInMonth(y, m));
  return `${month}-${String(clamped).padStart(2, '0')}`;
}

/** Datas da fatura que fecha no mês informado. */
export function invoiceCycle(card: InvoiceCard, month: string): InvoiceCycle {
  const closeDate = dayIn(month, card.closingDay || DEFAULT_CLOSING_DAY);
  const dueSameMonth = dayIn(month, card.dueDay || DEFAULT_DUE_DAY);
  const dueDate =
    dueSameMonth > closeDate
      ? dueSameMonth
      : dayIn(shiftMonth(month, 1), card.dueDay || DEFAULT_DUE_DAY);
  return { month, closeDate, dueDate };
}

/** Em qual fatura cai uma compra feita na data informada. */
export function invoiceForPurchase(card: InvoiceCard, date: string): InvoiceCycle {
  const month = date.slice(0, 7);
  const cycle = invoiceCycle(card, month);
  return date < cycle.closeDate ? cycle : invoiceCycle(card, shiftMonth(month, 1));
}

/** Divide o total em parcelas em centavos; a sobra fica na primeira. */
export function splitInstallments(total: number, count: number): number[] {
  const n = Math.min(Math.max(1, Math.trunc(count)), MAX_INSTALLMENTS);
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const rest = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? rest : 0)) / 100);
}

export interface InstallmentPlanItem extends InvoiceCycle {
  current: number;
  total: number;
  amount: number;
}

/** Plano completo: cada parcela com valor e a fatura em que entra. */
export function installmentPlan(
  card: InvoiceCard,
  purchaseDate: string,
  totalAmount: number,
  count: number
): InstallmentPlanItem[] {
  const first = invoiceForPurchase(card, purchaseDate);
  const amounts = splitInstallments(totalAmount, count);
  return amounts.map((amount, i) => ({
    ...invoiceCycle(card, shiftMonth(first.month, i)),
    current: i + 1,
    total: amounts.length,
    amount,
  }));
}

export interface CardPurchaseLike {
  cardId?: string | null;
  type: string;
  date: string;
  billMonth?: string;
}

/** Mês da fatura de um lançamento já gravado (antigos sem billMonth usam a data da compra). */
export function entryInvoiceMonth(entry: CardPurchaseLike, card: InvoiceCard) {
  return entry.billMonth || invoiceForPurchase(card, entry.date).month;
}
