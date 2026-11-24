'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch, showError } from '@/lib/api';
import { cardBrandColors, type Account, type Card } from '@/lib/finance-model';

export function FinancialCardDialog({ card, accounts, trigger, onClose, onSaved }: {
  card?: Card;
  accounts: Account[];
  trigger: HTMLElement | null;
  onClose: () => void;
  onSaved: (card: Card) => void;
}) {
  const [name, setName] = useState(card?.name ?? '');
  const [type, setType] = useState<Card['type']>(card?.type ?? 'credit');
  const [brand, setBrand] = useState(card?.brand ?? '');
  const [lastDigits, setLastDigits] = useState(card?.lastDigits ?? '');
  const [limit, setLimit] = useState(card?.limit?.toString() ?? '');
  const [closingDay, setClosingDay] = useState(card?.closingDay?.toString() ?? '');
  const [dueDay, setDueDay] = useState(card?.dueDay?.toString() ?? '');
  const [accountId, setAccountId] = useState(card?.accountId || 'none');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const hasCredit = type !== 'debit';
  const currentAccountMissing = accountId !== 'none' && !accounts.some(account => account.id === accountId);
  const brands = [...new Set([...Object.keys(cardBrandColors), 'Outra', ...(card?.brand ? [card.brand] : [])])];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !name.trim() || !brand || !/^\d{4}$/.test(lastDigits)) return;
    setSaving(true);
    setError('');
    const blank = card ? null : undefined;
    try {
      const saved = await apiFetch<Card>(card ? '/api/cards/' + encodeURIComponent(card.id) : '/api/cards', {
        method: card ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          brand,
          lastDigits,
          accountId: accountId === 'none' ? blank : accountId,
          ...(hasCredit && {
            limit: limit === '' ? blank : Number(limit),
            closingDay: closingDay === '' ? blank : Number(closingDay),
            dueDay: dueDay === '' ? blank : Number(dueDay),
          }),
        }),
      });
      onSaved(saved);
      toast.success(card ? 'Cartão atualizado.' : 'Cartão cadastrado.');
    } catch (err) {
      setError(showError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
      <DialogContent
        className="max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-3xl"
        onCloseAutoFocus={event => {
          event.preventDefault();
          trigger?.focus();
        }}
      >
        <DialogTitle className="font-display text-2xl">{card ? 'Editar cartão' : 'Novo cartão'}</DialogTitle>
        <DialogDescription>
          {card ? 'Atualize os dados do cartão e as regras de fechamento e vencimento.' : 'Cadastre um cartão de crédito, débito ou múltiplo.'}
        </DialogDescription>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="finance-card-name">Nome</Label>
            <Input id="finance-card-name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="finance-card-type">Tipo de cartão</Label>
              <Select value={type} onValueChange={value => setType(value as Card['type'])}>
                <SelectTrigger id="finance-card-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Crédito</SelectItem>
                  <SelectItem value="debit">Débito</SelectItem>
                  <SelectItem value="multiple">Múltiplo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="finance-card-brand">Bandeira</Label>
              <Select value={brand} onValueChange={setBrand} required>
                <SelectTrigger id="finance-card-brand" className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{brands.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="finance-card-digits">Últimos 4 dígitos</Label>
              <Input id="finance-card-digits" inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
                value={lastDigits} onChange={e => setLastDigits(e.target.value.replace(/\D/g, '').slice(0, 4))} required />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="finance-card-account">Conta vinculada</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="finance-card-account" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem conta</SelectItem>
                  {currentAccountMissing && <SelectItem value={accountId}>Conta indisponível</SelectItem>}
                  {accounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {hasCredit && (
            <fieldset className="space-y-3 rounded-xl border p-3">
              <legend className="px-1 text-sm font-medium">Condições do crédito</legend>
              <div className="grid gap-2">
                <Label htmlFor="finance-card-limit">Limite (R$)</Label>
                <Input id="finance-card-limit" type="number" min="0" step="0.01"
                  value={limit} onChange={e => setLimit(e.target.value)} placeholder="Sem limite informado" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="finance-card-closing">Dia de fechamento</Label>
                  <Input id="finance-card-closing" type="number" min="1" max="31"
                    value={closingDay} onChange={e => setClosingDay(e.target.value)} placeholder="1" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="finance-card-due">Dia de vencimento</Label>
                  <Input id="finance-card-due" type="number" min="1" max="31"
                    value={dueDay} onChange={e => setDueDay(e.target.value)} placeholder="10" />
                </div>
              </div>
              {card && <p className="text-xs text-muted-foreground">Alterações no ciclo podem mudar a previsão de compras antigas sem fatura definida.</p>}
            </fieldset>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving || !name.trim() || !brand || lastDigits.length !== 4}>
              {saving ? 'Salvando…' : card ? 'Salvar cartão' : 'Cadastrar cartão'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
