'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, TrendingUp, TrendingDown, Minus, Plus, Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pillar } from '@/types';

interface Indicator {
  id: string;
  pillarId: string;
  name: string;
  type: 'count' | 'boolean' | 'scale' | 'currency' | 'percentage';
  targetValue?: number;
  currentValue?: number;
  frequency: string;
  history?: number[];
}

const fade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

function Sparkline({ data, className, color }: { data: number[]; className?: string; color?: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 100;
  const height = 32;
  const padding = 2;
  const strokeColor = color || "hsl(var(--primary))";

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn('w-full h-8', className)}>
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function IndicadoresPage() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);

  const [newName, setNewName] = useState('');
  const [newPillar, setNewPillar] = useState('');
  const [newType, setNewType] = useState<Indicator['type']>('count');
  const [newTarget, setNewTarget] = useState('');
  const [newFrequency, setNewFrequency] = useState('Diário');

  const [editName, setEditName] = useState('');
  const [editPillar, setEditPillar] = useState('');
  const [editType, setEditType] = useState<Indicator['type']>('count');
  const [editTarget, setEditTarget] = useState('');
  const [editFrequency, setEditFrequency] = useState('Diário');
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/pillars').then(r => r.json()),
      fetch('/api/indicators').then(r => r.json()),
    ]).then(([pillarsData, indicatorsData]) => {
      const sortedPillars = pillarsData.sort((a: Pillar, b: Pillar) => a.sortOrder - b.sortOrder);
      setPillars(sortedPillars);
      if (sortedPillars.length > 0) {
        setNewPillar(sortedPillars[0].id);
        setEditPillar(sortedPillars[0].id);
      }
      const normalized = indicatorsData.map((i: Indicator) => ({
        ...i,
        history: i.history || [],
      }));
      setIndicators(normalized);
      setIsLoading(false);
    });
  }, []);

  async function loadIndicators() {
    const res = await fetch('/api/indicators');
    const data = await res.json();
    const normalized = data.map((i: Indicator) => ({
      ...i,
      history: i.history || [],
    }));
    setIndicators(normalized);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await fetch('/api/indicators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName, pillarId: newPillar, type: newType,
        targetValue: newTarget ? parseFloat(newTarget) : undefined,
        currentValue: 0, frequency: newFrequency, history: [],
      }),
    });
    setNewName(''); setNewTarget('');
    setIsDialogOpen(false);
    loadIndicators();
    toast.success('Indicador criado!');
  }

  function openEdit(indicator: Indicator) {
    setEditingIndicator(indicator);
    setEditName(indicator.name);
    setEditPillar(indicator.pillarId);
    setEditType(indicator.type);
    setEditTarget(indicator.targetValue?.toString() || '');
    setEditFrequency(indicator.frequency);
    setEditValue(indicator.currentValue?.toString() || '0');
    setIsEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingIndicator) return;
    const newVal = parseFloat(editValue) || 0;
    const history = [...(editingIndicator.history || []), newVal].slice(-12);
    await fetch(`/api/indicators/${editingIndicator.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName, pillarId: editPillar, type: editType,
        targetValue: editTarget ? parseFloat(editTarget) : undefined,
        currentValue: newVal, frequency: editFrequency, history,
      }),
    });
    setIsEditOpen(false);
    loadIndicators();
    toast.success('Indicador atualizado!');
  }

  async function handleDelete(id: string) {
    await fetch(`/api/indicators/${id}`, { method: 'DELETE' });
    setIsEditOpen(false);
    loadIndicators();
    toast.success('Indicador excluído!');
  }

  async function handleIncrement(indicator: Indicator, delta: number) {
    const newVal = Math.max(0, (indicator.currentValue || 0) + delta);
    const history = [...(indicator.history || []), newVal].slice(-12);
    await fetch(`/api/indicators/${indicator.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentValue: newVal, history }),
    });
    loadIndicators();
  }

  return (
    <motion.div
      className="p-8"
      variants={stagger}
      initial="initial"
      animate="animate"
    >
      <motion.div className="mb-8 flex items-center justify-between" variants={fade}>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Metas</h1>
          <p className="text-muted-foreground">Métricas e metas pessoais por pilar</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nova Meta
          </Button>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Nova Meta</DialogTitle>
                <DialogDescription>Crie uma nova métrica ou meta pra acompanhar.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Nome</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Litros de água" />
                </div>
                <div className="grid gap-2">
                  <Label>Pilar</Label>
                  <Select value={newPillar} onValueChange={setNewPillar}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {pillars.map(p => <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Tipo</Label>
                  <Select value={newType} onValueChange={(v) => setNewType(v as Indicator['type'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="count">Contador</SelectItem>
                      <SelectItem value="boolean">Sim/Não</SelectItem>
                      <SelectItem value="scale">Escala (1-10)</SelectItem>
                      <SelectItem value="currency">Moeda</SelectItem>
                      <SelectItem value="percentage">Porcentagem</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Meta (opcional)</Label>
                  <Input type="number" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} placeholder="Ex: 8" />
                </div>
                <div className="grid gap-2">
                  <Label>Frequência</Label>
                  <Select value={newFrequency} onValueChange={setNewFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Diário">Diário</SelectItem>
                      <SelectItem value="Semanal">Semanal</SelectItem>
                      <SelectItem value="Mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!newName.trim()}>Criar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>

      <div className="space-y-8">
        {isLoading ? (
          pillars.length > 0 ? (
            pillars.map((pillar) => (
              <div key={pillar.id}>
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-xl">{pillar.icon}</span>
                  <Skeleton className="h-5 w-40" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i}><CardContent className="p-4">
                      <Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-16 mb-2" /><Skeleton className="h-2 w-full" />
                    </CardContent></Card>
                  ))}
                </div>
              </div>
            ))
          ) : (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="mb-4 flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded" />
                  <Skeleton className="h-5 w-40" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 2 }).map((_, j) => (
                    <Card key={j}><CardContent className="p-4">
                      <Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-16 mb-2" /><Skeleton className="h-2 w-full" />
                    </CardContent></Card>
                  ))}
                </div>
              </div>
            ))
          )
        ) : (
          pillars.map((pillar) => {
            const pillarIndicators = indicators.filter(i => i.pillarId === pillar.id);
            return (
              <motion.div key={pillar.id} variants={fade}>
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-xl">{pillar.icon}</span>
                  <h2 className="font-display text-lg font-semibold">{pillar.name}</h2>
                  <Badge variant="secondary" className="ml-1">{pillarIndicators.length}</Badge>
                </div>
                 {pillarIndicators.length === 0 ? (
                   <Card className="border-dashed">
                     <CardContent className="flex flex-col items-center justify-center py-8">
                       <BarChart3 className="h-10 w-10 text-muted-foreground/30 empty-state-icon mb-2" />
                       <p className="text-sm text-muted-foreground text-center">Nenhuma meta neste pilar</p>
                       <p className="text-xs text-muted-foreground/50 text-center mt-1">Clique em "Nova Meta" para começar</p>
                     </CardContent>
                   </Card>
                 ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence>
                      {pillarIndicators.map((indicator) => {
                        const progress = indicator.targetValue
                          ? ((indicator.currentValue || 0) / indicator.targetValue) * 100
                          : 0;
                        const trend = progress >= 80 ? 'up' : progress >= 50 ? 'stable' : 'down';
                        const trendColors = {
                          up: 'hsl(162 80% 58%)',
                          stable: 'hsl(262 90% 70%)',
                          down: 'hsl(350 88% 64%)',
                        };
                        return (
                          <motion.div
                            key={indicator.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                          >
                            <Card className="group cursor-pointer indicator-card transition-all hover:border-primary/50 hover:shadow-md hover:shadow-primary/5" onClick={() => openEdit(indicator)}>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">{indicator.name}</span>
                                  <div className="flex items-center gap-1">
                                    {trend === 'up' && <TrendingUp className="h-4 w-4 text-money" />}
                                    {trend === 'down' && <TrendingDown className="h-4 w-4 text-critical" />}
                                    {trend === 'stable' && <Minus className="h-4 w-4 text-primary" />}
                                    <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </div>
                                <div className="mt-2 flex items-end justify-between">
                                  <div className="text-2xl font-bold font-mono-num">
                                    {indicator.currentValue || 0}
                                    {indicator.targetValue && (
                                      <span className="text-sm font-normal text-muted-foreground"> / {indicator.targetValue}</span
>
                                    )}
                                  </div>
                                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleIncrement(indicator, -1)}>
                                      <span className="text-lg leading-none">−</span>
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleIncrement(indicator, 1)}>
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <Progress value={Math.min(progress, 100)} className="mt-2 h-2 indicator-progress-bar" />
                                {indicator.history && indicator.history.length >= 2 && (
                                  <div className="mt-2">
                                    <Sparkline data={indicator.history} color={trendColors[trend]} />
                                  </div>
                                )}
                                <div className="mt-2 flex items-center justify-between">
                                  <Badge variant="outline" className="text-xs">{indicator.frequency}</Badge>
                                  {indicator.targetValue && (
                                    <span className={cn("text-xs font-medium", 
                                      trend === 'up' ? "text-money" : 
                                      trend === 'down' ? "text-critical" : 
                                      "text-primary"
                                    )}>{Math.round(progress)}%</span>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Meta</DialogTitle>
            <DialogDescription>Altere os dados e registre um novo valor</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Pilar</Label>
              <Select value={editPillar} onValueChange={setEditPillar}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pillars.map(p => <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as Indicator['type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Contador</SelectItem>
                  <SelectItem value="boolean">Sim/Não</SelectItem>
                  <SelectItem value="scale">Escala (1-10)</SelectItem>
                  <SelectItem value="currency">Moeda</SelectItem>
                  <SelectItem value="percentage">Porcentagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Valor Atual</Label>
              <Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Meta</Label>
              <Input type="number" value={editTarget} onChange={(e) => setEditTarget(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="grid gap-2">
              <Label>Frequência</Label>
              <Select value={editFrequency} onValueChange={setEditFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Diário">Diário</SelectItem>
                  <SelectItem value="Semanal">Semanal</SelectItem>
                  <SelectItem value="Mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editingIndicator && (
              <Button variant="destructive" onClick={() => handleDelete(editingIndicator.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
