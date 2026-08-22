'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ChevronLeft, Eye, Edit3, Bold, Italic, Code, Quote, List, ListOrdered,
  Heading2, Heading3, Minus, Link as LinkIcon, CheckSquare, Sparkles, Tag,
  Calendar, Clock, Send, Archive, CheckCircle2, Globe, MonitorPlay, Camera,
  Video, Trash2, Copy, Pin, PinOff, Save, Maximize2, Minimize2, Type, Image,
  Hash, AtSign, Smile, BarChart3, ArrowRight, Square, ListChecks, Pilcrow,
  AlignLeft, AlignCenter, AlignRight, Undo, Redo, Strikethrough, CodeSquare,
  Blocks, PanelRightOpen, PanelRightClose
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentItem {
  id: string;
  title: string;
  body: string;
  channel: ContentChannel;
  stage: ContentStage;
  category: string;
  format: string;
  tags: string[];
  pinned: boolean;
  scheduledDate?: string;
  scheduledTime?: string;
  publishedUrl?: string;
  responsible?: string;
  editorialLine?: string;
  checklist?: { id: string; text: string; done: boolean }[];
  metrics?: { views?: number; likes?: number; comments?: number; shares?: number };
  createdAt: string;
  updatedAt: string;
}

type ContentChannel = 'blog' | 'youtube' | 'instagram' | 'tiktok';
type ContentStage = 'idea' | 'draft' | 'review' | 'scheduled' | 'published' | 'archived';

// ─── Constants ────────────────────────────────────────────────────────────────

const CHANNELS: Record<ContentChannel, { label: string; icon: typeof Globe; color: string; gradient: string; charLimit: number }> = {
  blog: { label: 'Blog', icon: Globe, color: 'text-blue-400', gradient: 'from-blue-500/20 to-blue-600/5', charLimit: 999999 },
  youtube: { label: 'YouTube', icon: MonitorPlay, color: 'text-red-400', gradient: 'from-red-500/20 to-red-600/5', charLimit: 5000 },
  instagram: { label: 'Instagram', icon: Camera, color: 'text-pink-400', gradient: 'from-pink-500/20 to-purple-600/5', charLimit: 2200 },
  tiktok: { label: 'TikTok', icon: Video, color: 'text-cyan-400', gradient: 'from-cyan-500/20 to-teal-600/5', charLimit: 2200 },
};

