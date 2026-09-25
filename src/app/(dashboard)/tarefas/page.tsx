'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import {
  Plus, CheckCircle2, Circle, Trash2, Search, Copy,
  GripVertical, CalendarDays, X, Tag,
  MoreHorizontal, ListChecks, Subtitles, CheckSquare, Square,
  Save, SlidersHorizontal, Bookmark, Layers, Rows3, Calendar,
  ArrowRight, Flame, Repeat, FileText, Wallet, Edit2, ChevronLeft, ChevronRight, CalendarPlus, Inbox
} from 'lucide-react';
import { cn, todayStr } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { StageConfigDialog } from '@/components/stage-config-dialog';
import type { StageDef } from '@/types';
import { LinkedItemsPanel } from '@/components/linked-items-panel';
import { spawnNextOccurrenceIfRecurring, RECURRING_LABELS, type RecurringFrequency } from '@/lib/recurring';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskChecklistItem { id: string; text: string; done: boolean; }

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'urgent' | 'important' | 'normal';
  status: string;
  projectId?: string;
  pillarId?: string;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
  tags: string[];
  checklist: TaskChecklistItem[];
  sortOrder: number;
  recurring?: boolean;
  recurringFrequency?: RecurringFrequency;
}

interface Project {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  status: string;
}

interface Pillar {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
}

type ViewMode = 'kanban' | 'list' | 'week' | 'calendar';

// Lightweight shapes for the two other entity types the unified calendar
// overlays alongside Task — just enough fields to plot + link out, not a
// full duplicate of their own pages' interfaces.
interface CalendarContentItem { id: string; title: string; channel: string; scheduledDate?: string; linkedTaskIds?: string[]; }
interface CalendarFinancialEntry { id: string; description?: string; category: string; amount: number; type: string; dueDate?: string; status?: string; }
interface LinkedCapture { id: string; title?: string; content?: string; targetType?: string; targetId?: string; }
type GroupBy = 'status' | 'priority' | 'project' | 'pillar';
type SortBy = 'date' | 'title' | 'priority' | 'status' | 'dueDate';

interface SavedView {
  id: string;
  name: string;
  view: ViewMode;
  groupBy: GroupBy;
  sortBy: SortBy;
  search: string;
  filterOverdue: boolean;
  showDone: boolean;
  dense: boolean;
  filterPriority: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const priorityConfig: Record<string, { label: string; color: string; textColor: string; borderColor: string; dot: string }> = {
  urgent: { label: 'Urgente', color: 'bg-destructive', textColor: 'text-destructive', borderColor: 'border-l-destructive', dot: 'bg-destructive' },
  important: { label: 'Importante', color: 'bg-primary', textColor: 'text-primary', borderColor: 'border-l-primary', dot: 'bg-primary' },
  normal: { label: 'Normal', color: 'bg-muted', textColor: 'text-muted-foreground', borderColor: 'border-l-transparent', dot: 'bg-muted-foreground' },
};

const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.04, delayChildren: 0.04 } } };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function isOverdue(task: Task) {
  if (!task.dueDate || task.status === 'done') return false;
  return task.dueDate < todayStr();
}

function getWeekDays(weekOffset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + weekOffset * 7);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDateISO(d: Date) {
  return todayStr(d);
}

function fireConfetti() {
  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
  document.body.appendChild(container);
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 8 + 4;
    const x = Math.random() * 100;
    const delay = Math.random() * 0.3;
    const duration = Math.random() * 1 + 1;
    const rotation = Math.random() * 360;
    el.style.cssText = `position:absolute;top:-10px;left:${x}%;width:${size}px;height:${size}px;background:${color};border-radius:${Math.random() > 0.5 ? '50%' : '2px'};transform:rotate(${rotation}deg);animation:confetti-fall ${duration}s ${delay}s ease-out forwards;`;
    container.appendChild(el);
  }
  const style = document.createElement('style');
  style.textContent = `@keyframes confetti-fall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }`;
  document.head.appendChild(style);
  setTimeout(() => { container.remove(); style.remove(); }, 3000);
}

// ─── Filter Chip ──────────────────────────────────────────────────────────────

