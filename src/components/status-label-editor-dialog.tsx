'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { loadStatusLabelOverrides, saveStatusLabelOverrides, type StatusLabelScope } from '@/lib/status-labels';

export interface StatusLabelDef {
  id: string;
  defaultLabel: string;
  dotClassName?: string;
}

interface StatusLabelEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: StatusLabelScope;
  statuses: StatusLabelDef[];
  onSaved: () => void;
}

// Just renames — no add/remove/reorder. That's the whole point: the columns
// and their internal ids stay exactly as they are, only the text changes.
export function StatusLabelEditorDialog({ open, onOpenChange, scope, statuses, onSaved }: StatusLabelEditorDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const overrides = loadStatusLabelOverrides(scope);
    const initial: Record<string, string> = {};
    for (const s of statuses) initial[s.id] = overrides[s.id] || s.defaultLabel;
    setValues(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scope]);

  function handleSave() {
    const overrides: Record<string, string> = {};
    for (const s of statuses) {
      const trimmed = (values[s.id] || '').trim();
      if (trimmed && trimmed !== s.defaultLabel) overrides[s.id] = trimmed;
    }
    saveStatusLabelOverrides(scope, overrides);
    onSaved();
    onOpenChange(false);
    toast.success('Rótulos atualizados!');
  }

  function handleReset() {
    const reset: Record<string, string> = {};
    for (const s of statuses) reset[s.id] = s.defaultLabel;
    setValues(reset);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar rótulos de status</DialogTitle>
          <DialogDescription>Só o texto exibido muda — as colunas continuam as mesmas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {statuses.map(s => (
            <div key={s.id} className="grid gap-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {s.dotClassName && <span className={`h-2 w-2 rounded-full ${s.dotClassName}`} />}
                {s.defaultLabel}
              </Label>
              <Input
                value={values[s.id] ?? ''}
                onChange={(e) => setValues(v => ({ ...v, [s.id]: e.target.value }))}
                placeholder={s.defaultLabel}
              />
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReset}>Restaurar padrão</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
