'use client';

// Notion's signature interaction: typing "/" opens a searchable menu of
// block types to insert, right at the cursor. Built on @tiptap/suggestion
// (the same low-level utility Tiptap's own mention/emoji examples use) so
// filtering, keyboard nav, and positioning all come from one well-tested
// mechanism instead of being hand-rolled.
import { Extension } from '@tiptap/core';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import { createRoot, Root } from 'react-dom/client';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote,
  Minus, CodeSquare, Image as ImageIcon, Table as TableIcon, Type,
  Lightbulb, AlertTriangle, CircleCheck, Flame,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export interface SlashItem {
  title: string;
  subtitle: string;
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
  command: (opts: { editor: any; range: { from: number; to: number } }) => void;
}

function insertCallout(color: string, icon: string) {
  return ({ editor, range }: { editor: any; range: { from: number; to: number } }) => {
    editor.chain().focus().deleteRange(range)
      .insertContent(`<div data-type="callout" data-color="${color}" data-icon="${icon}"><p></p></div>`)
      .run();
  };
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    title: 'Texto', subtitle: 'Parágrafo simples', keywords: ['texto', 'paragrafo', 'text'], icon: Type,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: 'Título 1', subtitle: 'Título grande', keywords: ['titulo', 'heading', 'h1'], icon: Heading1,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
  },
  {
    title: 'Título 2', subtitle: 'Título médio', keywords: ['titulo', 'heading', 'h2'], icon: Heading2,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
  },
  {
    title: 'Título 3', subtitle: 'Título pequeno', keywords: ['titulo', 'heading', 'h3'], icon: Heading3,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
  },
  {
    title: 'Lista com marcadores', subtitle: 'Lista simples com bullets', keywords: ['lista', 'bullet', 'ul'], icon: List,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Lista numerada', subtitle: 'Lista com números', keywords: ['lista', 'numerada', 'ol'], icon: ListOrdered,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'Lista de tarefas', subtitle: 'Checkboxes pra marcar', keywords: ['tarefa', 'todo', 'checkbox'], icon: CheckSquare,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: 'Citação', subtitle: 'Bloco de citação', keywords: ['citacao', 'quote'], icon: Quote,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Código', subtitle: 'Bloco de código', keywords: ['codigo', 'code'], icon: CodeSquare,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Divisor', subtitle: 'Linha divisória', keywords: ['divisor', 'linha', 'divider', 'hr'], icon: Minus,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: 'Tabela', subtitle: 'Tabela 3×3', keywords: ['tabela', 'table'], icon: TableIcon,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: 'Imagem', subtitle: 'Enviar do computador', keywords: ['imagem', 'foto', 'image'], icon: ImageIcon,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent('notion-editor-insert-image'));
    },
  },
  {
    title: 'Callout', subtitle: 'Destaque com ícone 💡', keywords: ['callout', 'destaque', 'dica'], icon: Lightbulb,
    command: insertCallout('gray', '💡'),
  },
  {
    title: 'Callout de aviso', subtitle: 'Destaque amarelo ⚠️', keywords: ['callout', 'aviso', 'warning'], icon: AlertTriangle,
    command: insertCallout('yellow', '⚠️'),
  },
  {
    title: 'Callout de sucesso', subtitle: 'Destaque verde ✅', keywords: ['callout', 'sucesso', 'ok'], icon: CircleCheck,
    command: insertCallout('green', '✅'),
  },
  {
    title: 'Callout de urgência', subtitle: 'Destaque vermelho 🔥', keywords: ['callout', 'urgente', 'fogo'], icon: Flame,
    command: insertCallout('red', '🔥'),
  },
];

// ─── Popup menu ─────────────────────────────────────────────────────────────

interface MenuProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

interface MenuHandle {
  onKeyDown: (opts: { event: KeyboardEvent }) => boolean;
}

const SlashMenu = forwardRef<MenuHandle, MenuProps>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        if (items[selected]) command(items[selected]);
        return true;
      }
      return false;
    },
  }), [items, selected, command]);

  if (items.length === 0) {
    return (
      <div className="rounded-lg glass-strong shadow-xl px-3 py-2 text-sm text-muted-foreground">
        Nenhum resultado
      </div>
    );
  }

  return (
    <div className="rounded-lg glass-strong shadow-xl py-1 w-72 max-h-80 overflow-y-auto">
      {items.map((item, i) => (
        <button
          key={item.title}
          type="button"
          onMouseEnter={() => setSelected(i)}
          onClick={() => command(item)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
            i === selected ? 'bg-primary/15' : 'hover:bg-muted/60'
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/40">
            <item.icon className="h-4 w-4 text-foreground/80" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium truncate">{item.title}</span>
            <span className="block text-xs text-muted-foreground truncate">{item.subtitle}</span>
          </span>
        </button>
      ))}
    </div>
  );
});
SlashMenu.displayName = 'SlashMenu';

// ─── Suggestion wiring ──────────────────────────────────────────────────────

const suggestion: Omit<SuggestionOptions<SlashItem>, 'editor'> = {
  char: '/',
  startOfLine: false,
  allowSpaces: true,
  items: ({ query }) => {
    const q = query.toLowerCase();
    return SLASH_ITEMS.filter((item) =>
      item.title.toLowerCase().includes(q) || item.keywords.some((k) => k.includes(q))
    ).slice(0, 10);
  },
  command: ({ editor, range, props }) => {
    (props as SlashItem).command({ editor, range });
  },
  render: () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;
    let renderer: { onKeyDown: (opts: { event: KeyboardEvent }) => boolean } | null = null;

    function position(clientRect: (() => DOMRect | null) | null | undefined) {
      if (!container || !clientRect) return;
      const rect = clientRect();
      if (!rect) return;
      container.style.left = `${rect.left + window.scrollX}px`;
      container.style.top = `${rect.bottom + window.scrollY + 4}px`;
    }

    return {
      onStart: (props) => {
        container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        root = createRoot(container);

        let handleRef: MenuHandle | null = null;

        root.render(
          <SlashMenu
            ref={(r) => { handleRef = r; }}
            items={props.items}
            command={(item) => props.command(item as any)}
          />
        );
        renderer = { onKeyDown: (opts) => handleRef?.onKeyDown(opts) ?? false };
        position(props.clientRect);
      },
      onUpdate: (props) => {
        if (!root) return;
        let handleRef: MenuHandle | null = null;
        root.render(
          <SlashMenu
            ref={(r) => { handleRef = r; }}
            items={props.items}
            command={(item) => props.command(item as any)}
          />
        );
        renderer = { onKeyDown: (opts) => handleRef?.onKeyDown(opts) ?? false };
        position(props.clientRect);
      },
      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          container?.remove();
          return true;
        }
        return renderer?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        root?.unmount();
        container?.remove();
        root = null;
        container = null;
      },
    };
  },
};

export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addOptions() {
    return { suggestion };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
