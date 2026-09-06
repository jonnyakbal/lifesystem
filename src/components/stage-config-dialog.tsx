'use client';

// Successor to StatusLabelEditorDialog — this one does real CRUD on the
// stage list (add/remove/reorder/rename), not just relabeling, backed by
// GET/PUT /api/stage-configs/[scope] instead of localStorage.
import { useEffect, useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { DEFAULT_STAGES } from '@/lib/default-stages';
import type { StageDef, StageScope, StageTrigger } from '@/types';

interface StageConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: StageScope;
  /** Given a stage id, how many existing items still use it (blocks deletion if > 0). */
  countUsage: (stageId: string) => number;
  onSaved: (stages: StageDef[]) => void;
}

const TRIGGER_LABELS: Record<'none' | StageTrigger['action'], string> = {
  none: 'Nenhum',
  create_reminder_task: 'Criar tarefa de lembrete',
  create_project: 'Criar projeto',
};

function slugify(label: string): string {
  const base = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return base || `etapa_${Date.now()}`;
}

export function StageConfigDialog({ open, onOpenChange, scope, countUsage, onSaved }: StageConfigDialogProps) {
  const [stages, setStages] = useState<StageDef[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiFetch<{ stages: StageDef[] }>(`/api/stage-configs/${scope}`)
      .then(cfg => setStages(cfg.stages))
      .catch(err => toast.error(showError(err)));
  }, [open, scope]);

  function updateStage(index: number, patch: Partial<StageDef>) {
    setStages(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function moveStage(index: number, direction: -1 | 1) {
    setStages(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addStage() {
    const label = 'Nova etapa';
    setStages(prev => [...prev, { id: slugify(`${label}_${prev.length}`), label, color: 'text-muted-foreground', dot: 'bg-muted-foreground' }]);
  }

  function removeStage(index: number) {
    const stage = stages[index];
    const inUse = countUsage(stage.id);
    if (inUse > 0) {
      toast.error(`${inUse} item${inUse !== 1 ? 's' : ''} ainda ${inUse !== 1 ? 'usam' : 'usa'} essa etapa — mova ${inUse !== 1 ? 'eles' : 'ele'} antes de excluir.`);
      return;
    }
    setStages(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await apiFetch<{ stages: StageDef[] }>(`/api/stage-configs/${scope}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages }),
      });
      onSaved(result.stages);
      onOpenChange(false);
      toast.success('Etapas atualizadas!');
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setStages(DEFAULT_STAGES[scope]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Editar etapas</DialogTitle>
          <DialogDescription>Renomeie, reordene, adicione ou remova etapas. As colunas refletem essa ordem.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-3 overflow-y-auto py-2">
          {stages.map((s, i) => (
            <div key={s.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                <Input value={s.label} onChange={(e) => updateStage(i, { label: e.target.value })} className="h-8" />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={i === 0} onClick={() => moveStage(i, -1)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={i === stages.length - 1} onClick={() => moveStage(i, 1)}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeStage(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 pl-4">
                <Label className="text-xs text-muted-foreground">Ao entrar nessa etapa</Label>
                <Select
                  value={s.trigger?.action || 'none'}
                  onValueChange={(v) => updateStage(i, { trigger: v === 'none' ? undefined : { action: v as StageTrigger['action'] } })}
                >
                  <SelectTrigger className="h-7 w-56 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TRIGGER_LABELS) as (keyof typeof TRIGGER_LABELS)[]).map(k => (
                      <SelectItem key={k} value={k}>{TRIGGER_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={addStage}>
            <Plus className="h-4 w-4" /> Nova etapa
          </Button>
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t pt-4">
          <Button variant="outline" onClick={handleReset}>Restaurar padrão</Button>
          <Button onClick={handleSave} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
