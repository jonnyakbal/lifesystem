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
  categories,
  recurringLabels,
  type Account,
  type FinancialEntry,
  type RecurringType,
} from '@/lib/finance-model';
import { effectiveFinancialDate } from '@/lib/financial-period';
import { toast } from 'sonner';

interface Props {
  entry?: FinancialEntry;
  entries: FinancialEntry[];
  accounts: Account[];
  selectedMonth: string;
  onClose: () => void;
  onSaved: (month: string) => void;
}

export function EntryDialog({
  entry,
  entries,
  accounts,
  selectedMonth,
  onClose,
  onSaved,
}: Props) {
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
  const [payee, setPayee] = useState(entry?.payee || '');
  const [frequency, setFrequency] = useState<RecurringType>(
    entry?.recurring && entry.recurring !== 'none'
      ? entry.recurringFrequency ||
          (typeof entry.recurring === 'string' ? entry.recurring : 'monthly')
      : 'none'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isPaid = status === 'paid';
  const categoryOptions = [
    ...new Set([
      ...categories[type],
      ...entries.filter((e) => e.type === type).map((e) => e.category),
    ]),
  ];
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
    if (!isPaid && !dueDate && !entry && selectedMonth !== today.slice(0, 7)) {
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
      date: entry?.date || today,
      status,
      dueDate: dueDate || (entry ? null : undefined),
      paidDate: isPaid ? paidDate : entry ? null : undefined,
      accountId: accountId === 'none' ? (entry ? '' : undefined) : accountId,
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
      onSaved(effectiveFinancialDate(data).slice(0, 7));
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
          <div
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="entry-type">Movimentação</Label>
              <Select
                value={type}
                onValueChange={(v) => {
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
              <Select value={category} onValueChange={setCategory}>
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
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que foi?"
              className="h-11"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
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
