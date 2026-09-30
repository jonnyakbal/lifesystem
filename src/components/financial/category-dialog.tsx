'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import type { FinancialCategory } from '@/lib/financial-categories';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function FinancialCategoryDialog({ category, onClose, onSaved }: { category?: FinancialCategory; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(category?.name || '');
  const [type, setType] = useState(category?.type || 'expense_variable');
  const [color, setColor] = useState(category?.color || '#06b6d4');
  const [archived, setArchived] = useState(category?.archived || false);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (busy) return; setBusy(true);
    try { await apiFetch('/api/financial-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: category?.id, expectedRevision: category?.revision || 0, name, type, color, archived }) }); await onSaved(); onClose(); toast.success('Categoria atualizada. Histórico preservado.'); }
    catch (error) { toast.error(showError(error)); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => !open && !busy && onClose()}><DialogContent><DialogHeader><DialogTitle>{category ? 'Editar categoria' : 'Nova categoria'}</DialogTitle><DialogDescription>Nome e cor se refletem na apresentação. Alterar o tipo vale para novos lançamentos; valores e datas históricos são preservados.</DialogDescription></DialogHeader><div className="space-y-5"><div className="space-y-2"><Label htmlFor="finance-category-name">Nome da categoria</Label><Input id="finance-category-name" value={name} onChange={event => setName(event.target.value)} maxLength={100} /></div><div className="grid grid-cols-[1fr_80px] gap-4"><div className="space-y-2"><Label htmlFor="finance-category-type">Tipo para novos lançamentos</Label><select id="finance-category-type" className="h-11 w-full rounded-lg border bg-background px-3 text-sm" value={type} onChange={event => setType(event.target.value as FinancialCategory['type'])}><option value="income">Receitas</option><option value="expense_fixed">Despesas fixas</option><option value="expense_variable">Despesas variáveis</option></select></div><div className="space-y-2"><Label htmlFor="finance-category-color">Cor</Label><Input id="finance-category-color" type="color" value={color} onChange={event => setColor(event.target.value)} className="h-11" /></div></div><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={archived} onChange={event => setArchived(event.target.checked)} />Arquivar para novos lançamentos</label><p className="text-xs leading-relaxed text-muted-foreground">Categorias arquivadas continuam nos relatórios e nos registros que já as utilizam.</p></div><DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={busy || !name.trim()} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar categoria'}</Button></DialogFooter></DialogContent></Dialog>;
}
