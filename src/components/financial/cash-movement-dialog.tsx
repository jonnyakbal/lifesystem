'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { Account, Bill } from '@/lib/finance-model';
import { apiFetch, showError } from '@/lib/api';
import { formatMoney } from '@/lib/financial-insights';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function CashMovementDialog({ accounts, bill, defaultAccountId, onClose, onSaved }: {
  accounts: Account[];
  bill?: Bill;
  defaultAccountId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [source, setSource] = useState(accounts.find(account => account.id === defaultAccountId)?.id || '');
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const transferId = useRef<string | null>(null);
  const remaining = bill ? bill.amount - (bill.paidAmount || 0) : 0;
  const valid = source && (bill || (destination && source !== destination && Number(amount) > 0));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    try {
      transferId.current ??= globalThis.crypto.randomUUID();
      await apiFetch(bill ? '/api/bills/' + encodeURIComponent(bill.id) : '/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bill ? { accountId: source } : {
          id: transferId.current, fromAccountId: source, toAccountId: destination, amount: Number(amount),
        }),
      });
      onSaved();
    } catch (err) {
      setError(showError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-3xl">
        <DialogTitle className="font-display text-2xl">{bill ? 'Registrar pagamento da fatura' : 'Transferir entre contas'}</DialogTitle>
        <DialogDescription>
          {bill ? 'Registre um pagamento já feito e escolha de qual conta o valor saiu.' :
            'Registre uma transferência já feita. O saldo total das suas contas permanece igual.'}
        </DialogDescription>
        {accounts.length === 0 ? (
          <p className="rounded-xl border border-border p-3 text-sm">Cadastre uma conta ativa para registrar o pagamento.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {bill && <p className="rounded-xl bg-muted/40 p-3 text-sm">Valor restante da fatura <strong className="ml-1 tabular-nums">{formatMoney(remaining)}</strong></p>}
            <div className="grid gap-2">
              <Label htmlFor="cash-movement-source">{bill ? 'Conta pagadora' : 'Conta de origem'}</Label>
              <Select value={source} onValueChange={value => {
                setSource(value);
                if (value === destination) setDestination('');
              }} disabled={saving}>
                <SelectTrigger id="cash-movement-source" className="w-full"><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
                <SelectContent>{accounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>{account.name} · {formatMoney(account.balance)}</SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
            {!bill && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="cash-movement-destination">Conta de destino</Label>
                  <Select value={destination} onValueChange={setDestination} disabled={saving}>
                    <SelectTrigger id="cash-movement-destination" className="w-full"><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
                    <SelectContent>{accounts.filter(account => account.id !== source).map(account => (
                      <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cash-movement-amount">Valor (R$)</Label>
                  <Input id="cash-movement-amount" type="number" inputMode="decimal" min="0.01"
                    max="1000000000" step="0.01" value={amount} onChange={event => setAmount(event.target.value)}
                    disabled={saving} required />
                </div>
              </>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={!valid || saving}>
                {saving ? 'Registrando…' : bill ? 'Confirmar quitação' : 'Registrar transferência'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
