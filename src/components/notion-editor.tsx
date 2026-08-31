'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import { SlashCommand } from '@/lib/tiptap-extensions/slash-command';
import { PageEmbed } from '@/lib/tiptap-extensions/page-embed';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Typography from '@tiptap/extension-typography';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Minus, CodeSquare,
  Image as ImageIcon, Link as LinkIcon, Undo, Redo, Table as TableIcon,
  Palette, Highlighter, Pilcrow, ArrowUp, ArrowDown, Trash2,
  Plus, MoreHorizontal, GripVertical, PanelTop, ChevronDown,
  Type, AtSign, Smile, Columns
} from 'lucide-react';

// ─── Callout Extension (inline) ────────────────────────────────────────────────

const CALLOUT_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  gray:   { bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', label: 'Cinza' },
  blue:   { bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Azul' },
  yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'Amarelo' },
  red:    { bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Vermelho' },
  green:  { bg: 'bg-green-500/10', border: 'border-green-500/30', label: 'Verde' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', label: 'Roxo' },
};

const CALLOUT_ICONS = ['💡', '⚠️', '🚫', '✅', '🔥', '📝', '💬', '🎯', '⚡', '🚨', '📌', '🎵'];

// ─── Types ─────────────────────────────────────────────────────────────────────

interface NotionEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  showToolbar?: boolean;
  compact?: boolean;
  // Sub-pages (Notion-style "+ Página" block): creates a new Capture with
  // status 'noted' and returns its id/title so the embed block can link to
  // it. Falls back to a plain POST /api/captures if the host page doesn't
  // pass its own (e.g. content-editor.tsx doesn't need custom behavior here).
  onCreateSubpage?: () => Promise<{ id: string; title: string }>;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function NotionEditor({
  content,
  onChange,
  placeholder = 'Escreva algo...',
  className,
  editable = true,
  showToolbar = true,
  compact = false,
  onCreateSubpage,
}: NotionEditorProps) {
  const [isDragging, setIsDragging] = useState(false);

  const createSubpage = useCallback(async () => {
    if (onCreateSubpage) return onCreateSubpage();
    const res = await fetch('/api/captures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '<h2>Nova página</h2>', type: 'text', status: 'noted' }),
    });
    const data = await res.json();
    return { id: data.id, title: 'Nova página' };
  }, [onCreateSubpage]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        dropcursor: {
          color: 'hsl(262 90% 70%)',
          width: 2,
        },
        // StarterKit bundles its own Link extension; we configure Link
        // separately below (autolink, openOnClick), so disable the
        // built-in one to avoid a duplicate-extension warning/conflict.
        link: false,
      }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Typography,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      SlashCommand,
      PageEmbed.configure({ onCreatePage: createSubpage }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: cn(
          'focus:outline-none min-h-[80px] relative',
          '[&_p.is-editor-empty:first-child]:text-muted-foreground',
          'prose-editor',
          className,
        ),
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer?.files?.length) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            uploadAndInsertImage(file, editor);
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event, slice) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) {
                uploadAndInsertImage(file, editor);
                return true;
              }
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content]);

  // The slash menu's "Imagem" item can't open a file picker itself (it runs
  // inside a detached React root outside this component's tree), so it
  // dispatches this event and lets the editor that owns the upload logic
  // handle it instead.
  useEffect(() => {
    if (!editor) return;
    function handleInsertImage() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/gif,image/webp';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) uploadAndInsertImage(file, editor);
      };
      input.click();
    }
    window.addEventListener('notion-editor-insert-image', handleInsertImage);
    return () => window.removeEventListener('notion-editor-insert-image', handleInsertImage);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="relative group/editor">
      {showToolbar && editable && <EnhancedToolbar editor={editor} compact={compact} />}
      {editable && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ state }) => !state.selection.empty}
          appendTo={() => document.body}
          className="z-[200]"
          options={{ strategy: 'fixed', placement: 'bottom', offset: 8 }}
        >
          <SelectionToolbar editor={editor} />
        </BubbleMenu>
      )}
      {editable && (
        <DragHandle editor={editor}>
          <div className="flex h-6 w-5 cursor-grab items-center justify-center rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing">
            <GripVertical className="h-4 w-4" />
          </div>
        </DragHandle>
      )}
      <EditorContent editor={editor} className="mt-2" />
      {editable && <TableControls editor={editor} />}
    </div>
  );
}

