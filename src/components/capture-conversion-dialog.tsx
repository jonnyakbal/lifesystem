'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, showError } from '@/lib/api';
import { todayStr } from '@/lib/utils';
import { toast } from 'sonner';

export type ConversionTarget = 'note' | 'task' | 'content' | 'financial' | 'event' | 'project' | 'edital';
export const conversionTargets: { value: ConversionTarget; label: string }[] = [
  { value: 'note', label: 'Nota' }, { value: 'task', label: 'Tarefa' },
  { value: 'content', label: 'Conteúdo' }, { value: 'financial', label: 'Lançamento financeiro' },
  { value: 'event', label: 'Evento no Google Agenda' },
  { value: 'project', label: 'Projeto' }, { value: 'edital', label: 'Edital' },
];

export function CaptureConversionDialog({ capture, onClose, onConverted }: {
  capture: { id: string; content: string; title?: string } | null;
  onClose: () => void; onConverted: () => void;
}) {
  const [target, setTarget] = useState<ConversionTarget>('task');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(todayStr);
  const [kind, setKind] = useState('expense_variable');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!capture || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const financial = target === 'financial' ? { type: kind, amount: Number(amount.replace(',', '.')), category: category.trim(), date, status: 'pending' } : undefined;
      const event = target === 'event' ? { start: new Date(start).toISOString(), end: new Date(end).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } : undefined;
      await apiFetch(`/api/captures/${capture.id}/convert`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType: target, financial, event }),
      });
      toast.success('Captura convertida com sucesso.'); onConverted(); onClose();
    } catch (err) { setError(showError(err)); }
    finally { lock.current = false; setBusy(false); }
  }

  return <Dialog open={!!capture} onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Dar um destino à captura</DialogTitle><DialogDescription>O conteúdo original será preservado. Escolha como continuar.</DialogDescription></DialogHeader>
      <p className="line-clamp-3 rounded-lg bg-muted p-3 text-sm">{capture?.title || capture?.content.replace(/<[^>]*>/g, ' ')}</p>
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <label className="block space-y-2 text-sm">Destino<select className="h-12 w-full rounded-md border bg-background px-3" value={target} onChange={e => { setTarget(e.target.value as ConversionTarget); setError(''); }}>
            {conversionTargets.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select></label>
          {target === 'financial' && <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">Tipo<select className="h-11 w-full rounded border bg-background px-2" value={kind} onChange={e => setKind(e.target.value)}><option value="expense_variable">Despesa variável</option><option value="expense_fixed">Despesa fixa</option><option value="income">Receita</option></select></label>
            <label className="space-y-1 text-sm">Valor (R$)<Input required inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} /></label>
            <label className="space-y-1 text-sm">Categoria<Input required value={category} onChange={e => setCategory(e.target.value)} /></label>
            <label className="space-y-1 text-sm">Data<Input required type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            <p className="text-xs text-muted-foreground sm:col-span-2">O lançamento será criado como pendente.</p>
          </div>}
          {target === 'event' && <div className="space-y-3">
            <p className="text-sm text-muted-foreground">O evento será criado na agenda principal da conta conectada.</p>
            <Button type="button" variant="outline" onClick={() => router.push('/api/google-calendar/connect')}>Conectar Google Agenda</Button>
            <label className="block space-y-1 text-sm">Início<Input required type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label>
            <label className="block space-y-1 text-sm">Fim<Input required type="datetime-local" min={start} value={end} onChange={e => setEnd(e.target.value)} /></label>
          </div>}
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2"><Button type="button" variant="outline" className="h-11 flex-1" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" className="h-11 flex-1" disabled={busy}>{busy ? 'Convertendo…' : 'Converter captura'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
