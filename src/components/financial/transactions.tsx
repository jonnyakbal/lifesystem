'use client';

import {
  MoreHorizontal,
  Pencil,
  Receipt,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type FinancialEntry } from '@/lib/finance-model';
import {
  effectiveFinancialDate,
  summarizeFinancialEntries,
} from '@/lib/financial-period';
import {
  financialDisplayStatus,
  formatMoney,
  shortFinancialDate,
} from '@/lib/financial-insights';
import { cn } from '@/lib/utils';

export function FinancialTransactions({
  entries,
  filterType,
  filterStatus,
  categoryFilter,
  search,
  today,
  onType,
  onStatus,
  onSearch,
  onClear,
  onEdit,
  onPay,
  onDelete,
  onNew,
}: {
  entries: FinancialEntry[];
  filterType: string;
  filterStatus: string;
  categoryFilter: string | null;
  search: string;
  today: string;
  onType: (v: string) => void;
  onStatus: (v: string) => void;
  onSearch: (v: string) => void;
  onClear: () => void;
  onEdit: (e: FinancialEntry) => void;
  onPay: (e: FinancialEntry) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const summary = summarizeFinancialEntries(entries);
  const filtered =
    filterType !== 'all' ||
    filterStatus !== 'all' ||
    !!categoryFilter ||
    !!search;
  return (
    <section aria-label="Lista de lançamentos" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">
            Lançamentos{' '}
            <span className="ml-1 font-sans text-sm text-muted-foreground">
              {entries.length}
            </span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Todos os valores do período selecionado, com suas datas e situação.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-card/40 p-3">
        <div className="relative min-w-40 flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Buscar lançamentos"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar descrição, categoria…"
            className="h-11 pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={onType}>
          <SelectTrigger
            aria-label="Tipo de lançamento"
            className="h-11 min-w-32 flex-1 sm:flex-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="income">Entradas</SelectItem>
            <SelectItem value="expenses">Todas as despesas</SelectItem>
            <SelectItem value="expense_fixed">Despesas fixas</SelectItem>
            <SelectItem value="expense_variable">Despesas variáveis</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={onStatus}>
          <SelectTrigger
            aria-label="Situação dos lançamentos"
            className="h-11 min-w-32 flex-1 sm:flex-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            <SelectItem value="paid">Realizados</SelectItem>
            <SelectItem value="open">Em aberto</SelectItem>
            <SelectItem value="pending">A vencer</SelectItem>
            <SelectItem value="overdue">Atrasados</SelectItem>
          </SelectContent>
        </Select>
        {filtered && (
          <Button variant="ghost" className="h-11" onClick={onClear}>
            <X className="mr-1 h-4 w-4" />
            {categoryFilter || 'Limpar filtros'}
          </Button>
        )}
      </div>
      <div
        className="flex flex-wrap gap-x-6 gap-y-2 px-1 text-xs text-muted-foreground"
        aria-label="Totais dos lançamentos filtrados"
      >
        <span>
          Recebido{' '}
          <strong className="ml-1 text-money">
            {formatMoney(summary.realized.income)}
          </strong>
        </span>
        <span>
          Pago{' '}
          <strong className="ml-1 text-critical">
            {formatMoney(summary.realized.expenses)}
          </strong>
        </span>
        <span>
          A receber{' '}
          <strong className="ml-1 text-qty">
            {formatMoney(summary.projected.income)}
          </strong>
        </span>
        <span>
          A pagar{' '}
          <strong className="ml-1 text-primary">
            {formatMoney(summary.projected.expenses)}
          </strong>
        </span>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <Receipt className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          <h3 className="text-lg font-medium">Nenhum lançamento</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {filtered
              ? 'Ajuste os filtros para encontrar outros registros.'
              : 'Comece com uma entrada ou despesa deste período.'}
          </p>
          <Button
            variant="outline"
            onClick={filtered ? onClear : onNew}
            className="mt-5"
          >
            {filtered ? 'Limpar filtros' : 'Adicionar lançamento'}
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
          {entries
            .slice()
            .sort((a, b) =>
              effectiveFinancialDate(b).localeCompare(effectiveFinancialDate(a))
            )
            .map((e) => {
              const status = financialDisplayStatus(e, today);
              const title = e.description || e.category;
              return (
                <li
                  key={e.id}
                  className="group p-4 transition-colors hover:bg-muted/20 sm:px-5"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-1 h-2 w-2 shrink-0 rounded-full',
                        status === 'paid'
                          ? 'bg-money'
                          : status === 'overdue'
                            ? 'bg-critical'
                            : 'bg-primary'
                      )}
                      aria-hidden
                    />
                    <button
                      onClick={() => onEdit(e)}
                      aria-label={`Editar ${title}`}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block break-words text-sm font-medium group-hover:text-primary">
                        {title}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {e.category}
                        {e.payee ? ` · ${e.payee}` : ''}
                      </span>
                    </button>
                    <span
                      className={cn(
                        'shrink-0 text-sm font-semibold tabular-nums sm:text-base',
                        e.type === 'income' ? 'text-money' : 'text-foreground'
                      )}
                    >
                      {e.type === 'income' ? '+' : '−'} {formatMoney(e.amount)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Opções de ${title}`}
                          className="-mr-2 -mt-2 h-10 w-9 shrink-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(e)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onPay(e)}>
                          {status === 'paid'
                            ? 'Devolver a previsto'
                            : e.type === 'income'
                              ? 'Registrar recebimento'
                              : 'Registrar pagamento'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDelete(e.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="ml-5 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-muted-foreground">
                    <span
                      className={cn(
                        'rounded-md px-2 py-1',
                        status === 'paid'
                          ? 'bg-money/10 text-money'
                          : status === 'overdue'
                            ? 'bg-critical/10 text-critical'
                            : 'bg-primary/10 text-primary'
                      )}
                    >
                      {status === 'paid'
                        ? e.type === 'income'
                          ? 'Recebido'
                          : 'Pago'
                        : status === 'overdue'
                          ? 'Atrasado'
                          : 'Previsto'}
                    </span>
                    <span>
                      {status === 'paid'
                        ? 'Realizado'
                        : e.dueDate
                          ? 'Vencimento'
                          : 'Previsto para'}{' '}
                      {shortFinancialDate(effectiveFinancialDate(e))}
                    </span>
                    <span>Registro {shortFinancialDate(e.date)}</span>
                    {e.recurring && <span>Recorrente</span>}
                  </div>
                </li>
              );
            })}
        </ul>
      )}
    </section>
  );
}
