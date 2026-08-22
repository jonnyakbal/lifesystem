'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, Edit2, Target, TrendingUp, Trash2, Flame, Calendar, Plus, ChevronDown } from 'lucide-react';
import { PillarConstellation } from '@/components/pillar-constellation';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PillarAction {
  id: string;
  pillarId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
}

interface Pillar {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  currentStatus: string;
  target: string;
  actions?: PillarAction[];
}

interface JournalEntry {
  id: string;
  pillarChecks: Record<string, number>;
  entryDate: string;
}

const defaultPillars: Omit<Pillar, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Fé & Propósito', description: 'Espiritualidade, direção, por que tudo isso existe', icon: '✨', color: 'stellar', sortOrder: 1, currentStatus: '', target: '' },
  { name: 'Físico / Corpo', description: 'Saúde, alimentação, exercício, sono', icon: '💪', color: 'critical', sortOrder: 2, currentStatus: '', target: '' },
  { name: 'Mente / Conhecimento', description: 'Aprendizado, reflexão, TCC', icon: '🧠', color: 'qty', sortOrder: 3, currentStatus: '', target: '' },
  { name: 'Profissional / Talentos', description: 'Dona Maria, ARCO LABS, ARCO PASS, DJ, projetos', icon: '🚀', color: 'money', sortOrder: 4, currentStatus: '', target: '' },
  { name: 'Dinheiro & Patrimônio', description: 'Finanças, investimentos, fluxo de caixa', icon: '💰', color: 'primary', sortOrder: 5, currentStatus: '', target: '' },
  { name: 'Comunidade', description: 'Relações, rede de contatos, coletivos culturais', icon: '👥', color: 'qty', sortOrder: 6, currentStatus: '', target: '' },
];

const colorMap: Record<string, string> = {
  stellar: '#a78bfa',
  critical: '#ef4444',
  qty: '#3b82f6',
  money: '#22c55e',
  primary: '#a78bfa',
};

const fade = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

