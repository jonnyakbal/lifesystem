'use client';

// CRUD for the Notas categories — backed by WikiCollection, an entity +
// full REST API (/api/wiki-collections) that already existed in the
// codebase but was never wired into any real page. Reorder is up/down
// buttons rather than drag-and-drop: same end result, far less risk of a
// fiddly DnD bug inside a modal list.
import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';

export interface WikiCollectionItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

const SWATCHES = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#64748b'];

interface CategoryEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: WikiCollectionItem[];
  onChanged: () => void;
}

export function CategoryEditorDialog({ open, onOpenChange, categories, onChanged }: CategoryEditorDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState(SWATCHES[0]);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('🏷️');
  const [newColor, setNewColor] = useState(SWATCHES[0]);

  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await apiFetch('/api/wiki-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, icon: newIcon || '🏷️', color: newColor, sortOrder: sorted.length }),
      });
      setNewName('');
      setNewIcon('🏷️');
      onChanged();
      toast.success('Categoria criada!');
    } catch (err) { toast.error(showError(err)); }
  }

  function startEdit(cat: WikiCollectionItem) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon);
    setEditColor(cat.color);
  }

  async function saveEdit(id: string) {
    try {
      await apiFetch(`/api/wiki-collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, icon: editIcon, color: editColor }),
      });
      setEditingId(null);
      onChanged();
    } catch (err) { toast.error(showError(err)); }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/wiki-collections/${id}`, { method: 'DELETE' });
      onChanged();
      toast.success('Categoria excluída!');
    } catch (err) { toast.error(showError(err)); }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[target];
    try {
      await Promise.all([
        apiFetch(`/api/wiki-collections/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: b.sortOrder }) }),
        apiFetch(`/api/wiki-collections/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: a.sortOrder }) }),
      ]);
      onChanged();
    } catch (err) { toast.error(showError(err)); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Categorias de Notas</DialogTitle>
          <DialogDescription>Crie, renomeie, mude a cor/ícone, ou reordene.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {sorted.map((cat, i) => (
            <div key={cat.id} className="flex items-center gap-2 rounded-lg border px-2 py-1.5">
              {editingId === cat.id ? (
                <>
                  <Input value={editIcon} onChange={(e) => setEditIcon(e.target.value)} className="h-8 w-12 text-center px-1" maxLength={2} />
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 flex-1" autoFocus />
                  <div className="flex gap-1">
                    {SWATCHES.map((c) => (
                      <button key={c} type="button" onClick={() => setEditColor(c)} className="h-5 w-5 rounded-full border" style={{ backgroundColor: c, borderColor: editColor === c ? '#fff' : 'transparent' }} />
                    ))}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => saveEdit(cat.id)}><Check className="h-3.5 w-3.5 text-money" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                </>
              ) : (
                <>
                  <span className="text-base shrink-0">{cat.icon}</span>
                  <span className="flex-1 text-sm truncate" style={{ color: cat.color }}>{cat.name}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={i === sorted.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => startEdit(cat)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDelete(cat.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </>
              )}
            </div>
          ))}
          {sorted.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma categoria ainda.</p>}
        </div>
        <div className="flex items-center gap-2 border-t pt-3">
          <Input value={newIcon} onChange={(e) => setNewIcon(e.target.value)} className="h-8 w-12 text-center px-1" maxLength={2} placeholder="🏷️" />
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova categoria..." className="h-8 flex-1" onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
          <div className="flex gap-1">
            {SWATCHES.map((c) => (
              <button key={c} type="button" onClick={() => setNewColor(c)} className="h-5 w-5 rounded-full border" style={{ backgroundColor: c, borderColor: newColor === c ? '#fff' : 'transparent' }} />
            ))}
          </div>
          <Button size="sm" className="h-8 shrink-0" onClick={handleCreate}><Plus className="h-3.5 w-3.5" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
