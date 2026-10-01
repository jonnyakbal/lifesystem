'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { DeadlineCell, TaskWorkspaceTable, type TaskCellPatch } from '@/components/tasks/task-workspace-table';
import { TaskRichDates } from '@/components/tasks/task-rich-dates';
import { TaskFocus, TaskLoad } from '@/components/tasks/task-focus-load';
import { TaskDeleteDialog } from '@/components/task-delete-dialog';
import { PlanningWorkspace } from '@/components/planning-workspace';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import {
  Plus, CheckCircle2, Circle, Trash2, Search, Copy,
  GripVertical, CalendarDays, X, Tag,
  MoreHorizontal, ListChecks, Subtitles, CheckSquare, Square,
  Save, SlidersHorizontal, Bookmark, Layers, Rows3, Calendar,
  ArrowRight, Repeat, Edit2, Orbit, ChevronDown, ChevronRight, GanttChart, Crosshair, ChartNoAxesColumnIncreasing
} from 'lucide-react';
import { DEFAULT_STAGES } from '@/lib/default-stages';
import { isTaskCompleted, resolveTaskStages, taskCompletionStatus, taskReopenStatus } from '@/lib/task-stages';
import { cn, todayStr } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
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
import type { StageDef, TaskPlanning } from '@/types';
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
  workType?: 'human' | 'agent' | 'decision' | 'dependency';
  responsible?: string;
  nextAction?: string;
  professionalWorkId?: string;
  id: string;
  title: string;
  description?: string;
  priority: 'urgent' | 'important' | 'normal';
  status: string;
  projectId?: string;
  pillarId?: string;
  dueDate?: string;
  planning?: TaskPlanning;
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

type ViewMode = 'kanban' | 'list' | 'week' | 'calendar' | 'timeline' | 'focus' | 'load';

// Lightweight shapes for the two other entity types the unified calendar
// overlays alongside Task — just enough fields to plot + link out, not a
// full duplicate of their own pages' interfaces.
interface CalendarContentItem { id: string; title: string; channel: string; scheduledDate?: string; linkedTaskIds?: string[]; }
interface CalendarFinancialEntry { id: string; description?: string; category: string; amount: number; type: string; dueDate?: string; status?: string; }
interface LinkedCapture { id: string; title?: string; content?: string; targetType?: string; targetId?: string; }
type GroupBy = 'status' | 'priority' | 'project' | 'pillar';
type SortBy = 'date' | 'title' | 'priority' | 'status' | 'dueDate' | 'completedAt';

interface SavedView {
  id: string;
  name: string;
  view: ViewMode;
  groupBy: GroupBy;
  sortBy: SortBy;
  search: string;
  filterOverdue: boolean;
  showDone: boolean;
  onlyCompleted?: boolean;
  dense: boolean;
  filterPriority: string;
  filterProject?: string;
  filterPillar?: string;
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

function taskIsOverdue(task: Task, stages: StageDef[]) {
  if (!task.dueDate || isTaskCompleted(task, stages)) return false;
  return task.dueDate < todayStr();
}

function formatDateISO(d: Date) {
  return todayStr(d);
}

function fireConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
  const [deletionTask, setDeletionTask] = useState<Task | null>(null);
  const [view, setView] = useState<ViewMode>('list');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [collapsedColumns, setCollapsedColumns] = useState(new Set<string>());
  const [quickAddBusy, setQuickAddBusy] = useState(false);
  const quickAddPending = useRef(false);
  const [search, setSearch] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [showDone, setShowDone] = useState(searchParams.get('completed') === '1');
  const [onlyCompleted, setOnlyCompleted] = useState(searchParams.get('completed') === '1');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [filterPillar, setFilterPillar] = useState('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [sortBy, setSortBy] = useState<SortBy>(searchParams.get('completed') === '1' ? 'completedAt' : 'date');
  const [dense, setDense] = useState(false);
  const [configuredStages, setStages] = useState<StageDef[]>(DEFAULT_STAGES.tasks);
  const stages = useMemo(() => resolveTaskStages(configuredStages, tasks), [configuredStages, tasks]);
  const isOverdue = (task: Task) => taskIsOverdue(task, stages);
  const pendingTaskIds = useRef(new Set<string>());
  const previousStatuses = useRef(new Map<string, string>());
  const recurringCreated = useRef(new Set<string>());
  const [busyTasks, setBusyTasks] = useState<Set<string>>(new Set());
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const getStage = (id: string) => stages.find(s => s.id === id);
  const getStatusLabel = (id: string) => getStage(id)?.label || id;

  // Saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState('default');

  // Bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const editorPending = useRef(false);

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
      const remaining = new URLSearchParams(searchParams.toString()); remaining.delete('open');
      router.replace(`/tarefas${remaining.size ? `?${remaining}` : ''}`, { scroll: false });
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
    setOnlyCompleted(v.onlyCompleted || false);
    setDense(v.dense);
    setFilterPriority(v.filterPriority);
    setFilterProject(v.filterProject || 'all'); setFilterPillar(v.filterPillar || 'all'); setSelectedIds(new Set());
  }