function ProgressRing({ value, color, size = 48 }: { value: number; color: string; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const strokeColor = colorMap[color] || '#a78bfa';

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth="4"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

export default function PilaresPage() {
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPillar, setEditingPillar] = useState<Pillar | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('stellar');
  const [editCurrentStatus, setEditCurrentStatus] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [expandedPillarId, setExpandedPillarId] = useState<string | null>(null);
  const [newActionTitle, setNewActionTitle] = useState('');

  const emojiOptions = ['✨', '💪', '🧠', '🚀', '💰', '👥', '❤️', '🎯', '📚', '🎨', '🏠', '🌱', '⚡', '🔥', '💎', '🌟'];
  const colorOptions = ['stellar', 'critical', 'qty', 'money', 'primary'];

  async function loadPillars() {
    const [pillarsRes, journalRes] = await Promise.all([
      fetch('/api/pillars'),
      fetch('/api/journal'),
    ]);
    const pillarsData = await pillarsRes.json();
    const journalData = await journalRes.json();
    setJournalEntries(journalData);

    if (pillarsData.length === 0) {
      for (const pillar of defaultPillars) {
        await fetch('/api/pillars', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pillar),
        });
      }
      const newRes = await fetch('/api/pillars');
      const newData = await newRes.json();
      setPillars(newData);
    } else {
      setPillars(pillarsData);
    }
    setIsLoading(false);
  }

  useEffect(() => { loadPillars(); }, []);

  const pillarStreaks = useMemo(() => {
    const streaks: Record<string, number> = {};
    const sorted = [...journalEntries].sort((a, b) => b.entryDate.localeCompare(a.entryDate));

    for (const pillar of pillars) {
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const entry = sorted.find(e => e.entryDate === dateStr);
        if (entry && entry.pillarChecks?.[pillar.id] && entry.pillarChecks[pillar.id] >= 3) {
          streak++;
        } else if (i > 0) {
          break;
        }
      }
      streaks[pillar.id] = streak;
    }
    return streaks;
  }, [pillars, journalEntries]);

  const pillarProgress = useMemo(() => {
    const map: Record<string, number> = {};
    for (const pillar of pillars) {
      const actionCount = pillar.actions?.length || 0;
      const actionDone = pillar.actions?.filter(a => a.completed).length || 0;
      map[pillar.id] = actionCount > 0 ? Math.round((actionDone / actionCount) * 100) : 0;
    }
    return map;
  }, [pillars]);

  function openEdit(pillar: Pillar) {
    setEditingPillar(pillar);
    setEditName(pillar.name);
    setEditDescription(pillar.description);
    setEditIcon(pillar.icon);
    setEditColor(pillar.color);
    setEditCurrentStatus(pillar.currentStatus || '');
    setEditTarget(pillar.target || '');
    setIsEditorOpen(true);
  }

  async function handleSave() {
    if (!editingPillar) return;
    await fetch(`/api/pillars/${editingPillar.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName, description: editDescription, icon: editIcon, color: editColor,
        currentStatus: editCurrentStatus, target: editTarget,
      }),
    });
    setIsEditorOpen(false);
    loadPillars();
    toast.success('Pilar atualizado!');
  }

  async function handleDelete(id: string) {
    await fetch(`/api/pillars/${id}`, { method: 'DELETE' });
    setIsEditorOpen(false);
    loadPillars();
    toast.success('Pilar excluído!');
  }

  async function saveActions(pillar: Pillar, actions: PillarAction[]) {
    await fetch(`/api/pillars/${pillar.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions }),
    });
    loadPillars();
  }

  async function addAction(pillar: Pillar) {
    const title = newActionTitle.trim();
    if (!title) return;
    const actions = pillar.actions || [];
    const newAction: PillarAction = {
      id: crypto.randomUUID(),
      pillarId: pillar.id,
      title,
      completed: false,
      sortOrder: actions.length,
    };
    await saveActions(pillar, [...actions, newAction]);
    setNewActionTitle('');
    toast.success('Ação adicionada!');
  }

  async function toggleAction(pillar: Pillar, actionId: string) {
    const actions = (pillar.actions || []).map(a =>
      a.id === actionId ? { ...a, completed: !a.completed } : a
    );
    await saveActions(pillar, actions);
  }

  async function deleteAction(pillar: Pillar, actionId: string) {
    const actions = (pillar.actions || []).filter(a => a.id !== actionId);
    await saveActions(pillar, actions);
    toast.success('Ação removida!');
  }

  return (
    <motion.div
      className="p-8"
      variants={stagger}
      initial="initial"
      animate="animate"
    >
      <motion.div className="mb-6" variants={fade}>
        <h1 className="font-display text-3xl font-bold tracking-tight">Pilares</h1>
        <p className="text-muted-foreground">
          As 6 áreas fundamentais da sua vida — sua constelação pessoal, guiada pelos povos das estrelas.
        </p>
      </motion.div>

      {!isLoading && pillars.length > 0 && (
        <motion.div className="mb-8" variants={fade}>
          <PillarConstellation
            pillars={pillars.map(p => ({
              id: p.id,
              name: p.name,
              icon: p.icon,
              colorHex: colorMap[p.color] || '#a78bfa',
              strength: pillarProgress[p.id] || 0,
            }))}
            onSelect={(id) => {
              setExpandedPillarId(id);
              document.getElementById(`pillar-card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />
          <p className="mt-2 text-center text-[11px] text-muted-foreground/60">
            Cada estrela é um Pilar — quanto mais fraca a luz, mais esse lado da constelação está pedindo atenção.
          </p>
        </motion.div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <Skeleton className="h-4 w-full mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" variants={stagger}>
          {pillars.map((pillar) => {
            const actionCount = pillar.actions?.length || 0;
            const actionDone = pillar.actions?.filter(a => a.completed).length || 0;
            const progress = actionCount > 0 ? Math.round((actionDone / actionCount) * 100) : 0;
            const streak = pillarStreaks[pillar.id] || 0;

            return (
              <motion.div
                key={pillar.id}
                variants={fade}
                whileHover={expandedPillarId !== pillar.id ? { y: -4, scale: 1.01 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Card id={`pillar-card-${pillar.id}`} className={cn(
                  "group relative h-full scroll-mt-24 transition-all hover:border-primary/50 hover:shadow-md hover:shadow-primary/5",
                  expandedPillarId === pillar.id && "border-primary/50 shadow-md shadow-primary/5"
                )}>
                  <div
                    className="cursor-pointer select-none"
                    onClick={() => {
                      setExpandedPillarId(expandedPillarId === pillar.id ? null : pillar.id);
                      setNewActionTitle('');
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <motion.span
                            className="text-2xl"
                            whileHover={{ scale: 1.2, rotate: -8 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                          >
                            {pillar.icon}
                          </motion.span>
                          <CardTitle className="text-lg">{pillar.name}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          {actionCount > 0 && (
                            <div className="relative">
                              <ProgressRing value={progress} color={pillar.color} size={40} />
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                                {progress}%
                              </span>
                            </div>
                          )}
                          <motion.div
                            animate={{ rotate: expandedPillarId === pillar.id ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-muted-foreground"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </motion.div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); openEdit(pillar); }}
                              >
                                <Edit2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      <CardDescription>{pillar.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 mb-3">
                        {streak > 0 && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Flame className="h-3 w-3 text-orange-500" />
                            {streak} dia{streak > 1 ? 's' : ''} seguidos
                          </Badge>
                        )}
                        {actionCount > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {actionDone}/{actionCount} ações
                          </Badge>
                        )}
                      </div>

                      {pillar.currentStatus && (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Target className="h-3 w-3" />
                            Situação atual
                          </div>
                          <p className="mt-1 text-sm">{pillar.currentStatus}</p>
                        </div>
                      )}

                      {pillar.target && (
                        <div>
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <TrendingUp className="h-3 w-3" />
                            Meta
                          </div>
                          <p className="mt-1 text-sm">{pillar.target}</p>
                        </div>
                      )}
                    </CardContent>
                  </div>

                  <AnimatePresence initial={false}>
                    {expandedPillarId === pillar.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 pt-0">
                          <div className="flex items-center gap-2 mb-3 pt-3 border-t">
                            <Input
                              value={newActionTitle}
                              onChange={(e) => setNewActionTitle(e.target.value)}
                              placeholder="Nova ação..."
                              className="flex-1 h-9"
                              onKeyDown={(e) => { if (e.key === 'Enter') addAction(pillar); }}
                            />
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => addAction(pillar)}
                              disabled={!newActionTitle.trim()}
                              className="h-9 shrink-0"
                            >
                              <Plus className="h-4 w-4 mr-1" /> Adicionar
                            </Button>
                          </div>

                          <div className="space-y-1">
                            <AnimatePresence initial={false}>
                              {(pillar.actions || []).map((action) => (
                                <motion.div
                                  key={action.id}
                                  initial={{ opacity: 0, y: -8, height: 0 }}
                                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                                  exit={{ opacity: 0, x: -20, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 group/action"
                                >
                                  <Switch
                                    checked={action.completed}
                                    onCheckedChange={() => toggleAction(pillar, action.id)}
                                    className="shrink-0"
                                  />
                                  <span className={cn(
                                    "flex-1 text-sm transition-all",
                                    action.completed && "line-through text-muted-foreground"
                                  )}>
                                    {action.title}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover/action:opacity-100 transition-opacity shrink-0"
                                    onClick={() => deleteAction(pillar, action.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </motion.div>
                              ))}
                            </AnimatePresence>

                            {(!pillar.actions || pillar.actions.length === 0) && (
                              <p className="text-xs text-muted-foreground text-center py-3">
                                Nenhuma ação ainda. Adicione uma acima.
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Edit Modal */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Pilar</DialogTitle>
            <DialogDescription>Altere as informações do pilar</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2">
                {emojiOptions.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setEditIcon(emoji)}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg border-2 text-xl transition-all',
                      editIcon === emoji ? 'border-primary bg-primary/10 scale-110' : 'border-border hover:border-muted-foreground/50'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome do pilar" />
            </div>

            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Descreva o pilar" rows={2} />
            </div>

            <div className="grid gap-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {colorOptions.map(color => (
                  <button
                    key={color}
                    onClick={() => setEditColor(color)}
                    className={cn(
                      'h-8 w-8 rounded-full border-2 transition-all',
                      editColor === color ? 'border-white scale-110' : 'border-transparent',
                      color === 'stellar' && 'bg-stellar',
                      color === 'critical' && 'bg-critical',
                      color === 'qty' && 'bg-qty',
                      color === 'money' && 'bg-money',
                      color === 'primary' && 'bg-primary',
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Situação Atual</Label>
              <Textarea value={editCurrentStatus} onChange={(e) => setEditCurrentStatus(e.target.value)} placeholder="Como está este pilar agora?" rows={2} />
            </div>

            <div className="grid gap-2">
              <Label>Meta</Label>
              <Textarea value={editTarget} onChange={(e) => setEditTarget(e.target.value)} placeholder="Qual é a meta para este pilar?" rows={2} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            {editingPillar && (
              <Button variant="destructive" onClick={() => handleDelete(editingPillar.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!editName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