// ─── Selection Bubble Menu ─────────────────────────────────────────────────────
// Notion's core formatting UX: select text, a floating toolbar appears right
// above the selection. No persistent chrome needed for basic formatting.

function SelectionToolbar({ editor }: { editor: any }) {
  const btn = (active: boolean, onClick: () => void, children: React.ReactNode, title: string) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={cn(
        'h-7 w-7 flex items-center justify-center rounded text-xs transition-colors',
        active ? 'bg-primary/25 text-primary' : 'text-foreground/80 hover:bg-white/10'
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="z-50 flex items-center gap-0.5 rounded-lg glass-strong shadow-xl px-1 py-1">
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold className="w-3.5 h-3.5" />, 'Negrito')}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic className="w-3.5 h-3.5" />, 'Itálico')}
      {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), <Strikethrough className="w-3.5 h-3.5" />, 'Tachado')}
      {btn(editor.isActive('code'), () => editor.chain().focus().toggleCode().run(), <Code className="w-3.5 h-3.5" />, 'Código')}
      <div className="w-px h-4 bg-border/60 mx-0.5" />
      {btn(editor.isActive('highlight'), () => editor.chain().focus().toggleHighlight({ color: '#fbbf24' }).run(), <Highlighter className="w-3.5 h-3.5" />, 'Destacar')}
      {btn(editor.isActive('link'), () => {
        if (editor.isActive('link')) {
          editor.chain().focus().unsetLink().run();
          return;
        }
        const url = window.prompt('URL do link:');
        if (url) editor.chain().focus().setLink({ href: url }).run();
      }, <LinkIcon className="w-3.5 h-3.5" />, 'Link')}
    </div>
  );
}

// ─── Image Upload Helper ───────────────────────────────────────────────────────

async function uploadAndInsertImage(file: File, editor: any) {
  if (file.size > 2 * 1024 * 1024) {
    toast.error('Imagem muito grande. Máximo 2MB.');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    toast.info('Enviando imagem...');
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    
    if (data.url) {
      editor.chain().focus().setImage({ 
        src: data.url, 
        alt: file.name,
      }).run();
      toast.success(`Imagem otimizada: ${(data.optimizedSize / 1024).toFixed(0)}KB`);
    } else {
      toast.error(data.error || 'Falha no upload');
    }
  } catch (err) {
    toast.error('Erro ao enviar imagem');
  }
}

// ─── Enhanced Toolbar ──────────────────────────────────────────────────────────