const STAGES: Record<ContentStage, { label: string; icon: typeof Sparkles; color: string; dot: string }> = {
  idea: { label: 'Ideia', icon: Sparkles, color: 'text-purple-400', dot: 'bg-purple-500' },
  draft: { label: 'Roteiro', icon: Edit3, color: 'text-yellow-400', dot: 'bg-yellow-500' },
  review: { label: 'Produção', icon: Eye, color: 'text-orange-400', dot: 'bg-orange-500' },
  scheduled: { label: 'Agendado', icon: Calendar, color: 'text-blue-400', dot: 'bg-blue-500' },
  published: { label: 'Publicado', icon: CheckCircle2, color: 'text-green-400', dot: 'bg-green-500' },
  archived: { label: 'Arquivado', icon: Archive, color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

const CHANNEL_CATEGORIES: Record<ContentChannel, string[]> = {
  blog: ['Artigo', 'Tutorial', 'Review', 'Case Study', 'Guia', 'Notícia', 'Opinião'],
  youtube: ['Vlog', 'Tutorial', 'Review', 'Entrevista', 'Short', 'Vídeo-aula', 'Timelapse'],
  instagram: ['Post', 'Reels', 'Stories', 'Carrossel', 'IGTV', 'Enquete', 'Destaques'],
  tiktok: ['Trend', 'Tutorial', 'Humor', 'Behind the scenes', 'Dica', 'Dueto', 'Stitch'],
};

const FORMATS: Record<ContentChannel, string[]> = {
  blog: ['Artigo longo', 'Listicle', 'How-to', 'Case study', 'Entrevista', 'Newsletter'],
  youtube: ['Vídeo longo', 'Short', 'Live', 'Collab', 'Compilation', 'Vlog'],
  instagram: ['Feed', 'Reels', 'Stories', 'Carrossel', 'Live', 'Guide'],
  tiktok: ['Vídeo', 'Photo', 'Duet', 'Stitch', 'Live', 'Séries'],
};

const EDITORIAL_LINES = [
  { id: 'arco-tech', label: 'ARCO Tech', color: '#3b82f6', icon: '⚡' },
  { id: 'arco-labs', label: 'ARCO Labs', color: '#8b5cf6', icon: '🔬' },
  { id: 'arco-pass', label: 'ARCO Pass', color: '#22c55e', icon: '🎫' },
  { id: 'rataria', label: 'Rataria S.A.', color: '#f59e0b', icon: '♟️' },
  { id: 'dona-maria', label: 'Dona Maria', color: '#ef4444', icon: '🍷' },
];

const SLASH_COMMANDS = [
  { id: 'heading2', label: 'Heading 2', icon: Heading2, syntax: '## ' },
  { id: 'heading3', label: 'Heading 3', icon: Heading3, syntax: '### ' },
  { id: 'bold', label: 'Bold', icon: Bold, syntax: '**$1**' },
  { id: 'italic', label: 'Italic', icon: Italic, syntax: '*$1*' },
  { id: 'strikethrough', label: 'Strikethrough', icon: Strikethrough, syntax: '~~$1~~' },
  { id: 'code', label: 'Code', icon: Code, syntax: '`$1`' },
  { id: 'codeblock', label: 'Code Block', icon: CodeSquare, syntax: '```\n$1\n```' },
  { id: 'quote', label: 'Quote', icon: Quote, syntax: '> ' },
  { id: 'bullet', label: 'Bullet List', icon: List, syntax: '- ' },
  { id: 'numbered', label: 'Numbered List', icon: ListOrdered, syntax: '1. ' },
  { id: 'divider', label: 'Divider', icon: Minus, syntax: '\n---\n' },
  { id: 'link', label: 'Link', icon: LinkIcon, syntax: '[$1](url)' },
  { id: 'checklist', label: 'Checklist', icon: CheckSquare, syntax: '- [ ] ' },
  { id: 'callout-info', label: 'Callout 💡', icon: Smile, syntax: '\n> 💡 ' },
  { id: 'callout-warning', label: 'Callout ⚠️', icon: Smile, syntax: '\n> ⚠️ ' },
  { id: 'callout-danger', label: 'Callout 🚫', icon: Smile, syntax: '\n> 🚫 ' },
  { id: 'callout-success', label: 'Callout ✅', icon: Smile, syntax: '\n> ✅ ' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function charCount(text: string): number {
  return text.replace(/<[^>]*>/g, '').length;
}

function getWordEstimate(text: string, channel: ContentChannel): { value: string; progress: number; over: boolean } {
  const chars = charCount(text);
  const words = wordCount(text);
  const limit = CHANNELS[channel].charLimit;

  if (channel === 'youtube') {
    const mins = Math.round(words / 150);
    return { value: `~${mins}min de vídeo`, progress: Math.min((words / 3000) * 100, 100), over: false };
  }
  if (channel === 'blog') {
    return { value: `${words} palavras`, progress: Math.min((words / 1500) * 100, 100), over: false };
  }
  if (channel === 'instagram') {
    return { value: `${chars}/${limit} chars`, progress: (chars / limit) * 100, over: chars > limit };
  }
  if (channel === 'tiktok') {
    const secs = Math.min(Math.round(words / 2.5), 60);
    return { value: `~${secs}s`, progress: (chars / limit) * 100, over: chars > limit };
  }
  return { value: `${words} palavras`, progress: 0, over: false };
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2 text-foreground">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-4 mb-2 text-foreground">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2 text-foreground">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-primary/30 pl-3 italic text-muted-foreground my-2">$1</blockquote>')
    .replace(/^- \[x\] (.+)$/gm, '<div class="flex items-center gap-2 my-1"><input type="checkbox" checked disabled class="accent-primary" /><span class="line-through text-muted-foreground">$1</span></div>')
    .replace(/^- \[ \] (.+)$/gm, '<div class="flex items-center gap-2 my-1"><input type="checkbox" disabled class="accent-primary" /><span>$1</span></div>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+) (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline hover:text-primary/80">$1</a>')
    .replace(/\n{2,}/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>');
}

// ─── Slash Command Menu ──────────────────────────────────────────────────────

function SlashCommandMenu({
  open,
  position,
  onSelect,
  onClose,
}: {
  open: boolean;
  position: { top: number; left: number };
  onSelect: (syntax: string) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = SLASH_COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    if (open) { setFilter(''); setSelectedIndex(0); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => Math.max(prev - 1, 0)); }
      if (e.key === 'Enter' && filtered[selectedIndex]) { e.preventDefault(); onSelect(filtered[selectedIndex].syntax); onClose(); }
      if (e.key === 'Escape') { onClose(); }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filtered, selectedIndex, onSelect, onClose]);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      className="fixed z-[200] w-64 rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-2 border-b border-border/50">
        <input
          autoFocus
          value={filter}
          onChange={e => { setFilter(e.target.value); setSelectedIndex(0); }}
          placeholder="Buscar comando..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <ScrollArea className="max-h-64">
        <div className="p-1">
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => { onSelect(cmd.syntax); onClose(); }}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                i === selectedIndex ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <cmd.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{cmd.label}</span>
              <kbd className="text-[10px] text-muted-foreground/50 font-mono">/</kbd>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="py-4 text-center text-xs text-muted-foreground">Nenhum comando</div>
          )}
        </div>
      </ScrollArea>
    </motion.div>
  );
}

