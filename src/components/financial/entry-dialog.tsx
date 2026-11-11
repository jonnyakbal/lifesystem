'use client';

import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch, showError } from '@/lib/api';
import { cn, todayStr } from '@/lib/utils';
import {
  recurringLabels,
  type Account,
  type Card,
  type FinancialEntry,
  type RecurringType,
} from '@/lib/finance-model';
import { useCategoryCatalog } from './use-category-catalog';
import { descriptionSuggestions, suggestionFor } from '@/lib/financial-suggestions';
import { installmentPlan, invoiceCycle, MAX_INSTALLMENTS } from '@/lib/card-invoice';
import { effectiveFinancialDate } from '@/lib/financial-period';
import { toast } from 'sonner';

interface Props {
  entry?: FinancialEntry;
  entries: FinancialEntry[];
  accounts: Account[];
  cards: Card[];
  initialCardId?: string;
  selectedMonth: string;
  onClose: () => void;
  onSaved: (month: string) => void;
}

const br = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7);
const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function EntryDialog({
  entry,
  entries,
  accounts,
  cards,
  initialCardId,
  selectedMonth,
  onClose,
  onSaved,
}: Props) {
  const { categories, catalog } = useCategoryCatalog();
  const today = todayStr();
  const [type, setType] = useState<FinancialEntry['type']>(
    entry?.type || 'expense_variable'
  );
  const [status, setStatus] = useState<'paid' | 'pending'>(
    entry?.status === 'paid' ? 'paid' : 'pending'
  );
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '');
  const [category, setCategory] = useState(entry?.category || '');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState(entry?.description || '');
  const [dueDate, setDueDate] = useState(entry?.dueDate || '');
  const [paidDate, setPaidDate] = useState(
    entry?.paidDate || (entry?.status === 'paid' ? entry.date : today)
  );
  const [accountId, setAccountId] = useState(entry?.accountId || 'none');
  const [cardId, setCardId] = useState(
    entry?.cardId || initialCardId || 'none'
  );
  const [payee, setPayee] = useState(entry?.payee || '');
  const [frequency, setFrequency] = useState<RecurringType>(
    entry?.recurring && entry.recurring !== 'none'
      ? entry.recurringFrequency ||
          (typeof entry.recurring === 'string' ? entry.recurring : 'monthly')
      : 'none'
  );
  const [purchaseDate, setPurchaseDate] = useState(entry?.date || today);
  const [installments, setInstallments] = useState('1');
  const [saving, setSaving] = useState(false);
  const selectedCard = cards.find((c) => c.id === cardId);
  const isCredit =
    type !== 'income' &&
    !!selectedCard &&
    (selectedCard.type === 'credit' || selectedCard.type === 'multiple');
  const parcelCount = Math.min(
    MAX_INSTALLMENTS,
    Math.max(1, Math.trunc(Number(installments) || 1))
  );
  const plan =
    isCredit && Number(amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)
      ? entry?.billMonth
        ? [{ ...invoiceCycle(selectedCard!, entry.billMonth), current: 1, total: 1, amount: Number(amount) }]
        : installmentPlan(selectedCard!, purchaseDate, Number(amount), entry ? 1 : parcelCount)
      : [];
  const [error, setError] = useState('');
  const isPaid = !isCredit && status === 'paid';
  const categoryOptions = [
    ...new Set([
      ...categories[type],
      ...entries.filter((e) => e.type === type && !catalog.some(item => item.archived && item.historicalTypes.includes(type) && (item.name === e.category || item.aliases.includes(e.category)))).map((e) => e.category),
      ...(entry?.category && entry.type === type ? [entry.category] : []),
    ]),
  ];
  const knownDescriptions = descriptionSuggestions(entries, type);
  const [learned, setLearned] = useState(false);

  function changeDescription(value: string) {
    setDescription(value);
    if (entry || category) return; // nunca sobrescreve o que você já escolheu
    const hint = suggestionFor(entries, value);
    if (!hint) return;
    setType(hint.type);
    setCategory(hint.category);
    if (hint.cardId && cardId === 'none' && cards.some((c) => c.id === hint.cardId && c.isActive)) setCardId(hint.cardId);
    if (hint.accountId && accountId === 'none' && accounts.some((a) => a.id === hint.accountId && a.isActive)) setAccountId(hint.accountId);
    if (hint.payee && !payee) setPayee(hint.payee);
    if (hint.amount && !amount) setAmount(String(hint.amount));
    if (hint.installments && installments === '1') setInstallments(String(hint.installments));
    setLearned(true);
  }

  const chosenCategory =
    category === '__custom' ? customCategory.trim() : category;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (
      !chosenCategory ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0
    ) {
      setError('Informe uma categoria e um valor maior que zero.');
      return;
    }
    if (!isCredit && !isPaid && !dueDate && !entry && selectedMonth !== today.slice(0, 7)) {
      setError('Informe o vencimento para lançar uma previsão neste mês.');
      return;
    }
    if (isPaid && !paidDate) {
      setError('Informe a data em que o valor foi pago ou recebido.');
      return;
    }
    setSaving(true);
    setError('');
    const data = {
      type,
      category: chosenCategory,
      amount: Number(amount),
      description: description.trim(),
      date: isCredit ? purchaseDate : entry?.date || today,
      status: isCredit ? ('pending' as const) : status,
      dueDate: isCredit ? (entry ? plan[0]?.dueDate : undefined) : dueDate || (entry ? null : undefined),
      ...(isCredit && !entry && parcelCount > 1 ? { installments: parcelCount } : {}),
      paidDate: isPaid ? paidDate : entry ? null : undefined,
      accountId: accountId === 'none' ? (entry ? '' : undefined) : accountId,
      cardId:
        type === 'income' || cardId === 'none'
          ? entry
            ? null
            : undefined
          : cardId,
      payee,
      recurring: frequency !== 'none',
      recurringFrequency: frequency === 'none' ? undefined : frequency,
    };
    try {
      await apiFetch(entry ? `/api/financial/${entry.id}` : '/api/financial', {
        method: entry ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      onSaved(isCredit && plan[0] ? plan[0].dueDate.slice(0, 7) : effectiveFinancialDate(data).slice(0, 7));
      toast.success(
        entry ? 'Lançamento atualizado!' : 'Lançamento adicionado!'
      );
      onClose();
    } catch (err) {
      setError(showError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent
        className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-xl overflow-y-auto rounded-3xl p-5 sm:p-7"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById('financial-new-entry')?.focus();
        }}
      >
        <div className="flex items-start gap-3 pr-7">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {type === 'income' ? (
              <ArrowDownLeft className="h-5 w-5" />
            ) : (
              <ArrowUpRight className="h-5 w-5" />
            )}
          </span>
          <div>
            <DialogTitle className="font-display text-2xl">
              {entry ? 'Editar lançamento' : 'Novo Lançamento'}
            </DialogTitle>
            <DialogDescription className="mt-1">
              Um registro claro. Cada valor no seu momento.
            </DialogDescription>
          </div>
        </div>
        <form
          onSubmit={save}
          aria-label={entry ? 'Editar lançamento' : 'Novo Lançamento'}
          className="space-y-5"
        >
          {!isCredit && <div
            className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1"
            role="group"
            aria-label="Situação do lançamento"
          >
            <button
              type="button"
              aria-pressed={!isPaid}
              onClick={() => setStatus('pending')}
              className={cn(
                'min-h-11 rounded-lg text-sm font-medium',
                !isPaid
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              )}
            >
              Previsto
            </button>
            <button
              type="button"
              aria-pressed={isPaid}
              onClick={() => setStatus('paid')}
              className={cn(
                'flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium',
                isPaid ? 'bg-money/10 text-money' : 'text-muted-foreground'
              )}
            >
              {isPaid && <Check className="h-4 w-4" />}
              {type === 'income' ? 'Recebido' : 'Pago'}
            </button>
          </div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="entry-type">Movimentação</Label>
              <Select
                value={type}
                onValueChange={(v) => {
                  if (v === type) return; // eco do seletor ao mudar o tipo por sugestão
                  setType(v as FinancialEntry['type']);
                  setCategory('');
                }}
              >
                <SelectTrigger id="entry-type" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Entrada</SelectItem>
                  <SelectItem value="expense_fixed">Despesa fixa</SelectItem>
                  <SelectItem value="expense_variable">
                    Despesa variável
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-category">Categoria</Label>
              <Select value={category} onValueChange={(v) => { if (v) setCategory(v); }}>
                <SelectTrigger id="entry-category" className="h-11 w-full">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom">Outra categoria…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {category === '__custom' && (
              <div className="col-span-2 space-y-2">
                <Label htmlFor="entry-custom">Nome da categoria</Label>
                <Input
                  id="entry-custom"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  required
                />
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <Label
              htmlFor="entry-amount"
              className="text-xs text-muted-foreground"
            >
              Valor (R$)
            </Label>
            <Input
              id="entry-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              required
              className="mt-1 h-14 border-0 bg-transparent px-0 font-mono-num text-3xl shadow-none focus-visible:ring-0 md:text-3xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="entry-description">Descrição · opcional</Label>
            <Input
              id="entry-description"
              value={description}
              onChange={(e) => changeDescription(e.target.value)}
              placeholder="O que foi?"
              list="entry-description-options"
              autoComplete="off"
              className="h-11"
            />
            <datalist id="entry-description-options">
              {knownDescriptions.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            {learned && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Preenchido pelo seu último lançamento igual. Confira e ajuste se precisar.
              </p>
            )}
          </div>
          {type !== 'income' && (
            <div className="space-y-2">
              <Label htmlFor="entry-card">Cartão usado · opcional</Label>
              <Select value={cardId} onValueChange={setCardId}>
                <SelectTrigger id="entry-card" className="h-11 w-full">
                  <SelectValue placeholder="Sem cartão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cartão</SelectItem>
                  {cards
                    .filter((card) => card.isActive || card.id === cardId)
                    .map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.name} · final {card.lastDigits}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isCredit && (
            <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="entry-purchase-date">Data da compra</Label>
                  <Input
                    id="entry-purchase-date"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    required
                    disabled={!!entry?.installment}
                    className="h-11 min-w-0"
                  />
                </div>
                {!entry && (
                  <div className="space-y-2">
                    <Label htmlFor="entry-installments">Parcelas</Label>
                    <Input
                      id="entry-installments"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max={MAX_INSTALLMENTS}
                      step="1"
                      value={installments}
                      onChange={(e) => setInstallments(e.target.value)}
                      className="h-11 min-w-0"
                    />
                  </div>
                )}
              </div>
              {plan.length > 0 && (
                <div aria-live="polite" className="space-y-1 text-sm">
                  <p>
                    Entra na fatura que fecha em <strong>{br(plan[0].closeDate)}</strong> e
                    vence em <strong>{br(plan[0].dueDate)}</strong>.
                  </p>
                  {plan.length > 1 && (
                    <p className="text-muted-foreground">
                      {plan.length}x de {money(plan[plan.length - 1].amount)}
                      {plan[0].amount !== plan[plan.length - 1].amount && ` (1ª de ${money(plan[0].amount)})`}
                      , até a fatura que vence em {br(plan[plan.length - 1].dueDate)}.
                    </p>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Compra no crédito fica prevista até você pagar a fatura.
              </p>
            </div>
          )}
          {!isCredit && <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entry-due">Vencimento · opcional</Label>
              <Input
                id="entry-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-11 min-w-0"
              />
            </div>
            {isPaid && (
              <div className="space-y-2">
                <Label htmlFor="entry-paid">Data do pagamento</Label>
                <Input
                  id="entry-paid"
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  required
                  className="h-11 min-w-0"
                />
              </div>
            )}
          </div>}
          <details className="rounded-xl border border-border/70 p-3">
            <summary className="cursor-pointer py-1 text-sm text-muted-foreground">
              Mais detalhes
            </summary>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="entry-account">Conta · opcional</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="entry-account" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem conta</SelectItem>
                    {accounts
                      .filter((a) => a.isActive || a.id === accountId)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry-payee">
                  Pessoa ou empresa · opcional
                </Label>
                <Input
                  id="entry-payee"
                  value={payee}
                  onChange={(e) => setPayee(e.target.value)}
                  placeholder="Nome do favorecido"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry-frequency">Frequência</Label>
                <Select
                  value={frequency}
                  onValueChange={(v) => setFrequency(v as RecurringType)}
                >
                  <SelectTrigger id="entry-frequency" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(recurringLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  A frequência identifica este registro. Novas ocorrências não
                  são criadas automaticamente.
                </p>
              </div>
            </div>
          </details>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {isPaid
              ? 'Contabilizado na data do pagamento.'
              : 'A previsão aparece no mês do vencimento.'}{' '}
            O saldo informado da conta permanece manual.
          </p>
          <Button
            type="submit"
            disabled={saving || !chosenCategory || !amount}
            className="h-12 w-full rounded-xl"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {saving
              ? 'Salvando…'
              : entry
                ? 'Salvar alterações'
                : 'Salvar lançamento'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