  function saveCurrentView(name: string) {
    const v: SavedView = {
      id: `tv_${Date.now()}`, name, view, groupBy, sortBy, search,
      filterOverdue, showDone, onlyCompleted, dense, filterPriority, filterProject, filterPillar,
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
    if (pendingTaskIds.current.has(task.id)) return;
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
    if (editorPending.current || !newTitle.trim() || (editingTask && pendingTaskIds.current.has(editingTask.id))) return;
    editorPending.current = true; setEditorBusy(true);
    try {
      const payload = {
        title: newTitle || 'Sem título',
        description: newDescription,
        priority: newPriority,
        status: newStatus,
        dueDate: newDueDate || (editingTask ? null : undefined),
        tags: newTags,
        checklist: newChecklist,
        projectId: newProjectId,
        pillarId: newPillarId,
        recurring: newRecurring,
        recurringFrequency: newRecurring ? newRecurringFrequency : undefined,
      };
      if (editingTask) {
        const updated = await apiFetch<Task>(`/api/tasks/${editingTask.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        setTasks(current => current.map(task => task.id === updated.id ? updated : task));
        setSelectedIds(current => { const next = new Set(current); next.delete(updated.id); return next; });
        if (!isTaskCompleted(editingTask, stages) && isTaskCompleted(updated, stages)) {
          void announceCompletion(editingTask, updated);
        } else if (isTaskCompleted(editingTask, stages) && !isTaskCompleted(updated, stages)) {
          toast.success('Tarefa reaberta');
        }
      } else {
        await apiFetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      setIsDialogOpen(false);
      loadTasks();
      toast.success(editingTask ? 'Tarefa atualizada!' : 'Tarefa criada!');
    } catch (err) {
      toast.error(showError(err));
    } finally { editorPending.current = false; setEditorBusy(false); }
  }

  function handleDelete(id: string) {
    const task = tasks.find(item => item.id === id);
    if (task) setDeletionTask(task);
  }

  function taskDeleted(task: Task) {
    setIsDialogOpen(false); void loadTasks();
    toast('Tarefa excluída', task.planning?.eventId ? {} : {
      action: { label: 'Desfazer', onClick: async () => {
        try {
          const restored = { title: task.title, description: task.description, status: task.status, priority: task.priority, dueDate: task.dueDate, projectId: task.projectId, pillarId: task.pillarId, tags: task.tags, recurring: task.recurring, recurringFrequency: task.recurringFrequency, sortOrder: task.sortOrder };
          await apiFetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...restored, checklist: task.checklist?.map(c => ({ ...c, id: uid('ck') })) || [] }) });
          void loadTasks(); toast.success('Tarefa restaurada!');
        } catch (error) { toast.error(showError(error)); }
      } },
    });
  }

  async function handleBulkDelete() {
    if (bulkBusy || pendingTaskIds.current.size || !selectedIds.size) return;
    setBulkBusy(true);
    try {
      const deletedTasks = filteredTasks.filter(t => selectedIds.has(t.id));
      if (!deletedTasks.length) return;
      const count = deletedTasks.length;
      await apiFetch('/api/tasks/batch', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: deletedTasks.map(task => task.id) }) });
      setSelectedIds(new Set());
      setBulkMode(false);
      setBulkDeleteOpen(false);
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
    } finally { setBulkBusy(false); }
  }

  async function handleBulkStatus(status: Task['status']) {
    if (bulkBusy || pendingTaskIds.current.size) return;
    const targets = filteredTasks.filter(task => selectedIds.has(task.id));
    if (!targets.length) return;
    setBulkBusy(true);
    try {
      const failed = new Set<string>();
      for (const task of targets) if (!await handleQuickPatch(task.id, { status })) failed.add(task.id);
      setSelectedIds(failed); setBulkMode(failed.size > 0);
      if (failed.size) toast.error(`${failed.size} tarefa(s) não foram alteradas. A seleção foi preservada para tentar novamente.`);
      else toast.success(`${targets.length} tarefa(s) atualizadas.`);
    } finally { setBulkBusy(false); }
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

  async function handleToggleDone(task: Task, restoreStatus?: string, destination?: string): Promise<boolean> {
    if (pendingTaskIds.current.has(task.id)) return false;
    pendingTaskIds.current.add(task.id); setBusyTasks(new Set(pendingTaskIds.current));
    const completed = isTaskCompleted(task, stages);
    const nextStatus = destination || restoreStatus || (completed ? previousStatuses.current.get(task.id) || taskReopenStatus(stages) : taskCompletionStatus(stages));
    let success = false;
    let newlyCompleted: Task | undefined;
    try {
      const updated = await apiFetch<Task>(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) });
      setTasks(current => current.map(item => item.id === task.id ? updated : item));
      setSelectedIds(current => { const next = new Set(current); next.delete(task.id); return next; });
      success = true;
      if (!completed && !restoreStatus) {
        newlyCompleted = updated;
      } else { toast.success('Tarefa reaberta'); }
    } catch (err) { toast.error(showError(err)); }
    finally { pendingTaskIds.current.delete(task.id); setBusyTasks(new Set(pendingTaskIds.current)); }
    if (newlyCompleted) {
      await announceCompletion(task, newlyCompleted);
    }
    return success;
  }

  async function announceCompletion(task: Task, completedTask: Task) {
      previousStatuses.current.set(task.id, task.status);
      fireConfetti();
      toast.success('Tarefa concluída! 🎉', {
        duration: 10000, description: completedTask.recurring ? 'A próxima ocorrência continua no planejamento.' : completedTask.title,
        action: { label: completedTask.recurring ? 'Reabrir' : 'Desfazer', onClick: () => { void handleToggleDone(completedTask, task.status); } },
      });
      if (!recurringCreated.current.has(task.id)) {
        recurringCreated.current.add(task.id);
        try {
          const next = await spawnNextOccurrenceIfRecurring(completedTask, taskReopenStatus(stages));
          if (next) setTasks(current => current.some(item => item.id === next.id) ? current : [...current, next]);
        } catch (err) {
          recurringCreated.current.delete(task.id);
          toast.error(`Tarefa concluída, mas a próxima ocorrência não foi criada: ${showError(err)}`);
        }
      }
  }

  async function handleQuickStatus(taskId: string, status: Task['status']) {
    return handleQuickPatch(taskId, { status });
  }

  async function handleQuickPatch(taskId: string, patch: TaskCellPatch): Promise<boolean> {
    const task = tasks.find(item => item.id === taskId);
    if (!task || pendingTaskIds.current.has(taskId)) return false;
    if (patch.status && patch.status !== task.status) {
      const wasDone = isTaskCompleted(task, stages);
      const willBeDone = isTaskCompleted({ status: patch.status }, stages);
      if (wasDone !== willBeDone) return handleToggleDone(task, wasDone ? patch.status : undefined, patch.status);
    }
    pendingTaskIds.current.add(taskId); setBusyTasks(new Set(pendingTaskIds.current));
    try {
      const updated = await apiFetch<Task>(`/api/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      setTasks(current => current.map(item => item.id === taskId ? updated : item));
      setSelectedIds(current => { const next = new Set(current); next.delete(taskId); return next; });
      return true;
    } catch (err) { toast.error(showError(err)); return false; }
    finally { pendingTaskIds.current.delete(taskId); setBusyTasks(new Set(pendingTaskIds.current)); }
  }

  async function handleQuickAdd(status: Task['status']) {
    if (!quickAddTitle.trim() || quickAddPending.current) return;
    quickAddPending.current = true; setQuickAddBusy(true);
    try {
      await apiFetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: quickAddTitle, status, priority: 'normal' }) });
      setQuickAddTitle('');
      setQuickAddStatus(null);
      loadTasks();
    } catch (err) {
      toast.error(showError(err));
    } finally { quickAddPending.current = false; setQuickAddBusy(false); }
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
  const dragClickRef = useRef(false);