// ─── Platform Preview ────────────────────────────────────────────────────────

function PlatformPreview({
  channel,
  title,
  body,
  editorialLine,
}: {
  channel: ContentChannel;
  title: string;
  body: string;
  editorialLine?: string;
}) {
  const line = EDITORIAL_LINES.find(l => l.id === editorialLine);

  if (channel === 'instagram' || channel === 'tiktok') {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 max-w-sm mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
            <span className="text-xs font-bold">J</span>
          </div>
          <div>
            <p className="text-xs font-medium">jonny</p>
            <p className="text-[10px] text-muted-foreground">agora</p>
          </div>
        </div>
        <div className="aspect-square rounded-lg bg-muted/50 mb-3 flex items-center justify-center">
          <div className="text-center">
            {line && <span className="text-2xl">{line.icon}</span>}
            <p className="text-sm font-medium mt-2 px-4">{title || 'Título do post'}</p>
          </div>
        </div>
        <div className="text-xs whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderMarkdown(body || 'Seu conteúdo aqui...') }} />
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 text-muted-foreground">
          <span className="text-lg">♡</span>
          <span className="text-lg">💬</span>
          <span className="text-lg">↗</span>
          <span className="text-lg ml-auto">🔖</span>
        </div>
      </div>
    );
  }

  if (channel === 'youtube') {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 max-w-md mx-auto">
        <div className="aspect-video rounded-lg bg-muted/50 mb-3 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-red-500/90 flex items-center justify-center">
              <div className="h-0 w-0 border-l-[16px] border-l-white border-y-[10px] border-y-transparent ml-1" />
            </div>
          </div>
          {line && <span className="absolute top-2 left-2 text-lg">{line.icon}</span>}
        </div>
        <h4 className="text-sm font-medium mb-1">{title || 'Título do vídeo'}</h4>
        <p className="text-xs text-muted-foreground">jonny · agora</p>
        <div className="text-xs mt-2 whitespace-pre-wrap line-clamp-3" dangerouslySetInnerHTML={{ __html: renderMarkdown(body || 'Descrição...') }} />
      </div>
    );
  }

  // Blog
  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 p-6 max-w-lg mx-auto">
      {line && (
        <div className="flex items-center gap-1.5 mb-3">
          <span>{line.icon}</span>
          <span className="text-xs font-medium" style={{ color: line.color }}>{line.label}</span>
        </div>
      )}
      <h1 className="text-xl font-bold mb-4">{title || 'Título do artigo'}</h1>
      <div className="text-sm leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderMarkdown(body || 'Comece a escrever...') }} />
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

interface ContentEditorProps {
  open: boolean;
  onClose: () => void;
  editingItem: ContentItem | null;
  activeChannel: ContentChannel | 'all';
  onSaved: () => void;
}

