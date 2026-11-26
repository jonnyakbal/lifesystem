'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, CalendarDays, CreditCard, Landmark, MoreHorizontal,
  Pencil, Receipt, Repeat2, Search, Trash2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Account, Card, FinancialEntry } from '@/lib/finance-model';
import { movementDisplayAmount, type FinancialMovement, type InvoiceMovement } from '@/lib/financial-invoice-movements';
import { effectiveFinancialDate, summarizeFinancialEntries } from '@/lib/financial-period';
import { financialDisplayStatus, formatMoney, shortFinancialDate } from '@/lib/financial-insights';
import { cn } from '@/lib/utils';

const statusFilters = [
  ['all', 'Todos'],
  ['paid', 'Realizados'],
  ['open', 'Em aberto'],
  ['pending', 'A vencer'],
  ['overdue', 'Atrasados'],
];
const sortOptions = [
  ['newest', 'Mais recentes'],
  ['oldest', 'Mais antigos'],
  ['highest', 'Maior valor'],
  ['lowest', 'Menor valor'],
];
const columns = 'lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,0.8fr)_minmax(6.5rem,auto)_2.25rem]';

export function FinancialTransactions({
  entries, period, totalInPeriod, focusOnOpen, filterType, filterStatus, categoryFilter, dayFilter,
  categories, accounts, cards, accountFilter, cardFilter, search, today,
  onType, onStatus, onCategory, onAccount, onCard, onSearch, onClear, onClearDay,
  onEdit, onInvoice, onPay, onDelete, onNew,
}: {
  entries: FinancialMovement[];
  period: string;
  totalInPeriod: number;
  focusOnOpen: boolean;
  filterType: string;
  filterStatus: string;
  categoryFilter: string | null;
  dayFilter: string | null;
  categories: string[];
  accounts: Account[];
  cards: Card[];
  accountFilter: string;
  cardFilter: string;
  search: string;
  today: string;
  onType: (value: string) => void;
  onStatus: (value: string) => void;
  onCategory: (value: string | null) => void;
  onAccount: (value: string) => void;
  onCard: (value: string) => void;
  onSearch: (value: string) => void;
  onClear: () => void;
  onClearDay: () => void;
  onEdit: (entry: FinancialEntry) => void;
  onInvoice: (invoice: InvoiceMovement) => void;
  onPay: (entry: FinancialEntry) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const [sortBy, setSortBy] = useState('newest');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnOpen) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'start' });
    }
  }, [focusOnOpen]);
  const summary = useMemo(() => summarizeFinancialEntries(entries), [entries]);
  const ordered = useMemo(() => [...entries].sort((a, b) => {
    const newest = effectiveFinancialDate(b).localeCompare(effectiveFinancialDate(a));
    if (sortBy === 'oldest') return -newest;
    const amount = movementDisplayAmount(b) - movementDisplayAmount(a);
    if (sortBy === 'highest') return amount || newest;
    if (sortBy === 'lowest') return -amount || newest;
    return newest;
  }), [entries, sortBy]);
  const accountNames = useMemo(() => new Map(accounts.map(account => [account.id, account.name])), [accounts]);
  const cardNames = useMemo(() => new Map(cards.map(card => [card.id, card.name])), [cards]);
  const filterCount = [
    filterType !== 'all', filterStatus !== 'all', accountFilter !== 'all', cardFilter !== 'all',
    Boolean(categoryFilter), Boolean(dayFilter), Boolean(search.trim()),
  ].filter(Boolean).length;
  const filtered = filterCount > 0;
  const totals = [
    ['Recebido', summary.realized.income, 'text-money'],
    ['Pago', summary.realized.expenses, 'text-critical'],
    ['A receber', summary.projected.income, 'text-qty'],
    ['A pagar', summary.projected.expenses, 'text-primary'],
  ] as const;

  return (
    <section aria-label="Lista de lançamentos" className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 ref={heading} tabIndex={-1} className="scroll-mt-24 font-display text-3xl tracking-tight focus:outline-none">Lançamentos</h2>
          <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">{period}</p>
        </div>
        <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
          <strong className="text-foreground">{entries.length}{filtered ? ' de ' + totalInPeriod : ''}</strong> {totalInPeriod === 1 ? 'lançamento' : 'lançamentos'}
        </p>
      </header>

      <dl aria-label="Totais dos lançamentos filtrados"
        className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border/70 bg-card/65 sm:grid-cols-4">
        {totals.map(([label, amount, color], index) => (
          <div key={label} className={cn('min-w-0 px-4 py-3', index % 2 === 0 && 'border-r border-border/65',
            index === 1 && 'sm:border-r sm:border-border/65', index > 1 && 'border-t border-border/65 sm:border-t-0')}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={cn('mt-1 break-words text-lg font-semibold tracking-tight tabular-nums', color)}>{formatMoney(amount)}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-card/55 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-40 flex-1">
            <Search aria-hidden className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input aria-label="Buscar lançamentos" value={search} onChange={event => onSearch(event.target.value)}
              placeholder="Buscar lançamentos…" className="h-11 pl-9" />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger aria-label="Ordenar lançamentos" className="h-11 w-auto min-w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{sortOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div role="group" aria-label="Situação dos lançamentos" className="flex flex-wrap items-center gap-1.5">
          {statusFilters.map(([value, label]) => (
            <button type="button" key={value} aria-pressed={filterStatus === value} onClick={() => onStatus(value)}
              className={cn('min-h-9 rounded-full border px-3 text-xs font-medium transition-colors',
                filterStatus === value
                  ? 'border-primary/35 bg-primary/10 text-primary'
                  : 'border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground')}>
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Select value={filterType} onValueChange={onType}>
            <SelectTrigger aria-label="Tipo de lançamento" className="h-10 w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="income">Entradas</SelectItem>
              <SelectItem value="expenses">Todas as despesas</SelectItem>
              <SelectItem value="expense_fixed">Despesas fixas</SelectItem>
              <SelectItem value="expense_variable">Despesas variáveis</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter ? 'category:' + categoryFilter : 'all'} onValueChange={value => onCategory(value === 'all' ? null : value.slice(9))}>
            <SelectTrigger aria-label="Categoria dos lançamentos" className="h-10 w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Categorias</SelectItem>
              {categoryFilter && !categories.includes(categoryFilter) && <SelectItem value={'category:' + categoryFilter}>{categoryFilter}</SelectItem>}
              {categories.map(category => <SelectItem key={category} value={'category:' + category}>{category}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={accountFilter} onValueChange={onAccount}>
            <SelectTrigger aria-label="Conta dos lançamentos" className="h-10 w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              <SelectItem value="none">Sem conta vinculada</SelectItem>
              {accounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cardFilter} onValueChange={onCard}>
            <SelectTrigger aria-label="Cartão dos lançamentos" className="h-10 w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os cartões</SelectItem>
              <SelectItem value="none">Sem cartão vinculado</SelectItem>
              {cards.map(card => <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {filtered && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
            {dayFilter && (
              <Button type="button" variant="outline" size="sm" onClick={onClearDay}
                aria-label={'Remover filtro de ' + shortFinancialDate(dayFilter)} className="rounded-full border-primary/25 text-primary">
                <CalendarDays aria-hidden className="size-3.5" /> {shortFinancialDate(dayFilter)} <X aria-hidden className="size-3.5" />
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
              <X aria-hidden className="size-4" /> Limpar filtros <span aria-hidden className="text-muted-foreground">({filterCount})</span>
            </Button>
          </div>
        )}
      </div>

      {ordered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Receipt aria-hidden className="mx-auto mb-3 size-8 text-muted-foreground/60" />
          <h3 className="text-lg font-medium">Nenhum lançamento</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {filtered ? 'Ajuste os filtros para encontrar outros registros.' : 'Adicione uma entrada ou despesa neste período.'}
          </p>
          <Button variant="outline" onClick={filtered ? onClear : onNew} className="mt-4">
            {filtered ? 'Limpar filtros' : 'Adicionar lançamento'}
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/45">
          <div aria-hidden className={cn('hidden gap-x-3 border-b border-border/70 bg-muted/50 px-4 py-3 text-xs font-medium text-muted-foreground lg:grid', columns)}>
            <span>Descrição</span><span>Conta / cartão</span><span>Data</span><span>Situação</span><span className="text-right">Valor</span><span />
          </div>
          <ul aria-label="Movimentações" className="divide-y divide-border/65">
            {ordered.map(entry => {
              const status = financialDisplayStatus(entry, today);
              const title = entry.description || entry.category;
              const invoice = entry.invoice;
              const income = entry.type === 'income';
              const Direction = invoice ? CreditCard : income ? ArrowDownLeft : ArrowUpRight;
              const date = effectiveFinancialDate(entry);
              const account = entry.accountId ? accountNames.get(entry.accountId) || 'Conta indisponível' : '';
              const card = entry.cardId ? cardNames.get(entry.cardId) || 'Cartão indisponível' : '';
              const dateKind = status === 'paid'
                ? invoice && !invoice.paymentDateKnown ? 'Vencimento de referência' : 'Realizado'
                : entry.dueDate ? 'Vencimento' : 'Previsto';
              const statusLabel = status === 'paid' ? (income ? 'Recebido' : 'Pago') : status === 'overdue' ? 'Atrasado' : 'Previsto';
              return (
                <li key={entry.id} className={cn('group grid grid-cols-[minmax(0,1fr)_auto_2.25rem] items-start gap-x-2 gap-y-2 px-3 py-3 transition-colors hover:bg-muted/30 sm:px-4 lg:items-center lg:gap-x-3', columns)}>
                  <button type="button" aria-label={(invoice ? 'Abrir ' : 'Editar ') + title}
                    onClick={() => invoice ? onInvoice(invoice) : onEdit(entry)}
                    className="col-start-1 row-start-1 flex min-w-0 items-start gap-2.5 rounded-lg text-left">
                    <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg border border-border/60 bg-muted/55', income ? 'text-money' : 'text-muted-foreground')}>
                      <Direction aria-hidden className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-semibold leading-snug group-hover:text-primary">{title}</span>
                      <span className="mt-1 block break-words text-xs leading-snug text-muted-foreground">
                        {entry.category}{entry.payee && ' · ' + entry.payee}
                        {invoice && status !== 'paid' && invoice.paid > 0 && ' · ' + formatMoney(entry.amount) + ' em aberto'}
                        {entry.installment && ' · ' + entry.installment.current + '/' + entry.installment.total}
                        {entry.recurring && <Repeat2 aria-label="Recorrente" className="ml-1.5 inline size-3" />}
                      </span>
                    </span>
                  </button>

                  <div className="col-span-3 col-start-1 row-start-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pl-10 text-xs text-muted-foreground lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:grid lg:pl-0">
                    {account && <span title={account} className="inline-flex min-w-0 items-center gap-1.5"><Landmark aria-hidden className="size-3 shrink-0" /><span className="truncate">{account}</span></span>}
                    {card && <span title={card} className="inline-flex min-w-0 items-center gap-1.5"><CreditCard aria-hidden className="size-3 shrink-0" /><span className="truncate">{card}</span></span>}
                    {!account && !card && <span className="hidden lg:inline">—</span>}
                  </div>

                  <div className="col-start-1 row-start-2 min-w-0 pl-10 text-xs text-muted-foreground lg:col-start-3 lg:row-start-1 lg:pl-0">
                    <time dateTime={date} className="font-medium text-foreground">{shortFinancialDate(date)}</time>
                    <span className="ml-1.5 lg:ml-0 lg:block">{dateKind}</span>
                    {entry.date !== date && <span className="sr-only">Registro em {shortFinancialDate(entry.date)}</span>}
                  </div>

                  <div className="col-span-2 col-start-2 row-start-2 justify-self-end lg:col-span-1 lg:col-start-4 lg:row-start-1 lg:justify-self-start">
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium',
                      status === 'paid' ? 'bg-money/10 text-money' : status === 'overdue' ? 'bg-critical/10 text-critical' : 'bg-primary/10 text-primary')}>
                      <i aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /> {statusLabel}
                    </span>
                  </div>

                  <span className={cn('col-start-2 row-start-1 pt-1 text-right text-sm font-semibold tracking-tight tabular-nums lg:col-start-5 lg:pt-0', income && 'text-money')}>
                    {income ? '+' : '−'} {formatMoney(movementDisplayAmount(entry))}
                  </span>

                  <div className="col-start-3 row-start-1 -mt-1 justify-self-end lg:col-start-6 lg:mt-0">
                    {invoice ? (
                      <Button variant="ghost" size="icon" aria-label={'Ver detalhes de ' + title} className="h-9 w-9"
                        onClick={() => onInvoice(invoice)}>
                        <ArrowUpRight aria-hidden className="size-4" />
                      </Button>
                    ) : <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={'Opções de ' + title} className="h-9 w-9">
                          <MoreHorizontal aria-hidden className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(entry)}><Pencil className="mr-2 size-4" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onPay(entry)}>
                          {status === 'paid' ? 'Devolver a previsto' : income ? 'Registrar recebimento' : 'Registrar pagamento'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(entry.id)}><Trash2 className="mr-2 size-4" /> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