  // ─── Filtered + Sorted ───────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (onlyCompleted && !isTaskCompleted(t, stages)) return false;
      if (!showDone && !search.trim() && isTaskCompleted(t, stages)) return false;
      if (filterOverdue && !taskIsOverdue(t, stages)) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterProject !== 'all' && t.projectId !== filterProject) return false;
      if (filterPillar !== 'all' && t.pillarId !== filterPillar) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || (t.tags ?? []).some(tag => tag.toLowerCase().includes(q));
      }
      return true;
    });
  }, [tasks, stages, onlyCompleted, showDone, filterOverdue, filterPriority, filterProject, filterPillar, search]);

  const sortedTasks = useMemo(() => {
    const arr = [...filteredTasks];
    if (sortBy === 'completedAt') arr.sort((a, b) => (b.completedAt || b.updatedAt || b.createdAt).localeCompare(a.completedAt || a.updatedAt || a.createdAt));
    else if (sortBy === 'title') arr.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === 'priority') arr.sort((a, b) => { const order = { urgent: 0, important: 1, normal: 2 }; return order[a.priority] - order[b.priority]; });
    else if (sortBy === 'status') { const order = stages.map(s => s.id); arr.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status)); }
    else if (sortBy === 'dueDate') arr.sort((a, b) => { if (!a.dueDate && !b.dueDate) return 0; if (!a.dueDate) return 1; if (!b.dueDate) return -1; return a.dueDate.localeCompare(b.dueDate); });
    else arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [filteredTasks, sortBy, stages]);

  const overdueCount = tasks.filter(isOverdue).length;

  // Pipeline stats
  const pipelineStats = useMemo(() => {
    return stages.map(s => ({ ...s, count: tasks.filter(t => t.status === s.id).length }));
  }, [tasks, stages]);
  const completedCount = tasks.filter(task => isTaskCompleted(task, stages)).length;

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
    setSelectedIds(new Set());
    if (key === 'overdue') setFilterOverdue(false);
    if (key === 'priority') setFilterPriority('all');
    if (key === 'project') setFilterProject('all');
    if (key === 'pillar') setFilterPillar('all');
    if (key === 'done') { setShowDone(false); setOnlyCompleted(false); }
  }

  function clearAllFilters() {
    setFilterOverdue(false);
    setFilterPriority('all');
    setFilterProject('all');
    setFilterPillar('all');
    setShowDone(false);
    setOnlyCompleted(false);
    setSearch('');
    setSelectedIds(new Set());
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
            'work-item-card task-kanban-card group cursor-grab transition-all hover:border-primary/50 hover:shadow-md hover:shadow-primary/5 active:cursor-grabbing border-l-3',
            draggedId === task.id && 'opacity-50 scale-95',
            isOverdue(task) && 'border-destructive/50',
            priorityConfig[task.priority].borderColor,
            isSelected && 'border-primary bg-primary/5 ring-1 ring-primary/30',
            bulkMode && 'cursor-pointer'
          )}
        >
          <CardContent className={cn('p-4', dense && 'p-2')}>
            <div className="flex items-start gap-2">
              {bulkMode ? (
                <button onClick={event => { event.stopPropagation(); toggleSelect(task.id); }} className="task-selection-target shrink-0" aria-label={isSelected ? `Desmarcar ${task.title}` : `Selecionar ${task.title}`}>
                  {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                </button>
              ) : (
                <GripVertical className="hidden" aria-hidden="true" />
              )}
              {!bulkMode && (
                <button onClick={(e) => { e.stopPropagation(); handleToggleDone(task); }} className="work-check min-h-11 min-w-11 shrink-0" disabled={busyTasks.has(task.id)} title={isTaskCompleted(task, stages) ? "Reabrir tarefa" : "Concluir tarefa"} aria-label={isTaskCompleted(task, stages) ? `Reabrir ${task.title}` : `Concluir ${task.title}`}>
                  {isTaskCompleted(task, stages) ? <CheckCircle2 className="h-4 w-4 text-money" /> : <Circle className={cn("h-4 w-4", isOverdue(task) ? 'text-destructive' : 'text-muted-foreground hover:text-foreground')} />}
                  <span>{isTaskCompleted(task, stages) ? 'Reabrir' : 'Concluir'}</span>
                </button>
              )}
              <div className="flex-1 min-w-0">
                <button disabled={busyTasks.has(task.id)} onClick={event => { event.stopPropagation(); openEdit(task); }} className={cn(dense ? 'text-xs' : 'text-sm', 'work-card-title text-left font-semibold leading-relaxed', isTaskCompleted(task, stages) && 'line-through text-muted-foreground')}>{task.title}</button>
                {!dense && task.professionalWorkId && <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground"><span>{task.workType === 'agent' ? 'Trabalho de agente' : task.workType === 'decision' ? 'Decisão' : task.workType === 'dependency' ? 'Dependência' : 'Tarefa humana'}{task.responsible ? ` · ${task.responsible}` : ''}</span><a href="/profissional" className="text-primary hover:underline" onClick={event => event.stopPropagation()}>Abrir briefing</a></p>}
                {!dense && task.nextAction && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">Próximo passo: {task.nextAction}</p>}
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
                  {task.priority !== 'normal' && <Badge variant="outline" className={cn(dense ? 'text-xs px-1 py-0' : 'text-xs px-1.5 py-0', priorityConfig[task.priority].textColor)}>
                    {priorityConfig[task.priority].label}
                  </Badge>}
                  {(task.tags ?? []).slice(0, dense ? 0 : 2).map(tag => (
                    <Badge key={tag} variant="secondary" className={cn(dense ? 'text-xs px-1 py-0' : 'text-xs px-1.5 py-0')}>
                      <Tag className="mr-1 h-2.5 w-2.5" /> {tag}
                    </Badge>
                  ))}
                  {(task.tags ?? []).length > (dense ? 0 : 2) && (
                    <Badge variant="secondary" className={cn(dense ? 'text-xs px-1 py-0' : 'text-xs px-1.5 py-0')}>+{(task.tags ?? []).length - (dense ? 0 : 2)}</Badge>
                  )}
                  {dense && task.checklist?.length > 0 && (
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
                  {!dense && !task.projectId && task.pillarId && (() => {
                    const pil = pillars.find(p => p.id === task.pillarId);
                    return pil ? (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 gap-1 border-border bg-muted/30">
                        {pil.emoji || '🏛️'} {pil.name}
                      </Badge>
                    ) : null;
                  })()}
                  {isTaskCompleted(task, stages) && task.completedAt && <Badge variant="outline" className="text-xs text-money">Concluída {new Date(task.completedAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Badge>}
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
                    <Button disabled={busyTasks.has(task.id)} onClick={event => event.stopPropagation()} variant="ghost" size="icon" aria-label={`Mais ações para ${task.title}`} className="work-more shrink-0">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={event => event.stopPropagation()}>
                    <DropdownMenuItem onClick={() => openEdit(task)}><Subtitles className="mr-2 h-4 w-4" /> Abrir</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleDone(task)}><CheckCircle2 className="mr-2 h-4 w-4" /> {isTaskCompleted(task, stages) ? 'Reabrir' : 'Concluir'}</DropdownMenuItem>
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
          <div className="task-kanban-fields" onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
            <label><span>Etapa</span><select className="task-cell-select" aria-label={`Etapa no quadro de ${task.title}`} value={task.status} disabled={busyTasks.has(task.id)} onChange={event => void handleQuickPatch(task.id, { status: event.target.value })}>{stages.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label>
            <label><span>Prioridade</span><select className={cn('task-cell-select', `task-priority-${task.priority}`)} aria-label={`Prioridade no quadro de ${task.title}`} value={task.priority} disabled={busyTasks.has(task.id)} onChange={event => void handleQuickPatch(task.id, { priority: event.target.value as Task['priority'] })}>{Object.entries(priorityConfig).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}</select></label>
            <DeadlineCell task={task} busy={busyTasks.has(task.id)} completed={isTaskCompleted(task, stages)} onPatch={handleQuickPatch} />
          </div>
        </Card>
      </motion.div>
    );
  }

  // ─── Kanban Column ───────────────────────────────────────────────────────

  function toggleColumn(key: string, items: Task[]) {
    setCollapsedColumns(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
    setSelectedIds(current => { const next = new Set(current); items.forEach(task => next.delete(task.id)); return next; });
  }

  function renderColumn(status: string, taskList: Task[]) {
    const cfg = getStage(status);
    return (
      <div key={status} className={cn('work-board-column task-kanban-column', draggedId && 'task-kanban-droppable', collapsedColumns.has(status) && 'task-kanban-collapsed')} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)}>
        <div className="flex items-center gap-2 mb-3 px-1">
          <button type="button" className="task-column-toggle" aria-expanded={!collapsedColumns.has(status)} aria-label={`${collapsedColumns.has(status) ? 'Expandir' : 'Recolher'} coluna ${getStatusLabel(status)}`} onClick={() => toggleColumn(status, taskList)}>{collapsedColumns.has(status) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
          <div className={cn('h-2.5 w-2.5 rounded-full', cfg?.dot || 'bg-muted-foreground')} />
          <h3 className="text-sm font-medium">{getStatusLabel(status)}</h3>
          <Badge variant="secondary" className="ml-auto text-xs">{taskList.length}</Badge>
          {bulkMode && taskList.length > 0 && !collapsedColumns.has(status) && (
            <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5" onClick={() => selectAll(status)}>Todos</Button>
          )}
        </div>
        {!collapsedColumns.has(status) && <><p className="task-column-summary">{taskList.filter(isOverdue).length} atrasadas · {taskList.filter(task => task.priority === 'urgent').length} urgentes</p><div className="task-column-meter" aria-hidden="true"><span style={{ width: `${sortedTasks.length ? taskList.length / sortedTasks.length * 100 : 0}%` }} /></div><div className="work-board-lane space-y-3">
          {taskList.map(renderTaskCard)}
          {taskList.length === 0 && quickAddStatus !== status && (
            <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50">Solte aqui</div>
          )}
          {quickAddStatus === status ? (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Card><CardContent className="p-2">
                <Input autoFocus disabled={quickAddBusy} aria-label={`Nova tarefa em ${getStatusLabel(status)}`} value={quickAddTitle} onChange={(e) => setQuickAddTitle(e.target.value)} placeholder="Título da tarefa..." className="h-11 text-sm border-0 bg-transparent"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(status); if (e.key === 'Escape') { setQuickAddStatus(null); setQuickAddTitle(''); } }}
                  onBlur={() => { if (!quickAddTitle.trim()) setQuickAddStatus(null); }} />
                <div className="flex gap-1 mt-1">
                  <Button size="sm" disabled={quickAddBusy || !quickAddTitle.trim()} className="min-h-11 text-xs px-2" onClick={() => handleQuickAdd(status)}>{quickAddBusy ? 'Salvando…' : 'Adicionar'}</Button>
                  <Button size="sm" disabled={quickAddBusy} variant="ghost" className="min-h-11 text-xs px-2" onClick={() => { setQuickAddStatus(null); setQuickAddTitle(''); }}>Cancelar</Button>
                </div>
              </CardContent></Card>
            </motion.div>
          ) : (
            <Button disabled={quickAddBusy} variant="ghost" className="w-full justify-start gap-2 text-muted-foreground/50 hover:text-muted-foreground text-xs" onClick={() => { setQuickAddStatus(status); setQuickAddTitle(''); }}>
              <Plus className="h-3 w-3" /> Adicionar tarefa
            </Button>
          )}
        </div></>}
      </div>
    );
  }

  // ─── Views ───────────────────────────────────────────────────────────────

  function renderKanban() {
    if (groupBy === 'status') {
      return (
        <div className="work-board" aria-label="Quadro de tarefas por etapa">
          <LayoutGroup id="task-kanban">
            {stages.map(s => renderColumn(s.id, sortedTasks.filter(t => t.status === s.id)))}
          </LayoutGroup>
        </div>
      );
    }
    return (
      <div className="work-board">
        <LayoutGroup id="task-kanban-grouped">
          {grouped.groupKeys.map(key => {
            const items = grouped.groups.get(key) || [];
            return (
              <div key={key} className="work-board-column task-kanban-column">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <button type="button" className="task-column-toggle" aria-expanded={!collapsedColumns.has(key)} aria-label={`${collapsedColumns.has(key) ? 'Expandir' : 'Recolher'} coluna ${getGroupLabel(key)}`} onClick={() => toggleColumn(key, items)}>{collapsedColumns.has(key) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
                  <div className={cn('h-2.5 w-2.5 rounded-full', getGroupDot(key))} />
                  <h3 className="text-sm font-medium">{getGroupLabel(key)}</h3>
                  <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>
                </div>
                {!collapsedColumns.has(key) && <div className="work-board-lane space-y-3">
                  {items.map(renderTaskCard)}
                  {items.length === 0 && <div className="flex flex-col items-center justify-center py-8 text-muted-foreground"><p className="text-xs">Nenhum item</p></div>}
                </div>}
              </div>
            );
          })}
        </LayoutGroup>
      </div>
    );
  }

  function renderList() {
    return <TaskWorkspaceTable
      groups={Array.from(grouped.groups.entries()).map(([id, items]) => ({ id, label: getGroupLabel(id), dot: getGroupDot(id), items }))}
      stages={stages} projects={projects} selectedIds={selectedIds} busyIds={busyTasks} dense={dense}
      onSelect={toggleSelect}
      onSelectVisible={(ids, selected) => setSelectedIds(current => { const next = new Set(current); ids.forEach(id => selected ? next.add(id) : next.delete(id)); return next; })}
      onOpen={id => { const task = tasks.find(item => item.id === id); if (task) openEdit(task); }}
      onComplete={id => { const task = tasks.find(item => item.id === id); if (task) void handleToggleDone(task); }}
      onPatch={handleQuickPatch}
      onDuplicate={id => { const task = tasks.find(item => item.id === id); if (task) void handleDuplicate(task); }}
      onDelete={handleDelete}
    />;
  }

  function renderDates(mode: 'calendar' | 'timeline') {
    return <TaskRichDates mode={mode} month={calendarMonth} onMonth={setCalendarMonth} tasks={sortedTasks} stages={stages} projects={projects} content={linkedContent} financial={calendarFinancial} busyIds={busyTasks} onPatch={handleQuickPatch}
      onOpen={id => { const task = tasks.find(item => item.id === id); if (task) openEdit(task); }}
      onComplete={id => { const task = tasks.find(item => item.id === id); if (task) void handleToggleDone(task); }}
      onCreate={date => { openCreate(); setNewDueDate(date); }} />;
  }

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <motion.div className="work-page work-tasks task-observatory p-4 lg:p-8" variants={stagger} initial="initial" animate="animate">
      {/* Header */}
      <motion.div className="mb-6" variants={fade}>
        <header className="task-observatory-heading"><div className="task-heading-orbit" aria-hidden="true"><span /><i /></div><div><p className="task-eyebrow"><Orbit className="h-3.5 w-3.5" />Seu espaço de execução</p><h1 className="font-display">Tarefas</h1><p className="task-heading-description">Organize o próximo passo. Mude os campos sem sair do trabalho.</p></div><div className="task-radar"><span><strong>{filteredTasks.length}</strong> nesta visão</span><button type="button" aria-pressed={filterOverdue} onClick={() => { setFilterOverdue(value => !value); setSelectedIds(new Set()); }} className={overdueCount ? 'task-overdue' : ''}><strong>{overdueCount}</strong> atrasadas</button><Button onClick={openCreate}><Plus className="h-4 w-4" />Nova tarefa</Button></div></header>

        {/* Pipeline Stats */}
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {pipelineStats.map(s => (
            <span key={s.id} className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className={cn('h-2 w-2 rounded-full', s.dot)} />{s.label}<span className="font-mono-num">{s.count}</span>
            </span>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Situação das tarefas">
          <Button size="sm" variant={!showDone ? 'default' : 'outline'} aria-pressed={!showDone} onClick={() => { setShowDone(false); setOnlyCompleted(false); setSelectedIds(new Set()); }}>Em aberto</Button>
          <Button size="sm" variant={onlyCompleted ? 'default' : 'outline'} aria-pressed={onlyCompleted} aria-label={`Mostrar concluídas (${completedCount})`} onClick={() => { setShowDone(true); setOnlyCompleted(true); setSelectedIds(new Set()); setFilterOverdue(false); setFilterPriority('all'); setFilterProject('all'); setFilterPillar('all'); setSearch(''); setView('list'); setSortBy('completedAt'); }}>Concluídas ({completedCount})</Button>
          <Button size="sm" variant={showDone && !onlyCompleted ? 'default' : 'outline'} aria-pressed={showDone && !onlyCompleted} onClick={() => { setShowDone(true); setOnlyCompleted(false); setSelectedIds(new Set()); }}>Todas</Button>
          <span className="task-interaction-hint text-xs text-muted-foreground">Título abre detalhes. Concluir é uma ação separada.{search.trim() ? ' A busca inclui concluídas.' : ''}</span>
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
            <>
              <div className="relative w-full shrink-0 sm:flex-1 lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => { setSearch(e.target.value); setSelectedIds(new Set()); }} aria-label="Buscar tarefas" placeholder="Buscar tarefas..." className="pl-9 h-11" />
              </div>

              <div className="flex flex-wrap items-center gap-2">

              {/* Filters Panel */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Filtros" className="work-filter h-9 gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" /><span>Filtros</span></Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Agrupar por</Label>
                      <Select value={groupBy} onValueChange={(v) => { setGroupBy(v as GroupBy); setSelectedIds(new Set()); setCollapsedColumns(new Set()); }}>
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
                          <SelectItem value="completedAt">Conclusões recentes</SelectItem>
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
                      <Select value={filterPriority} onValueChange={value => { setFilterPriority(value); setSelectedIds(new Set()); }}>
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
                      <Select value={filterProject} onValueChange={value => { setFilterProject(value); setSelectedIds(new Set()); }}>
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
                      <Select value={filterPillar} onValueChange={value => { setFilterPillar(value); setSelectedIds(new Set()); }}>
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
                {savedViews.map(v => (
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
                  { id: 'timeline' as const, icon: GanttChart, label: 'Linha do tempo' },
                  { id: 'focus' as const, icon: Crosshair, label: 'Foco' },
                  { id: 'load' as const, icon: ChartNoAxesColumnIncreasing, label: 'Carga' },
                ].map(v => (
                  <Button key={v.id} variant={view === v.id ? 'secondary' : 'ghost'} size="sm" aria-label={`Visualização: ${v.label}`} aria-pressed={view === v.id} title={v.label} className="h-8 px-3" onClick={() => { setView(v.id); setSelectedIds(new Set()); }}>
                    <v.icon className="h-4 w-4" /><span className="task-view-label">{v.id === 'kanban' ? 'Quadro' : v.label}</span>
                  </Button>
                ))}
              </div>

              </div>
            </>
        </div>
        {selectedIds.size > 0 && <section className="task-bulk-bar" aria-label="Ações das tarefas selecionadas"><span><strong>{selectedIds.size}</strong> selecionadas</span><Button variant="outline" size="sm" disabled={bulkBusy || busyTasks.size > 0} aria-label="Concluir selecionadas" onClick={() => void handleBulkStatus(taskCompletionStatus(stages))}><CheckCircle2 className="h-4 w-4" />Concluir</Button><Button variant="outline" size="sm" disabled={bulkBusy || busyTasks.size > 0} onClick={() => void handleBulkStatus(taskReopenStatus(stages))}>Reabrir</Button><select aria-label="Mover selecionadas para etapa" className="task-cell-select" value="" disabled={bulkBusy || busyTasks.size > 0} onChange={event => void handleBulkStatus(event.target.value)}><option value="" disabled>Mover para…</option>{stages.filter(stage => !stage.historical).map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select><Button variant="ghost" size="sm" disabled={bulkBusy || busyTasks.size > 0} onClick={() => setBulkDeleteOpen(true)}><Trash2 className="h-4 w-4" />Excluir</Button><Button variant="ghost" size="sm" disabled={bulkBusy} onClick={() => { setSelectedIds(new Set()); setBulkMode(false); }}>Limpar seleção</Button>{bulkBusy && <span role="status">Salvando…</span>}</section>}
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
      ) : filteredTasks.length === 0 && (view === 'list' || view === 'kanban') ? (
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
          {view === 'week' && <><p className="mb-3 text-xs text-muted-foreground">Agenda integrada de todas as tarefas. Os filtros acima se aplicam às outras visões.</p><PlanningWorkspace embedded onOpenTask={(_id, task) => { setTasks(current => current.map(item => item.id === task.id ? task : item)); openEdit(task); }} refreshKey={tasks.map(task => task.id + task.updatedAt).join(',')} onTasksChanged={() => void loadTasks()} /></>}
          {view === 'calendar' && renderDates('calendar')}
          {view === 'timeline' && renderDates('timeline')}
          {(view === 'focus' || view === 'load') && (() => {
            const Component = view === 'focus' ? TaskFocus : TaskLoad;
            return <Component tasks={sortedTasks} stages={stages} projects={projects} pillars={pillars} busyIds={busyTasks} onCreate={openCreate} onPatch={handleQuickPatch} onOpen={id => { const task = tasks.find(item => item.id === id); if (task) openEdit(task); }} onComplete={id => { const task = tasks.find(item => item.id === id); if (task) void handleToggleDone(task); }} />;
          })()}
        </motion.div>
      )}

      {/* Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={value => { if (!editorBusy) setIsDialogOpen(value); }}>
        <DialogContent className="task-detail-panel flex flex-col overflow-hidden translate-x-0 translate-y-0" onEscapeKeyDown={event => { if (editorBusy) event.preventDefault(); }}>
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
            <DialogDescription>{editingTask ? 'Altere os detalhes da tarefa' : 'Crie uma nova tarefa'}</DialogDescription>
          </DialogHeader>
          <fieldset disabled={editorBusy} className="task-detail-body flex-1 space-y-4 overflow-y-auto py-2 pr-1" aria-busy={editorBusy}>
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input aria-label="Título da tarefa" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="O que precisa ser feito?" autoFocus />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea aria-label="Descrição da tarefa" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Detalhes, notas, links..." rows={3} />
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
              <Input type="date" value={newDueDate} disabled={Boolean(editingTask?.planning?.startAt)} onChange={(e) => setNewDueDate(e.target.value)} className="max-w-[200px]" />
              {editingTask?.planning?.startAt && <p className="text-xs text-muted-foreground">Esta tarefa já tem um bloco de horário. Mova a data em <Link href="/planejar" className="text-primary underline">Planejar</Link> para manter o Google Agenda sincronizado.</p>}
              <div className="flex flex-wrap gap-1">
                {[{ label: 'Hoje', offset: 0 }, { label: 'Amanhã', offset: 1 }, { label: '2 dias', offset: 2 }, { label: 'Fim de semana', offset: (6 - new Date().getDay() + 7) % 7 || 7 }].map(s => (
                  <Button key={s.label} variant="outline" size="sm" disabled={Boolean(editingTask?.planning?.startAt)} className="h-6 text-xs px-2" onClick={() => { const d = new Date(); d.setDate(d.getDate() + s.offset); setNewDueDate(formatDateISO(d)); }}>{s.label}</Button>
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
          </fieldset>
          <DialogFooter className="shrink-0 gap-2 border-t pt-4">
            {editingTask && <Button variant="destructive" disabled={editorBusy} onClick={() => handleDelete(editingTask.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</Button>}
            <Button variant="outline" disabled={editorBusy} onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!newTitle.trim() || editorBusy}>{editorBusy ? 'Salvando…' : editingTask ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={bulkDeleteOpen} onOpenChange={value => { if (!bulkBusy) setBulkDeleteOpen(value); }}><DialogContent><DialogHeader><DialogTitle>Excluir tarefas selecionadas</DialogTitle><DialogDescription>Confirme a exclusão de {selectedIds.size} tarefas. Tarefas com eventos espelhados precisam do fluxo individual de exclusão para remover o evento corretamente.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={bulkBusy} onClick={() => setBulkDeleteOpen(false)}>Cancelar</Button><Button variant="destructive" disabled={bulkBusy} onClick={() => void handleBulkDelete()}>{bulkBusy ? 'Excluindo…' : 'Confirmar exclusão'}</Button></DialogFooter></DialogContent></Dialog>

      <StageConfigDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        scope="tasks"
        countUsage={(stageId) => tasks.filter(t => t.status === stageId).length}
        onSaved={setStages}
      />
      {deletionTask && <TaskDeleteDialog task={deletionTask} onClose={() => setDeletionTask(null)} onDeleted={() => taskDeleted(deletionTask)} />}
    </motion.div>
  );
}