function FilterChip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      <span className="text-primary/70">{label}:</span> {value}
      <button onClick={onRemove} className="ml-0.5 hover:text-primary/50 transition-colors"><X className="h-3 w-3" /></button>
    </motion.span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TasksPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [linkedContent, setLinkedContent] = useState<CalendarContentItem[]>([]);
  const [linkedCaptures, setLinkedCaptures] = useState<LinkedCapture[]>([]);
  const [calendarFinancial, setCalendarFinancial] = useState<CalendarFinancialEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // View state
  const [view, setView] = useState<ViewMode>('kanban');
  const [weekOffset, setWeekOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [filterPillar, setFilterPillar] = useState('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [dense, setDense] = useState(false);
  const [stages, setStages] = useState<StageDef[]>([]);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const getStage = (id: string) => stages.find(s => s.id === id);
  const getStatusLabel = (id: string) => getStage(id)?.label || id;

  // Saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState('default');

  // Bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // Drag
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Editor
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Task['priority']>('normal');
  const [newStatus, setNewStatus] = useState<Task['status']>('todo');
  const [newDueDate, setNewDueDate] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newChecklist, setNewChecklist] = useState<TaskChecklistItem[]>([]);
  const [newChecklistInput, setNewChecklistInput] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newPillarId, setNewPillarId] = useState('');
  const [newRecurring, setNewRecurring] = useState(false);
  const [newRecurringFrequency, setNewRecurringFrequency] = useState<RecurringFrequency>('daily');

  // Quick add
  const [quickAddStatus, setQuickAddStatus] = useState<Task['status'] | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  useEffect(() => {
    loadTasks(); loadProjects(); loadPillars(); loadSavedViews(); loadStages();
    // Loaded once for the "Referenciado por" backlinks panel — Content and
    // Captures can point at a Task via linkedTaskIds/targetId, but Task
    // itself doesn't store the reverse link, so it's computed here.
    void apiFetch<CalendarContentItem[]>('/api/content').then(setLinkedContent).catch(() => {});
    void apiFetch<LinkedCapture[]>('/api/captures').then(setLinkedCaptures).catch(() => {});
    // For the unified Calendar view (Fase 5) — Conteúdo agendado e contas a
    // vencer plotados junto das tarefas em vez de precisar abrir 3 telas.
    void apiFetch<CalendarFinancialEntry[]>('/api/financial').then(setCalendarFinancial).catch(() => {});
  }, []);

  // Deep-link support: ⌘K search results for tasks land here with ?open=<id>
  // instead of just the bare page, so search actually jumps to the item.
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || tasks.length === 0) return;
    const task = tasks.find(t => t.id === openId);
    if (task) {
      openEdit(task);
      router.replace('/tarefas');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, searchParams]);

  function getTaskBacklinks(taskId: string) {
    const fromContent = linkedContent
      .filter(c => (c.linkedTaskIds || []).includes(taskId))
      .map(c => ({ id: c.id, type: 'content' as const, title: c.title || 'Sem título' }));
    const fromCaptures = linkedCaptures
      .filter(c => c.targetType === 'task' && c.targetId === taskId)
      .map(c => ({ id: c.id, type: 'capture' as const, title: (c.title || c.content?.replace(/<[^>]*>/g, '').slice(0, 60)) || 'Sem título' }));
    return [...fromContent, ...fromCaptures];
  }

  async function loadTasks() {
    try {
      const data = await apiFetch<Task[]>('/api/tasks');
      setTasks(data);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadProjects() {
    try {
      const data = await apiFetch<Project[]>('/api/projects');
      setProjects(data);
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function loadPillars() {
    try {
      const data = await apiFetch<Pillar[]>('/api/pillars');
      setPillars(data);
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function loadStages() {
    try {
      const data = await apiFetch<{ stages: StageDef[] }>('/api/stage-configs/tasks');
      setStages(data.stages);
    } catch (err) {
      toast.error(showError(err));
    }
  }

  function loadSavedViews() {
    try {
      const stored = localStorage.getItem('lifesystem_task_views');
      if (stored) setSavedViews(JSON.parse(stored));
    } catch {}
  }

  function saveViews(views: SavedView[]) {
    setSavedViews(views);
    localStorage.setItem('lifesystem_task_views', JSON.stringify(views));
  }

  function applyView(v: SavedView) {
    setActiveViewId(v.id);
    setView(v.view);
    setGroupBy(v.groupBy);
    setSortBy(v.sortBy);
    setSearch(v.search);
    setFilterOverdue(v.filterOverdue);
    setShowDone(v.showDone);
    setDense(v.dense);
    setFilterPriority(v.filterPriority);
  }

  function saveCurrentView(name: string) {
    const v: SavedView = {
      id: `tv_${Date.now()}`, name, view, groupBy, sortBy, search,
      filterOverdue, showDone, dense, filterPriority,
    };
    const updated = [...savedViews, v];
    saveViews(updated);
    setActiveViewId(v.id);
    toast.success(`Visão "${name}" salva!`);
  }

  function deleteView(id: string) {
    const updated = savedViews.filter(v => v.id !== id);
    saveViews(updated);
    if (activeViewId === id) setActiveViewId('default');
    toast.success('Visão excluída!');
  }

  // CRUD
  function openCreate() {
    setEditingTask(null);
    setNewTitle('');
    setNewPriority('normal');
    setNewStatus('todo');
    setNewDueDate('');
    setNewTags([]);
    setNewDescription('');
    setNewChecklist([]);
    setNewProjectId('');
    setNewPillarId('');
    setNewRecurring(false);
    setNewRecurringFrequency('daily');
    setIsDialogOpen(true);
  }

  function openEdit(task: Task) {
    if (bulkMode) return;
    setEditingTask(task);
    setNewTitle(task.title);
    setNewPriority(task.priority);
    setNewStatus(task.status);
    setNewDueDate(task.dueDate || '');
    setNewTags([...(task.tags ?? [])]);
    setNewDescription(task.description || '');
    setNewChecklist(task.checklist?.map(c => ({ ...c })) || []);
    setNewProjectId(task.projectId || '');
    setNewPillarId(task.pillarId || '');
    setNewRecurring(task.recurring || false);
    setNewRecurringFrequency(task.recurringFrequency || 'daily');
    setIsDialogOpen(true);
  }

  async function handleSave() {
    try {
      const payload = {
        title: newTitle || 'Sem título',
        description: newDescription,
        priority: newPriority,
        status: newStatus,
        dueDate: newDueDate || undefined,
        tags: newTags,
        checklist: newChecklist,
        projectId: newProjectId || undefined,
        pillarId: newPillarId || undefined,
        recurring: newRecurring,
        recurringFrequency: newRecurring ? newRecurringFrequency : undefined,
      };
      if (editingTask) {
        await apiFetch(`/api/tasks/${editingTask.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await apiFetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      setIsDialogOpen(false);
      loadTasks();
      toast.success(editingTask ? 'Tarefa atualizada!' : 'Tarefa criada!');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      const task = tasks.find(t => t.id === id);
      await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
      setIsDialogOpen(false);
      loadTasks();
      toast('Tarefa excluída', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            if (task) {
              try {
                await apiFetch('/api/tasks', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...task, id: undefined, createdAt: undefined, updatedAt: undefined, completedAt: undefined, checklist: task.checklist?.map(c => ({ ...c, id: uid('ck') })) || [] }),
                });
                loadTasks();
                toast.success('Tarefa restaurada!');
              } catch (err) {
                toast.error(showError(err));
              }
            }
          },
        },
      });
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleBulkDelete() {
    try {
      const count = selectedIds.size;
      const deletedTasks = tasks.filter(t => selectedIds.has(t.id));
      await apiFetch('/api/tasks/batch', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selectedIds) }) });
      setSelectedIds(new Set());
      setBulkMode(false);
      loadTasks();
      toast(`${count} tarefa${count > 1 ? 's' : ''} excluída${count > 1 ? 's' : ''}`, {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            try {
              for (const task of deletedTasks) {
                await apiFetch('/api/tasks', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...task, id: undefined, createdAt: undefined, updatedAt: undefined, completedAt: undefined, checklist: task.checklist?.map(c => ({ ...c, id: uid('ck') })) || [] }),
                });
              }
              loadTasks();
              toast.success('Tarefas restauradas!');
            } catch (err) {
              toast.error(showError(err));
            }
          },
        },
      });
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleBulkStatus(status: Task['status']) {
    try {
      const count = selectedIds.size;
      await apiFetch('/api/tasks/batch', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selectedIds), data: { status } }) });
      setSelectedIds(new Set());
      setBulkMode(false);
      loadTasks();
      toast.success(`${count} tarefa${count > 1 ? 's' : ''} movida${count > 1 ? 's' : ''}!`);
    } catch (err) {
      toast.error(showError(err));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function selectAll(status?: Task['status']) {
    const pool = status ? filteredTasks.filter(t => t.status === status) : filteredTasks;
    setSelectedIds(new Set(pool.map(t => t.id)));
  }

  async function handleDuplicate(task: Task) {
    try {
      await apiFetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, id: undefined, title: `${task.title} (cópia)`, status: 'todo', createdAt: undefined, updatedAt: undefined, completedAt: undefined, checklist: task.checklist?.map(c => ({ ...c, id: uid('ck') })) || [] }),
      });
      loadTasks();
      toast.success('Tarefa duplicada!');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleToggleDone(task: Task) {
    try {
      const nextStatus = task.status === 'done' ? 'todo' : 'done';
      await apiFetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) });
      if (nextStatus === 'done') {
        fireConfetti();
        toast.success('Tarefa concluída! 🎉');
        await spawnNextOccurrenceIfRecurring(task);
      }
      loadTasks();
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleQuickStatus(taskId: string, status: Task['status']) {
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      loadTasks();
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleScheduleTask(taskId: string, dueDate: string | null) {
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate }),
      });
      loadTasks();
      toast.success(dueDate ? 'Tarefa planejada na semana!' : 'Tarefa devolvida ao planejamento.');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleQuickAdd(status: Task['status']) {
    if (!quickAddTitle.trim()) return;
    try {
      await apiFetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: quickAddTitle, status, priority: 'normal' }) });
      setQuickAddTitle('');
      setQuickAddStatus(null);
      loadTasks();
    } catch (err) {
      toast.error(showError(err));
    }
  }

  function addTag() { const tag = newTagInput.trim(); if (tag && !newTags.includes(tag)) { setNewTags([...newTags, tag]); setNewTagInput(''); } }
  function removeTag(tag: string) { setNewTags(newTags.filter(t => t !== tag)); }
  function addChecklistItem() { const text = newChecklistInput.trim(); if (text) { setNewChecklist([...newChecklist, { id: uid('ck'), text, done: false }]); setNewChecklistInput(''); } }
  function toggleChecklistItem(id: string) { setNewChecklist(newChecklist.map(c => c.id === id ? { ...c, done: !c.done } : c)); }
  function removeChecklistItem(id: string) { setNewChecklist(newChecklist.filter(c => c.id !== id)); }

  function handleDragStart(e: React.DragEvent, taskId: string) { setDraggedId(taskId); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', taskId); }
  function handleDragEnd() { setTimeout(() => setDraggedId(null), 100); }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
  async function handleDrop(e: React.DragEvent, targetStatus: Task['status']) { e.preventDefault(); const taskId = e.dataTransfer.getData('text/plain'); if (taskId) await handleQuickStatus(taskId, targetStatus); setDraggedId(null); }
  async function handleWeekDrop(e: React.DragEvent, dueDate: string) { e.preventDefault(); const taskId = e.dataTransfer.getData('text/plain'); if (taskId) await handleScheduleTask(taskId, dueDate); setDraggedId(null); }
  const dragClickRef = useRef(false);

  // ─── Filtered + Sorted ───────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (!showDone && t.status === 'done') return false;
      if (filterOverdue && !isOverdue(t)) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterProject !== 'all' && t.projectId !== filterProject) return false;
      if (filterPillar !== 'all' && t.pillarId !== filterPillar) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || (t.tags ?? []).some(tag => tag.toLowerCase().includes(q));
      }
      return true;
    });
  }, [tasks, showDone, filterOverdue, filterPriority, filterProject, filterPillar, search]);

  const sortedTasks = useMemo(() => {
    const arr = [...filteredTasks];
    if (sortBy === 'title') arr.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === 'priority') arr.sort((a, b) => { const order = { urgent: 0, important: 1, normal: 2 }; return order[a.priority] - order[b.priority]; });
    else if (sortBy === 'status') { const order = stages.map(s => s.id); arr.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status)); }
    else if (sortBy === 'dueDate') arr.sort((a, b) => { if (!a.dueDate && !b.dueDate) return 0; if (!a.dueDate) return 1; if (!b.dueDate) return -1; return a.dueDate.localeCompare(b.dueDate); });
    else arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [filteredTasks, sortBy, stages]);

  const overdueCount = tasks.filter(isOverdue).length;
  const urgentCount = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length;

  // Pipeline stats
  const pipelineStats = useMemo(() => {
    return stages.map(s => ({ ...s, count: filteredTasks.filter(t => t.status === s.id).length }));
  }, [filteredTasks, stages]);

  // Active filters
  const activeFilters = useMemo(() => {
    const chips: { label: string; value: string; key: string }[] = [];
    if (filterOverdue) chips.push({ label: 'Atrasadas', value: `${overdueCount}`, key: 'overdue' });
    if (filterPriority !== 'all') chips.push({ label: 'Prioridade', value: priorityConfig[filterPriority]?.label || filterPriority, key: 'priority' });
    if (filterProject !== 'all') { const p = projects.find(x => x.id === filterProject); chips.push({ label: 'Projeto', value: p ? `${p.emoji || ''} ${p.name}` : filterProject, key: 'project' }); }
    if (filterPillar !== 'all') { const p = pillars.find(x => x.id === filterPillar); chips.push({ label: 'Pilar', value: p ? `${p.emoji || ''} ${p.name}` : filterPillar, key: 'pillar' }); }
    if (showDone) chips.push({ label: 'Feitas', value: 'Visíveis', key: 'done' });
    return chips;
  }, [filterOverdue, filterPriority, filterProject, filterPillar, showDone, overdueCount, projects, pillars]);

  function removeFilter(key: string) {
    if (key === 'overdue') setFilterOverdue(false);
    if (key === 'priority') setFilterPriority('all');
    if (key === 'project') setFilterProject('all');
    if (key === 'pillar') setFilterPillar('all');
    if (key === 'done') setShowDone(false);
  }

  function clearAllFilters() {
    setFilterOverdue(false);
    setFilterPriority('all');
    setFilterProject('all');
    setFilterPillar('all');
    setShowDone(false);
    setSearch('');
  }

  // ─── Grouped Tasks ───────────────────────────────────────────────────────

  const grouped = useMemo(() => {
    const groups = new Map<string, Task[]>();
    let groupKeys: string[] = [];

    if (groupBy === 'status') {
      groupKeys = stages.map(s => s.id);
      stages.forEach(s => groups.set(s.id, []));
    } else if (groupBy === 'priority') {
      groupKeys = ['urgent', 'important', 'normal'];
      groupKeys.forEach(k => groups.set(k, []));
    } else if (groupBy === 'project') {
      groupKeys = [...new Set(sortedTasks.map(t => t.projectId || '(sem projeto)'))];
      groupKeys.forEach(k => groups.set(k, []));
    } else if (groupBy === 'pillar') {
      groupKeys = [...new Set(sortedTasks.map(t => t.pillarId || '(sem pilar)'))];
      groupKeys.forEach(k => groups.set(k, []));
    }

    sortedTasks.forEach(task => {
      let key = '';
      if (groupBy === 'status') key = task.status;
      else if (groupBy === 'priority') key = task.priority;
      else if (groupBy === 'project') key = task.projectId || '(sem projeto)';
      else if (groupBy === 'pillar') key = task.pillarId || '(sem pilar)';
      if (groups.has(key)) groups.get(key)!.push(task);
    });

    return { groups, groupKeys };
  }, [sortedTasks, groupBy, stages]);

  function getGroupLabel(key: string): string {
    if (groupBy === 'status') return getStatusLabel(key);
    if (groupBy === 'priority') return priorityConfig[key]?.label || key;
    if (groupBy === 'project') {
      const proj = projects.find(p => p.id === key);
      return proj ? `${proj.emoji || '📁'} ${proj.name}` : key;
    }
    if (groupBy === 'pillar') {
      const pil = pillars.find(p => p.id === key);
      return pil ? `${pil.emoji || '🏛️'} ${pil.name}` : key;
    }
    return key;
  }

  function getGroupDot(key: string): string {
    if (groupBy === 'status') return getStage(key)?.dot || 'bg-muted-foreground';
    if (groupBy === 'priority') return priorityConfig[key]?.dot || 'bg-muted-foreground';
    return 'bg-muted-foreground';
  }

  // ─── Calendar Data ───────────────────────────────────────────────────────

  const calendarDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { day: number; tasks: Task[]; content: CalendarContentItem[]; financial: CalendarFinancialEntry[] }[] = [];
    for (let i = 0; i < firstDay; i++) days.push({ day: 0, tasks: [], content: [], financial: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        tasks: sortedTasks.filter(t => t.dueDate === dateStr),
        content: linkedContent.filter(c => c.scheduledDate === dateStr),
        financial: calendarFinancial.filter(f => f.dueDate === dateStr && f.status !== 'paid'),
      });
    }
    return days;
  }, [sortedTasks, linkedContent, calendarFinancial]);

  // ─── Render Card ─────────────────────────────────────────────────────────

  function renderTaskCard(task: Task) {
    const isSelected = selectedIds.has(task.id);
    const checkProgress = task.checklist?.length > 0 ? Math.round((task.checklist.filter(c => c.done).length / task.checklist.length) * 100) : 0;

    return (
      <motion.div key={task.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', stiffness: 500, damping: 35 }}>
        <Card
          draggable={!bulkMode}
          onDragStart={(e) => { dragClickRef.current = true; handleDragStart(e, task.id); }}
          onDragEnd={handleDragEnd}
          onClick={() => {
            if (dragClickRef.current) { dragClickRef.current = false; return; }
            if (bulkMode) toggleSelect(task.id);
            else openEdit(task);
          }}
          className={cn(
            'group cursor-grab transition-all hover:border-primary/50 hover:shadow-md hover:shadow-primary/5 active:cursor-grabbing border-l-3',
            draggedId === task.id && 'opacity-50 scale-95',
            isOverdue(task) && 'border-destructive/50',
            priorityConfig[task.priority].borderColor,
            isSelected && 'border-primary bg-primary/5 ring-1 ring-primary/30',
            bulkMode && 'cursor-pointer'
          )}
        >
          <CardContent className={cn('p-3', dense && 'p-2')}>
            <div className="flex items-start gap-2">
              {bulkMode ? (
                <button className="mt-0.5 shrink-0" aria-label={isSelected ? `Desmarcar ${task.title}` : `Selecionar ${task.title}`}>
                  {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                </button>
              ) : (
                <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 opacity-0 group-hover:opacity-100" />
              )}
              {!bulkMode && (
                <button onClick={(e) => { e.stopPropagation(); handleToggleDone(task); }} className="mt-0.5 shrink-0" aria-label={task.status === 'done' ? `Reabrir ${task.title}` : `Concluir ${task.title}`}>
                  {task.status === 'done' ? <CheckCircle2 className="h-4 w-4 text-money" /> : <Circle className={cn("h-4 w-4", isOverdue(task) ? 'text-destructive' : 'text-muted-foreground hover:text-foreground')} />}
                </button>
              )}
              <div className="flex-1 min-w-0">
                <p className={cn(dense ? 'text-xs' : 'text-sm', 'font-medium leading-snug', task.status === 'done' && 'line-through text-muted-foreground')}>
                  {task.title}
                </p>
                {!dense && task.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1 flex items-center gap-1">
                    <Subtitles className="h-3 w-3" /> {task.description.slice(0, 40)}
                  </p>
                )}
                {!dense && task.checklist?.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <CheckSquare className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{task.checklist.filter(c => c.done).length}/{task.checklist.length}</span>
                    <Progress value={checkProgress} className="h-1 flex-1" />
                  </div>
                )}
                <div className={cn('flex flex-wrap items-center gap-1', dense ? 'mt-1' : 'mt-2')}>
                  <Badge variant="outline" className={cn(dense ? 'text-xs px-1 py-0' : 'text-xs px-1.5 py-0', priorityConfig[task.priority].textColor)}>
                    {priorityConfig[task.priority].label}
                  </Badge>
                  {(task.tags ?? []).slice(0, dense ? 0 : 2).map(tag => (
                    <Badge key={tag} variant="secondary" className={cn(dense ? 'text-xs px-1 py-0' : 'text-xs px-1.5 py-0')}>
                      <Tag className="mr-1 h-2.5 w-2.5" /> {tag}
                    </Badge>
                  ))}
                  {(task.tags ?? []).length > (dense ? 0 : 2) && (
                    <Badge variant="secondary" className={cn(dense ? 'text-xs px-1 py-0' : 'text-xs px-1.5 py-0')}>+{(task.tags ?? []).length - (dense ? 0 : 2)}</Badge>
                  )}
                  {task.checklist?.length > 0 && (
                    <Badge variant="outline" className={cn(dense ? 'text-xs px-1 py-0' : 'text-xs px-1.5 py-0', 'gap-1')}>
                      <ListChecks className="h-2.5 w-2.5" /> {task.checklist.filter(c => c.done).length}/{task.checklist.length}
                    </Badge>
                  )}
                  {!dense && task.projectId && (() => {
                    const proj = projects.find(p => p.id === task.projectId);
                    return proj ? (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 gap-1 border-border bg-muted/30">
                        {proj.emoji || '📁'} {proj.name}
                      </Badge>
                    ) : null;
                  })()}
                  {!dense && task.pillarId && (() => {
                    const pil = pillars.find(p => p.id === task.pillarId);
                    return pil ? (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 gap-1 border-border bg-muted/30">
                        {pil.emoji || '🏛️'} {pil.name}
                      </Badge>
                    ) : null;
                  })()}
                  {task.dueDate && (
                    <Badge variant="outline" className={cn(dense ? 'text-xs px-1 py-0' : 'text-xs px-1.5 py-0', 'gap-1', isOverdue(task) ? 'border-destructive text-destructive' : 'text-muted-foreground')}>
                      <CalendarDays className="h-2.5 w-2.5" /> {new Date(task.dueDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </Badge>
                  )}
                  {task.recurring && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0 gap-1 text-muted-foreground">
                      <Repeat className="h-2.5 w-2.5" /> {RECURRING_LABELS[task.recurringFrequency || 'daily']}
                    </Badge>
                  )}
                </div>
              </div>
              {!bulkMode && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Mais ações para ${task.title}`} className="h-8 w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(task)}><Subtitles className="mr-2 h-4 w-4" /> Abrir</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleDone(task)}><CheckCircle2 className="mr-2 h-4 w-4" /> {task.status === 'done' ? 'Reabrir' : 'Concluir'}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(task)}><Copy className="mr-2 h-4 w-4" /> Duplicar</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {stages.filter(s => s.id !== task.status).map(s => (
                      <DropdownMenuItem key={s.id} onClick={() => handleQuickStatus(task.id, s.id)}>
                        <ArrowRight className="mr-2 h-4 w-4" /> {getStatusLabel(s.id)}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleDelete(task.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // ─── Kanban Column ───────────────────────────────────────────────────────

  function renderColumn(status: string, taskList: Task[]) {
    const cfg = getStage(status);
    return (
      <div key={status} className="flex flex-col min-w-[280px] max-sm:min-w-[85vw] max-sm:snap-start" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)}>
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className={cn('h-2.5 w-2.5 rounded-full', cfg?.dot || 'bg-muted-foreground')} />
          <h3 className="text-sm font-medium">{getStatusLabel(status)}</h3>
          <Badge variant="secondary" className="ml-auto text-xs">{taskList.length}</Badge>
          {bulkMode && taskList.length > 0 && (
            <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5" onClick={() => selectAll(status)}>Todos</Button>
          )}
        </div>
        <div className="space-y-2 flex-1 rounded-lg border border-border/50 bg-muted/20 p-2 min-h-[200px]">
          <AnimatePresence>{taskList.map(renderTaskCard)}</AnimatePresence>
          {taskList.length === 0 && quickAddStatus !== status && (
            <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50">Solte aqui</div>
          )}
          {quickAddStatus === status ? (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Card><CardContent className="p-2">
                <Input autoFocus value={quickAddTitle} onChange={(e) => setQuickAddTitle(e.target.value)} placeholder="Título da tarefa..." className="h-8 text-sm border-0 bg-transparent"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(status); if (e.key === 'Escape') { setQuickAddStatus(null); setQuickAddTitle(''); } }}
                  onBlur={() => { if (!quickAddTitle.trim()) setQuickAddStatus(null); }} />
                <div className="flex gap-1 mt-1">
                  <Button size="sm" className="h-6 text-xs px-2" onClick={() => handleQuickAdd(status)}>Adicionar</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setQuickAddStatus(null); setQuickAddTitle(''); }}>Cancelar</Button>
                </div>
              </CardContent></Card>
            </motion.div>
          ) : (
            <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground/50 hover:text-muted-foreground text-xs" onClick={() => { setQuickAddStatus(status); setQuickAddTitle(''); }}>
              <Plus className="h-3 w-3" /> Adicionar tarefa
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ─── Views ───────────────────────────────────────────────────────────────

  function renderKanban() {
    if (groupBy === 'status') {
      return (
        <div className="flex gap-4 overflow-x-auto overscroll-x-contain pb-4 max-sm:snap-x max-sm:snap-mandatory" aria-label="Quadro de tarefas por etapa">
          <LayoutGroup id="task-kanban">
            {stages.map(s => renderColumn(s.id, sortedTasks.filter(t => t.status === s.id)))}
          </LayoutGroup>
        </div>
      );
    }
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 max-sm:snap-x max-sm:snap-mandatory">
        <LayoutGroup id="task-kanban-grouped">
          {grouped.groupKeys.map(key => {
            const items = grouped.groups.get(key) || [];
            return (
              <div key={key} className="flex flex-col min-w-[260px] max-sm:min-w-[80vw]">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={cn('h-2.5 w-2.5 rounded-full', getGroupDot(key))} />
                  <h3 className="text-sm font-medium">{getGroupLabel(key)}</h3>
                  <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>
                </div>
                <div className="space-y-2 flex-1 rounded-lg border border-border/50 bg-muted/20 p-2 min-h-[300px]">
                  <AnimatePresence>{items.map(renderTaskCard)}</AnimatePresence>
                  {items.length === 0 && <div className="flex flex-col items-center justify-center py-8 text-muted-foreground"><p className="text-xs">Nenhum item</p></div>}
                </div>
              </div>
            );
          })}
        </LayoutGroup>
      </div>
    );
  }

  function renderList() {
    return (
      <div className="space-y-4">
        {Array.from(grouped.groups.entries()).map(([key, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className={cn('h-2.5 w-2.5 rounded-full', getGroupDot(key))} />
                <h3 className="text-sm font-medium">{getGroupLabel(key)}</h3>
                <Badge variant="secondary" className="text-xs">{items.length}</Badge>
              </div>
              <div className="space-y-1">
                {items.map(renderTaskCard)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderWeek() {
    const weekDays = getWeekDays(weekOffset);
    const today = todayStr();
    const weekStart = formatDateISO(weekDays[0]);
    const weekEnd = formatDateISO(weekDays[6]);
    const isCurrentWeek = weekOffset === 0;
    const plannedTasks = sortedTasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate >= weekStart && t.dueDate <= weekEnd);
    const backlog = sortedTasks.filter(t => t.status !== 'done' && !t.dueDate);
    const urgentPlanned = plannedTasks.filter(t => t.priority === 'urgent' || isOverdue(t)).length;
    const doneThisWeek = tasks.filter(t => t.status === 'done' && t.completedAt && t.completedAt.slice(0, 10) >= weekStart && t.completedAt.slice(0, 10) <= weekEnd).length;
    const formatWeek = `${weekDays[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} — ${weekDays[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`;

    const plannerCard = (task: Task, inBacklog = false) => {
      const project = task.projectId ? projects.find(p => p.id === task.projectId) : undefined;
      const priority = priorityConfig[task.priority];
      return (
        <div
          key={task.id}
          draggable
          onDragStart={(event) => handleDragStart(event, task.id)}
          onDragEnd={handleDragEnd}
          onClick={() => openEdit(task)}
          className={cn('group cursor-grab rounded-lg border border-border/70 bg-card p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md active:cursor-grabbing', draggedId === task.id && 'opacity-40')}
        >
          <div className="flex items-start gap-2">
            <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/45" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-xs font-medium leading-snug">{task.title}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className={cn('h-1.5 w-1.5 rounded-full', priority.dot)} />
                <span className={cn('text-[10px] font-medium', priority.textColor)}>{priority.label}</span>
                {project && <span className="max-w-[110px] truncate text-[10px] text-muted-foreground">{project.emoji || '📁'} {project.name}</span>}
              </div>
            </div>
            {!inBacklog && (
              <button onClick={(event) => { event.stopPropagation(); void handleScheduleTask(task.id, null); }} className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Remover data de ${task.title}`} title="Devolver ao planejamento">
                <Inbox className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary"><Calendar className="h-3.5 w-3.5" /> Planejamento semanal</div>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Planeje a semana, sem perder o que está esperando.</h2>
              <p className="mt-1 text-sm text-muted-foreground">Arraste tarefas sem data para reservar foco em cada dia. Tudo fica editável depois.</p>
            </div>
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <Button variant="outline" size="icon" onClick={() => setWeekOffset(offset => offset - 1)} aria-label="Semana anterior"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant={isCurrentWeek ? 'secondary' : 'outline'} size="sm" onClick={() => setWeekOffset(0)}>Esta semana</Button>
              <Button variant="outline" size="icon" onClick={() => setWeekOffset(offset => offset + 1)} aria-label="Próxima semana"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary" className="bg-background/50 px-2.5 py-1">{formatWeek}</Badge>
            <Badge variant="outline" className="px-2.5 py-1"><CalendarPlus className="mr-1.5 h-3.5 w-3.5 text-primary" />{plannedTasks.length} planejadas</Badge>
            <Badge variant="outline" className="px-2.5 py-1"><Inbox className="mr-1.5 h-3.5 w-3.5 text-qty" />{backlog.length} sem data</Badge>
            {urgentPlanned > 0 && <Badge variant="outline" className="border-destructive/35 bg-destructive/5 px-2.5 py-1 text-destructive"><Flame className="mr-1.5 h-3.5 w-3.5" />{urgentPlanned} urgentes</Badge>}
            {doneThisWeek > 0 && <Badge variant="outline" className="border-money/35 bg-money/5 px-2.5 py-1 text-money"><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />{doneThisWeek} concluídas</Badge>}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="overflow-x-auto pb-2">
            <div className="grid min-w-[980px] grid-cols-7 gap-3 xl:min-w-0">
              {weekDays.map((day, index) => {
                const dateStr = formatDateISO(day);
                const dayTasks = plannedTasks.filter(task => task.dueDate === dateStr);
                const isToday = dateStr === today;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const capacity = 3;
                return (
                  <motion.div key={dateStr} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }} className={cn('flex min-h-[390px] flex-col rounded-xl border p-2', isToday ? 'border-primary/60 bg-primary/[0.07] shadow-[0_12px_32px_-24px_var(--color-primary)]' : isWeekend ? 'border-border/60 bg-muted/20' : 'border-border/70 bg-card/60')} onDragOver={handleDragOver} onDrop={(event) => void handleWeekDrop(event, dateStr)}>
                    <div className="mb-3 rounded-lg px-1.5 py-1">
                      <div className="flex items-center justify-between"><span className={cn('text-[11px] font-semibold uppercase tracking-wider', isToday ? 'text-primary' : 'text-muted-foreground')}>{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>{isToday && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">HOJE</span>}</div>
                      <div className="mt-1 flex items-baseline justify-between"><span className="font-mono-num text-2xl font-bold">{day.getDate()}</span><span className={cn('text-[10px]', dayTasks.length > capacity ? 'text-destructive' : 'text-muted-foreground')}>{dayTasks.length}/{capacity} foco</span></div>
                      <div className="mt-2 flex gap-1">{Array.from({ length: capacity }).map((_, slot) => <span key={slot} className={cn('h-1 flex-1 rounded-full', slot < dayTasks.length ? (dayTasks.length > capacity ? 'bg-destructive' : 'bg-primary') : 'bg-border')} />)}</div>
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      {dayTasks.map(task => plannerCard(task))}
                      {dayTasks.length === 0 && <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/70 px-2 text-center text-xs text-muted-foreground/70"><CalendarPlus className="mb-2 h-4 w-4 text-primary/60" />Solte uma tarefa aqui</div>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>

          <aside className="xl:sticky xl:top-5 xl:self-start">
            <Card className="overflow-hidden border-qty/25">
              <CardHeader className="border-b border-border/60 bg-qty/5 pb-4">
                <div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Inbox className="h-4 w-4 text-qty" /> Para planejar</CardTitle><p className="mt-1 text-xs text-muted-foreground">Tarefas sem data aguardando uma decisão.</p></div><Badge variant="secondary">{backlog.length}</Badge></div>
              </CardHeader>
              <CardContent className="p-3">
                <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">
                  {backlog.map(task => plannerCard(task, true))}
                  {backlog.length === 0 && <div className="flex flex-col items-center py-10 text-center"><CheckCircle2 className="mb-2 h-7 w-7 text-money/70" /><p className="text-sm font-medium">Tudo tem um lugar.</p><p className="mt-1 text-xs text-muted-foreground">A caixa de planejamento está vazia.</p></div>}
                </div>
                <Button variant="outline" className="mt-3 w-full gap-2" onClick={openCreate}><Plus className="h-4 w-4" /> Capturar tarefa</Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    );
  }

  function renderCalendar() {
    const now = new Date();
    const monthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-medium capitalize">{monthName}</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Circle className="h-2 w-2 fill-current" /> Tarefa</span>
            <span className="flex items-center gap-1"><FileText className="h-2.5 w-2.5" /> Conteúdo</span>
            <span className="flex items-center gap-1"><Wallet className="h-2.5 w-2.5" /> Financeiro</span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(d => <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>)}
          {calendarDays.map((day, i) => {
            const totalItems = day.tasks.length + day.content.length + day.financial.length;
            return (
            <div key={i} className={cn('min-h-[80px] rounded-lg border p-1.5', day.day === 0 ? 'border-transparent' : day.day === now.getDate() ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-muted/10')}>
              {day.day > 0 && (
                <>
                  <span className={cn('text-xs font-medium', day.day === now.getDate() ? 'text-primary font-bold' : 'text-muted-foreground')}>{day.day}</span>
                  <div className="mt-1 space-y-0.5">
                    {day.tasks.slice(0, 2).map(task => (
                      <div key={task.id} className="rounded px-1 py-0.5 text-xs cursor-pointer hover:opacity-80 transition-opacity truncate flex items-center gap-1"
                        style={{ backgroundColor: priorityConfig[task.priority]?.color?.replace('bg-', '') ? `var(--${priorityConfig[task.priority].color.replace('bg-', '')})` + '20' : undefined }}
                        onClick={() => openEdit(task)}>
                        {task.status === 'done' ? <CheckCircle2 className="h-2 w-2 text-money shrink-0" /> : <Circle className="h-2 w-2 shrink-0" style={{ color: priorityConfig[task.priority]?.dot === 'bg-destructive' ? '#ef4444' : priorityConfig[task.priority]?.dot === 'bg-primary' ? '#8b5cf6' : '#64748b' }} />}
                        {task.title}
                      </div>
                    ))}
                    {day.content.slice(0, 2).map(item => (
                      <Link key={item.id} href="/conteudo" className="rounded px-1 py-0.5 text-xs cursor-pointer hover:opacity-80 transition-opacity truncate flex items-center gap-1 bg-purple-500/10 text-purple-400">
                        <FileText className="h-2 w-2 shrink-0" /> {item.title}
                      </Link>
                    ))}
                    {day.financial.slice(0, 2).map(entry => (
                      <Link key={entry.id} href="/financeiro" className={cn('rounded px-1 py-0.5 text-xs cursor-pointer hover:opacity-80 transition-opacity truncate flex items-center gap-1', entry.type === 'income' ? 'bg-money/10 text-money' : 'bg-destructive/10 text-destructive')}>
                        <Wallet className="h-2 w-2 shrink-0" /> {entry.description || entry.category}
                      </Link>
                    ))}
                    {totalItems > 6 && <span className="text-xs text-muted-foreground">+{totalItems - 6}</span>}
                  </div>
                </>
              )}
            </div>
          );})}
        </div>
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <motion.div className="p-4 lg:p-8" variants={stagger} initial="initial" animate="animate">
      {/* Header */}
      <motion.div className="mb-6" variants={fade}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Tarefas</h1>
            <p className="text-muted-foreground">
              {filteredTasks.length} tarefas
              {overdueCount > 0 && <> · <span className="text-destructive">{overdueCount} atrasadas</span></>}
              {urgentCount > 0 && <> · <span className="text-orange-500">{urgentCount} urgentes</span></>}
            </p>
          </div>
        </div>

        {/* Pipeline Stats */}
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {pipelineStats.map(s => (
            <button key={s.id} onClick={() => { setShowDone(s.id === 'done' ? !showDone : showDone); }}
              className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                s.id === 'done' && showDone ? 'bg-money/10 border-money/30 text-money' : 'border-border/50 text-muted-foreground hover:bg-muted/50')}>
              <div className={cn('h-2 w-2 rounded-full', s.dot)} />
              {s.label}
              <span className="font-mono-num">{s.count}</span>
            </button>
          ))}
        </div>

        {/* Filter Chips */}
        <AnimatePresence>
          {activeFilters.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap items-center gap-1.5 mb-3">
              {activeFilters.map(f => <FilterChip key={f.key} label={f.label} value={f.value} onRemove={() => removeFilter(f.key)} />)}
              <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1">limpar tudo</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {bulkMode ? (
            <>
              <Badge variant="secondary">{selectedIds.size} selecionada{selectedIds.size !== 1 ? 's' : ''}</Badge>
              <Button variant="outline" size="sm" onClick={() => handleBulkStatus('done')}><CheckCircle2 className="mr-1 h-4 w-4" /> Concluir</Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkStatus('todo')}><Circle className="mr-1 h-4 w-4" /> Reabrir</Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={selectedIds.size === 0}><Trash2 className="mr-1 h-4 w-4" /> Excluir ({selectedIds.size})</Button>
              <Button variant="ghost" size="sm" onClick={() => { setBulkMode(false); setSelectedIds(new Set()); }}><X className="mr-1 h-4 w-4" /> Cancelar</Button>
            </>
          ) : (
            <>
              <div className="relative w-full shrink-0 sm:flex-1 lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tarefas..." className="pl-9 h-9" />
              </div>

              <div className="flex flex-wrap items-center gap-2">

              {/* Filters Panel */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" /> Filtros</Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Agrupar por</Label>
                      <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="status">Estágio</SelectItem>
                          <SelectItem value="priority">Prioridade</SelectItem>
                          <SelectItem value="project">Projeto</SelectItem>
                          <SelectItem value="pillar">Pilar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Ordenar por</Label>
                      <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date">Data de criação</SelectItem>
                          <SelectItem value="dueDate">Prazo</SelectItem>
                          <SelectItem value="title">Título</SelectItem>
                          <SelectItem value="priority">Prioridade</SelectItem>
                          <SelectItem value="status">Estágio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-xs">Prioridade</Label>
                      <Select value={filterPriority} onValueChange={setFilterPriority}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="urgent">Urgente</SelectItem>
                          <SelectItem value="important">Importante</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {projects.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs">Projeto</Label>
                        <Select value={filterProject} onValueChange={setFilterProject}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {projects.map(p => <SelectItem key={p.id} value={p.id}><span className="flex items-center gap-2">{p.emoji} {p.name}</span></SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {pillars.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs">Pilar</Label>
                        <Select value={filterPillar} onValueChange={setFilterPillar}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {pillars.map(p => <SelectItem key={p.id} value={p.id}><span className="flex items-center gap-2">{p.emoji} {p.name}</span></SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Separator />
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Modo denso</Label>
                      <Switch checked={dense} onCheckedChange={setDense} />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <details className="order-last w-full rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Mais opções de organização</summary>
                <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Saved Views */}
              <div className="flex flex-wrap items-center gap-1">
                {savedViews.slice(0, 2).map(v => (
                  <Button key={v.id} variant={activeViewId === v.id ? 'secondary' : 'ghost'} size="sm" className="h-9 text-xs gap-1" onClick={() => applyView(v)}>
                    <Bookmark className="h-3 w-3" /> {v.name}
                  </Button>
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 text-xs gap-1"><Save className="h-3 w-3" /> Salvar visão</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="end">
                    <div className="space-y-2">
                      <Label className="text-xs">Salvar visão atual</Label>
                      <div className="flex gap-2">
                        <Input id="task-view-name" placeholder="Nome da visão" className="h-8 text-xs" />
                        <Button size="sm" className="h-8" onClick={() => { const input = document.getElementById('task-view-name') as HTMLInputElement; if (input?.value.trim()) saveCurrentView(input.value.trim()); }}>Salvar</Button>
                      </div>
                      {savedViews.length > 0 && (
                        <div className="space-y-1 pt-2 border-t">
                          {savedViews.map(v => (
                            <div key={v.id} className="flex items-center justify-between group">
                              <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => applyView(v)}>{v.name}</button>
                              <Button variant="ghost" size="icon" aria-label={`Excluir visão ${v.name}`} className="h-5 w-5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => deleteView(v.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <Button variant={bulkMode ? 'secondary' : 'outline'} size="sm" onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}>
                <CheckSquare className="mr-1 h-4 w-4" /> Selecionar
              </Button>

              <Button variant="outline" size="sm" aria-label="Editar etapas" title="Editar etapas" onClick={() => setStageDialogOpen(true)}>
                <Edit2 className="h-4 w-4" />
              </Button>
                </div>
              </details>

              <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
                {[
                  { id: 'kanban' as const, icon: Layers, label: 'Quadro Kanban' },
                  { id: 'list' as const, icon: Rows3, label: 'Lista' },
                  { id: 'week' as const, icon: CalendarDays, label: 'Semana' },
                  { id: 'calendar' as const, icon: Calendar, label: 'Calendário' },
                ].map(v => (
                  <Button key={v.id} variant={view === v.id ? 'secondary' : 'ghost'} size="sm" aria-label={`Visualização: ${v.label}`} title={v.label} className="h-8 px-3" onClick={() => setView(v.id)}>
                    <v.icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>

              <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> Nova</Button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Content */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col min-w-[280px]">
              <div className="flex items-center gap-2 mb-3 px-1"><Skeleton className="h-2.5 w-2.5 rounded-full" /><Skeleton className="h-4 w-16" /><Skeleton className="ml-auto h-5 w-6 rounded" /></div>
              <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-2 min-h-[200px]">
                {Array.from({ length: 2 }).map((_, j) => <Card key={j}><CardContent className="p-3"><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-3 w-1/2" /></CardContent></Card>)}
              </div>
            </div>
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><CheckCircle2 className="h-6 w-6 text-muted-foreground" /></div>
            <p className="mt-4 text-muted-foreground">{tasks.length === 0 ? 'Nenhuma tarefa ainda' : 'Nenhum resultado encontrado'}</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Criar Primeira Tarefa</Button>
          </CardContent>
        </Card>
      ) : (
        <motion.div variants={fade}>
          {view === 'kanban' && renderKanban()}
          {view === 'list' && renderList()}
          {view === 'week' && renderWeek()}
          {view === 'calendar' && renderCalendar()}
        </motion.div>
      )}

      {/* Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
            <DialogDescription>{editingTask ? 'Altere os detalhes da tarefa' : 'Crie uma nova tarefa'}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-4 overflow-y-auto py-2 pr-1">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="O que precisa ser feito?" autoFocus />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Detalhes, notas, links..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as Task['status'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stages.map(s => <SelectItem key={s.id} value={s.id}><span className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', s.dot)} />{getStatusLabel(s.id)}</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select value={newPriority} onValueChange={(v) => setNewPriority(v as Task['priority'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="important">Importante</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Prazo</Label>
              <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="max-w-[200px]" />
              <div className="flex flex-wrap gap-1">
                {[{ label: 'Hoje', offset: 0 }, { label: 'Amanhã', offset: 1 }, { label: '2 dias', offset: 2 }, { label: 'Fim de semana', offset: (6 - new Date().getDay() + 7) % 7 || 7 }].map(s => (
                  <Button key={s.label} variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => { const d = new Date(); d.setDate(d.getDate() + s.offset); setNewDueDate(formatDateISO(d)); }}>{s.label}</Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Label className="flex items-center gap-1.5 text-sm font-normal">
                  <Repeat className="h-3.5 w-3.5 text-muted-foreground" /> Tarefa recorrente
                </Label>
                <Switch checked={newRecurring} onCheckedChange={setNewRecurring} />
              </div>
              {newRecurring && (
                <Select value={newRecurringFrequency} onValueChange={(v) => setNewRecurringFrequency(v as RecurringFrequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RECURRING_LABELS) as RecurringFrequency[]).map(f => (
                      <SelectItem key={f} value={f}>{RECURRING_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {newRecurring && (
                <p className="text-xs text-muted-foreground">Ao concluir, uma nova tarefa é criada automaticamente com o próximo prazo.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Projeto</Label>
                <Select value={newProjectId} onValueChange={setNewProjectId}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}><span className="flex items-center gap-2">{p.emoji} {p.name}</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Pilar</Label>
                <Select value={newPillarId} onValueChange={setNewPillarId}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {pillars.map(p => <SelectItem key={p.id} value={p.id}><span className="flex items-center gap-2">{p.emoji} {p.name}</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {newTags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1"><Tag className="h-3 w-3" /> {tag}<button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button></Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)} placeholder="Nova tag..." onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} />
                <Button type="button" variant="outline" size="sm" onClick={addTag}><Tag className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Checklist</Label>
              <div className="space-y-1.5 mb-2">
                {newChecklist.map(item => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <button onClick={() => toggleChecklistItem(item.id)}>
                      {item.done ? <CheckCircle2 className="h-4 w-4 text-money" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <span className={cn('flex-1 text-sm', item.done && 'line-through text-muted-foreground')}>{item.text}</span>
                    <button onClick={() => removeChecklistItem(item.id)} className="opacity-0 group-hover:opacity-100 hover:text-destructive"><X className="h-3 w-3 text-muted-foreground" /></button>
                  </div>
                ))}
              </div>
              {newChecklist.length > 0 && <Progress value={Math.round((newChecklist.filter(c => c.done).length / newChecklist.length) * 100)} className="h-1.5 mb-2" />}
              <div className="flex gap-2">
                <Input value={newChecklistInput} onChange={(e) => setNewChecklistInput(e.target.value)} placeholder="Novo item..." onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())} />
                <Button type="button" variant="outline" size="sm" onClick={addChecklistItem}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            {editingTask && getTaskBacklinks(editingTask.id).length > 0 && (
              <div className="grid gap-2">
                <Label>Vínculos</Label>
                <p className="text-xs text-muted-foreground">Notas e conteúdos que apontam pra essa tarefa.</p>
                <LinkedItemsPanel
                  readOnly
                  linkableTypes={[]}
                  linkedIds={{}}
                  onChange={() => {}}
                  backlinks={getTaskBacklinks(editingTask.id)}
                />
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t pt-4">
            {editingTask && <Button variant="destructive" onClick={() => { handleDelete(editingTask.id); setIsDialogOpen(false); }}><Trash2 className="mr-2 h-4 w-4" /> Excluir</Button>}
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!newTitle.trim()}>{editingTask ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StageConfigDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        scope="tasks"
        countUsage={(stageId) => tasks.filter(t => t.status === stageId).length}
        onSaved={setStages}
      />
    </motion.div>
  );
}