export function ContentEditor({
  open,
  onClose,
  editingItem,
  activeChannel,
  onSaved,
}: ContentEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState<ContentChannel>('blog');
  const [stage, setStage] = useState<ContentStage>('idea');
  const [category, setCategory] = useState('');
  const [format, setFormat] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [publishedUrl, setPublishedUrl] = useState('');
  const [responsible, setResponsible] = useState('');
  const [editorialLine, setEditorialLine] = useState('');
  const [checklist, setChecklist] = useState<{ id: string; text: string; done: boolean }[]>([]);
  // Guards the backdrop's close-on-click against the same click gesture that
  // opened the panel: a fast click can dispatch mousedown/mouseup far enough
  // apart that React mounts the full-viewport backdrop under the cursor
  // between them, so mouseup lands on the backdrop and closes the panel
  // it just opened.
  const openedAtRef = useRef(0);

  // Initialize form
  useEffect(() => {
    if (!open) return;
    openedAtRef.current = Date.now();
    if (editingItem) {
      setTitle(editingItem.title);
      setBody(editingItem.body);
      setChannel(editingItem.channel);
      setStage(editingItem.stage);
      setCategory(editingItem.category);
      setFormat(editingItem.format || '');
      setTags(editingItem.tags || []);
      setScheduledDate(editingItem.scheduledDate || '');
      setScheduledTime(editingItem.scheduledTime || '');
      setPublishedUrl(editingItem.publishedUrl || '');
      setResponsible(editingItem.responsible || '');
      setEditorialLine(editingItem.editorialLine || '');
      setChecklist(editingItem.checklist?.map(c => ({ ...c })) || []);
    } else {
      const ch = activeChannel === 'all' ? 'blog' : activeChannel;
      setTitle('');
      setBody('');
      setChannel(ch);
      setStage('idea');
      setCategory(CHANNEL_CATEGORIES[ch][0]);
      setFormat(FORMATS[ch][0]);
      setTags([]);
      setScheduledDate('');
      setScheduledTime('');
      setPublishedUrl('');
      setResponsible('');
      setEditorialLine('');
      setChecklist([]);
    }
    setShowPreview(false);
    setFocusMode(false);
  }, [open, editingItem, activeChannel]);

  // Platform stats
  const platformStats = useMemo(() => getWordEstimate(body, channel), [body, channel]);
  const charLimit = CHANNELS[channel].charLimit;
  const currentChars = charCount(body);

  // Insert markdown at cursor
  const insertMarkdown = useCallback((syntax: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.substring(start, end);
    let replacement = syntax;
    if (syntax.includes('$1') && selected) replacement = syntax.replace('$1', selected);
    const newBody = body.substring(0, start) + replacement + body.substring(end);
    setBody(newBody);
    setTimeout(() => {
      ta.focus();
      const pos = start + replacement.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }, [body]);

  // Handle slash commands
  const handleBodyChange = useCallback((value: string) => {
    setBody(value);
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const textBefore = value.substring(0, pos);
    const lastLine = textBefore.split('\n').pop() || '';
    if (lastLine === '/') {
      const rect = ta.getBoundingClientRect();
      const lines = textBefore.split('\n').length;
      setSlashPos({
        top: rect.top + lines * 24 + 8,
        left: rect.left + 8,
      });
      setSlashOpen(true);
    } else {
      setSlashOpen(false);
    }
  }, []);

  // Save
  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        title: title || 'Sem título',
        body,
        channel,
        stage,
        category,
        format,
        tags,
        scheduledDate: scheduledDate || undefined,
        scheduledTime: scheduledTime || undefined,
        publishedUrl: publishedUrl || undefined,
        responsible: responsible || undefined,
        editorialLine: editorialLine || undefined,
        checklist,
      };
      if (editingItem) {
        await apiFetch(`/api/content/${editingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      onSaved();
      onClose();
      toast.success(editingItem ? 'Conteúdo atualizado!' : 'Conteúdo criado!');
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setSaving(false);
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape' && !slashOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, slashOpen, title, body, channel, stage]);

  function addTag() {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) { setTags([...tags, tag]); setTagInput(''); }
  }

  function toggleChecklistItem(id: string) {
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, done: !c.done } : c));
  }

  const ch = CHANNELS[channel];
  const ChIcon = ch.icon;
  const st = STAGES[stage];

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  // Portaled to <body> so `fixed` positioning is relative to the real viewport,
  // not the ReactLenis smooth-scroll wrapper's transformed containing block.
  return createPortal(
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm"
        onClick={() => { if (Date.now() - openedAtRef.current >= 250) onClose(); }}
      />

      {/* Editor Panel */}
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className={cn(
          'fixed right-0 top-0 z-[101] h-screen flex flex-col bg-background border-l border-border',
          focusMode ? 'w-full' : 'w-full max-w-5xl'
        )}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <ChIcon className={cn('h-4 w-4 shrink-0', ch.color)} />
              <span className="text-sm font-medium truncate">{editingItem ? 'Editando' : 'Novo Conteúdo'}</span>
              <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                <div className={cn('h-1.5 w-1.5 rounded-full', st.dot)} /> {st.label}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Platform stats */}
            <div className="hidden sm:flex items-center gap-2 mr-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">{platformStats.value}</span>
                {charLimit < 999999 && (
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-300', platformStats.over ? 'bg-destructive' : 'bg-primary')}
                      style={{ width: `${Math.min(platformStats.progress, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFocusMode(!focusMode)}>
              {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? <Edit3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!title.trim() || saving} className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        {/* Pipeline Quick Actions */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border/50 overflow-x-auto shrink-0">
          {Object.entries(STAGES).map(([id, s]) => {
            const SIcon = s.icon;
            const isActive = stage === id;
            return (
              <button
                key={id}
                onClick={() => setStage(id as ContentStage)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all shrink-0',
                  isActive
                    ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <SIcon className="h-3 w-3" />
                {s.label}
              </button>
            );
          })}
          <Separator orientation="vertical" className="h-5 mx-1" />
          {/* Channel quick switch */}
          {(Object.keys(CHANNELS) as ContentChannel[]).map(chId => {
            const c = CHANNELS[chId];
            const CIcon = c.icon;
            return (
              <button
                key={chId}
                onClick={() => {
                  setChannel(chId);
                  setCategory(CHANNEL_CATEGORIES[chId][0]);
                  setFormat(FORMATS[chId][0]);
                }}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-all shrink-0',
                  channel === chId
                    ? `${c.color} bg-current/10 ring-1 ring-current/20`
                    : 'text-muted-foreground hover:bg-muted/50'
                )}
              >
                <CIcon className="h-3 w-3" />
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor Side */}
          <div className={cn('flex-1 flex flex-col overflow-hidden', showPreview && 'border-r border-border/50')}>
            <ScrollArea className="flex-1">
              <div className={cn('p-6', focusMode && 'max-w-2xl mx-auto')}>
                {/* Title */}
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Título do conteúdo..."
                  className="w-full text-2xl font-bold bg-transparent outline-none placeholder:text-muted-foreground/50 mb-4"
                  autoFocus
                />

                {/* Editorial Line Pills */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {EDITORIAL_LINES.map(line => (
                    <button
                      key={line.id}
                      onClick={() => setEditorialLine(editorialLine === line.id ? '' : line.id)}
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all border',
                        editorialLine === line.id
                          ? 'border-current shadow-sm'
                          : 'border-border/50 text-muted-foreground hover:bg-muted/50'
                      )}
                      style={editorialLine === line.id ? { color: line.color, borderColor: line.color, backgroundColor: line.color + '15' } : undefined}
                    >
                      {line.icon} {line.label}
                    </button>
                  ))}
                </div>

                {/* Body Editor */}
                <div className="relative mb-6">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 border-border/50 bg-muted/20 px-2 py-1.5">
                    {[
                      { icon: Heading2, action: () => insertMarkdown('## '), title: 'Heading' },
                      { icon: Bold, action: () => insertMarkdown('**$1**'), title: 'Bold' },
                      { icon: Italic, action: () => insertMarkdown('*$1*'), title: 'Italic' },
                      { icon: Strikethrough, action: () => insertMarkdown('~~$1~~'), title: 'Strike' },
                      { icon: Code, action: () => insertMarkdown('`$1`'), title: 'Code' },
                      { icon: Quote, action: () => insertMarkdown('> '), title: 'Quote' },
                      { icon: List, action: () => insertMarkdown('- '), title: 'List' },
                      { icon: ListOrdered, action: () => insertMarkdown('1. '), title: 'Ordered' },
                      { icon: CheckSquare, action: () => insertMarkdown('- [ ] '), title: 'Checklist' },
                      { icon: LinkIcon, action: () => insertMarkdown('[$1](url)'), title: 'Link' },
                      { icon: Minus, action: () => insertMarkdown('\n---\n'), title: 'Divider' },
                    ].map((btn, i) => (
                      <Button key={i} variant="ghost" size="icon" className="h-7 w-7" title={btn.title} onClick={btn.action} type="button">
                        <btn.icon className="h-3.5 w-3.5" />
                      </Button>
                    ))}
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-mono">{currentChars.toLocaleString('pt-BR')} chars</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">{wordCount(body)} palavras</span>
                    </div>
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={body}
                    onChange={e => handleBodyChange(e.target.value)}
                    placeholder="Escreva seu conteúdo aqui... (Use / para comandos de formatação)"
                    className="w-full min-h-[300px] rounded-b-lg border border-border/50 bg-background p-4 text-sm leading-relaxed outline-none resize-none placeholder:text-muted-foreground/50 focus:border-primary/30"
                  />
                </div>

                {/* Meta Fields */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Categoria</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{CHANNEL_CATEGORIES[channel].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Formato</Label>
                    <Select value={format} onValueChange={setFormat}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{FORMATS[channel].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Data</Label>
                    <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Horário</Label>
                    <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Responsável</Label>
                    <Input value={responsible} onChange={e => setResponsible(e.target.value)} placeholder="Nome" className="h-8 text-xs" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">URL Publicada</Label>
                    <Input value={publishedUrl} onChange={e => setPublishedUrl(e.target.value)} placeholder="https://..." className="h-8 text-xs" />
                  </div>
                </div>

                {/* Checklist */}
                <div className="mb-6">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Checklist de Produção</Label>
                  <div className="space-y-1 mb-2">
                    {checklist.map(item => (
                      <div key={item.id} className="flex items-center gap-2 group">
                        <button onClick={() => toggleChecklistItem(item.id)} type="button">
                          {item.done ? <CheckSquare className="h-4 w-4 text-money shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0" />}
                        </button>
                        <span className={cn('text-sm flex-1', item.done && 'line-through text-muted-foreground')}>{item.text}</span>
                        <button onClick={() => setChecklist(prev => prev.filter(c => c.id !== item.id))} className="opacity-0 group-hover:opacity-100 transition-opacity" type="button">
                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="new-checklist-item"
                      placeholder="Nova etapa..."
                      className="h-8 text-xs"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          if (input.value.trim()) {
                            setChecklist(prev => [...prev, { id: `cl_${Date.now()}`, text: input.value.trim(), done: false }]);
                            input.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Tags */}
                <div className="mb-6">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Tags</Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                        <Tag className="h-3 w-3" /> {tag}
                        <button onClick={() => setTags(tags.filter(t => t !== tag))} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Nova tag..." className="h-8 text-xs"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                    <Button type="button" variant="outline" size="sm" className="h-8" onClick={addTag}><Tag className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Preview Side */}
          <AnimatePresence>
            {showPreview && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: '50%', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                className="overflow-hidden"
              >
                <div className="h-full overflow-y-auto p-6 bg-muted/10">
                  <div className="flex items-center gap-2 mb-4">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Preview — {ch.label}</span>
                  </div>
                  <PlatformPreview
                    channel={channel}
                    title={title}
                    body={body}
                    editorialLine={editorialLine}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Slash Command Menu */}
        <AnimatePresence>
          <SlashCommandMenu
            open={slashOpen}
            position={slashPos}
            onSelect={insertMarkdown}
            onClose={() => setSlashOpen(false)}
          />
        </AnimatePresence>
      </motion.div>
    </>,
    document.body
  );
}