function EnhancedToolbar({ editor, compact }: { editor: any; compact?: boolean }) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
        setShowHighlightPicker(false);
        setShowInsertMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const btn = (
    active: boolean, 
    onClick: () => void, 
    children: React.ReactNode, 
    tooltip?: string,
    disabled = false
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={cn(
        'h-7 px-1.5 rounded text-xs font-medium transition-all duration-150',
        'alvo-dedo',
        active ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
        disabled && 'opacity-30 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );

  const sep = <div className="w-px h-4 bg-border/60 mx-0.5" />;

  return (
    <div 
      ref={colorRef}
      className={cn(
        'flex flex-wrap items-center gap-0.5',
        'border-b border-border/40 pb-2 mb-2',
        'sticky top-0 z-20 bg-background/80 backdrop-blur-sm',
      )}
    >
      {/* Undo/Redo */}
      {btn(false, () => editor.chain().focus().undo().run(), <Undo className="w-3.5 h-3.5" />, 'Desfazer (Ctrl+Z)')}
      {btn(false, () => editor.chain().focus().redo().run(), <Redo className="w-3.5 h-3.5" />, 'Refazer (Ctrl+Shift+Z)')}
      {sep}

      {/* Headings */}
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 className="w-3.5 h-3.5" />, 'Heading 1')}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 className="w-3.5 h-3.5" />, 'Heading 2')}
      {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), <Heading3 className="w-3.5 h-3.5" />, 'Heading 3')}
      {sep}

      {/* Text formatting */}
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold className="w-3.5 h-3.5" />, 'Negrito (Ctrl+B)')}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic className="w-3.5 h-3.5" />, 'Itálico (Ctrl+I)')}
      {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), <Strikethrough className="w-3.5 h-3.5" />, 'Tachado')}
      {btn(editor.isActive('code'), () => editor.chain().focus().toggleCode().run(), <Code className="w-3.5 h-3.5" />, 'Código inline')}
      {sep}

      {/* Lists */}
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List className="w-3.5 h-3.5" />, 'Lista com marcadores')}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered className="w-3.5 h-3.5" />, 'Lista numerada')}
      {btn(editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run(), <CheckSquare className="w-3.5 h-3.5" />, 'Lista de tarefas')}
      {sep}

      {/* Blocks */}
      {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), <Quote className="w-3.5 h-3.5" />, 'Citação')}
      {btn(editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run(), <CodeSquare className="w-3.5 h-3.5" />, 'Bloco de código')}
      {btn(false, () => editor.chain().focus().setHorizontalRule().run(), <Minus className="w-3.5 h-3.5" />, 'Divisor')}
      {sep}

      {/* Table */}
      {btn(
        editor.isActive('table'), 
        () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), 
        <TableIcon className="w-3.5 h-3.5" />, 
        'Inserir tabela'
      )}
      {sep}

      {/* Image */}
      {btn(false, () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/gif,image/webp';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) uploadAndInsertImage(file, editor);
        };
        input.click();
      }, <ImageIcon className="w-3.5 h-3.5" />, 'Inserir imagem (máx 2MB)')}
      {sep}

      {/* Colors */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setShowColorPicker(!showColorPicker); setShowHighlightPicker(false); }}
          title="Cor do texto"
          className="h-7 px-1.5 rounded text-xs font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-muted/60 alvo-dedo flex items-center gap-0.5"
        >
          <Palette className="w-3.5 h-3.5" />
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
        {showColorPicker && (
          <ColorPicker
            colors={[
              { value: '', label: 'Padrão' },
              { value: '#ef4444', label: 'Vermelho' },
              { value: '#f97316', label: 'Laranja' },
              { value: '#eab308', label: 'Amarelo' },
              { value: '#22c55e', label: 'Verde' },
              { value: '#3b82f6', label: 'Azul' },
              { value: '#8b5cf6', label: 'Roxo' },
              { value: '#ec4899', label: 'Rosa' },
              { value: '#6b7280', label: 'Cinza' },
            ]}
            onSelect={(color) => {
              if (color) {
                editor.chain().focus().setColor(color).run();
              } else {
                editor.chain().focus().unsetColor().run();
              }
              setShowColorPicker(false);
            }}
          />
        )}
      </div>

      {/* Highlights */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowColorPicker(false); }}
          title="Destaque"
          className="h-7 px-1.5 rounded text-xs font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-muted/60 alvo-dedo flex items-center gap-0.5"
        >
          <Highlighter className="w-3.5 h-3.5" />
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
        {showHighlightPicker && (
          <ColorPicker
            colors={[
              { value: '', label: 'Padrão' },
              { value: '#fbbf24', label: 'Amarelo' },
              { value: '#34d399', label: 'Verde' },
              { value: '#60a5fa', label: 'Azul' },
              { value: '#f472b6', label: 'Rosa' },
              { value: '#a78bfa', label: 'Roxo' },
              { value: '#fb923c', label: 'Laranja' },
            ]}
            onSelect={(color) => {
              if (color) {
                editor.chain().focus().toggleHighlight({ color }).run();
              } else {
                editor.chain().focus().unsetHighlight().run();
              }
              setShowHighlightPicker(false);
            }}
          />
        )}
      </div>
      {sep}

      {/* Insert menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowInsertMenu(!showInsertMenu)}
          title="Inserir bloco"
          className="h-7 px-2 rounded text-xs font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-muted/60 alvo-dedo flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          {!compact && <span className="hidden sm:inline">Inserir</span>}
        </button>
        {showInsertMenu && (
          <InsertMenu editor={editor} onClose={() => setShowInsertMenu(false)} />
        )}
      </div>
    </div>
  );
}

// ─── Color Picker ──────────────────────────────────────────────────────────────

function ColorPicker({ colors, onSelect }: { colors: { value: string; label: string }[]; onSelect: (color: string) => void }) {
  return (
    <div className="absolute top-full left-0 mt-1 z-50 p-2 rounded-lg glass-strong shadow-xl min-w-[160px]">
      <div className="grid grid-cols-5 gap-1">
        {colors.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onSelect(c.value)}
            title={c.label}
            className={cn(
              'w-6 h-6 rounded-md border border-border/50 transition-transform hover:scale-110',
              !c.value && 'bg-background flex items-center justify-center text-xs text-muted-foreground',
            )}
            style={c.value ? { backgroundColor: c.value } : undefined}
          >
            {!c.value && '×'}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Insert Menu ───────────────────────────────────────────────────────────────

function InsertMenu({ editor, onClose }: { editor: any; onClose: () => void }) {
  const items = [
    { label: 'Callout 💡', action: () => { editor.chain().focus().insertContent('<div data-type="callout" data-color="gray" data-icon="💡"><p></p></div>').run(); onClose(); } },
    { label: 'Callout ⚠️', action: () => { editor.chain().focus().insertContent('<div data-type="callout" data-color="yellow" data-icon="⚠️"><p></p></div>').run(); onClose(); } },
    { label: 'Callout 🚫', action: () => { editor.chain().focus().insertContent('<div data-type="callout" data-color="red" data-icon="🚫"><p></p></div>').run(); onClose(); } },
    { label: 'Callout ✅', action: () => { editor.chain().focus().insertContent('<div data-type="callout" data-color="green" data-icon="✅"><p></p></div>').run(); onClose(); } },
    { label: 'Callout 🔥', action: () => { editor.chain().focus().insertContent('<div data-type="callout" data-color="blue" data-icon="🔥"><p></p></div>').run(); onClose(); } },
    { label: 'Callout 📌', action: () => { editor.chain().focus().insertContent('<div data-type="callout" data-color="purple" data-icon="📌"><p></p></div>').run(); onClose(); } },
    { label: '─────────', action: () => {} },
    { label: 'Tabela 3×3', action: () => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); onClose(); } },
    { label: 'Tabela 2×2', action: () => { editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run(); onClose(); } },
    { label: '─────────', action: () => {} },
    { label: 'Imagem 📷', action: () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) uploadAndInsertImage(file, editor);
      };
      input.click();
      onClose();
    }},
    { label: 'Divisor ───', action: () => { editor.chain().focus().setHorizontalRule().run(); onClose(); } },
    { label: '─────────', action: () => {} },
    { label: 'Página 📄 (sub-página)', action: () => { editor.chain().focus().insertPageEmbed().run(); onClose(); } },
  ];

  return (
    <div className="absolute top-full left-0 mt-1 z-50 rounded-lg glass-strong shadow-xl min-w-[180py-1 overflow-hidden">
      {items.map((item, i) => (
        item.label.startsWith('─') ? (
          <div key={i} className="h-px bg-border/40 my-1" />
        ) : (
          <button
            key={i}
            type="button"
            onClick={item.action}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors flex items-center gap-2"
          >
            <span>{item.label}</span>
          </button>
        )
      ))}
    </div>
  );
}

// ─── Table Controls ────────────────────────────────────────────────────────────

function TableControls({ editor }: { editor: any }) {
  if (!editor.isActive('table')) return null;

  return (
    <div className="flex items-center gap-1 mt-2 p-1.5 rounded-lg bg-muted/30 border border-border/30 w-fit">
      <span className="text-xs text-muted-foreground px-1">Tabela:</span>
      <button
        type="button"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        className="h-6 px-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60"
        title="Adicionar coluna"
      >
        <Plus className="w-3 h-3 inline" /> Col
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().addRowAfter().run()}
        className="h-6 px-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60"
        title="Adicionar linha"
      >
        <Plus className="w-3 h-3 inline" /> Row
      </button>
      <div className="w-px h-3 bg-border/60" />
      <button
        type="button"
        onClick={() => editor.chain().focus().deleteColumn().run()}
        className="h-6 px-1.5 rounded text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
        title="Remover coluna"
      >
        <Trash2 className="w-3 h-3 inline" /> Col
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().deleteRow().run()}
        className="h-6 px-1.5 rounded text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
        title="Remover linha"
      >
        <Trash2 className="w-3 h-3 inline" /> Row
      </button>
      <div className="w-px h-3 bg-border/60" />
      <button
        type="button"
        onClick={() => editor.chain().focus().deleteTable().run()}
        className="h-6 px-1.5 rounded text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
        title="Deletar tabela"
      >
        🗑️
      </button>
    </div>
  );
}
