'use client';

// Notion's "sub-page" block: an inline card inside a note that links to
// another note. The linked note is a completely normal Capture (status
// 'noted') — there's no parent/child hierarchy in the data model, it's just
// referenced from inside this block, per the simpler of the two approaches
// Jonny picked when asked. Clicking the card navigates to /notas?open=<id>,
// reusing the deep-link handling that page already has.
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';

export interface PageEmbedOptions {
  // Called when the block is inserted with no pageId yet — creates the
  // linked capture and returns its id + title so the node can adopt them.
  onCreatePage?: () => Promise<{ id: string; title: string }>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageEmbed: {
      insertPageEmbed: () => ReturnType;
    };
  }
}

function PageEmbedView({ node, editor, getPos }: any) {
  const router = useRouter();
  const { pageId, title, icon, loading } = node.attrs;

  function open(e: React.MouseEvent) {
    e.preventDefault();
    if (!pageId || loading) return;
    router.push(`/notas?open=${pageId}`);
  }

  return (
    <NodeViewWrapper as="div" className="my-1" contentEditable={false} data-drag-handle>
      <a
        href={pageId ? `/notas?open=${pageId}` : '#'}
        onClick={open}
        className="not-prose flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm font-medium text-foreground no-underline transition-colors hover:bg-muted/60"
      >
        <span className="text-base leading-none">{loading ? '⏳' : icon || '📄'}</span>
        <span className="underline decoration-muted-foreground/40 underline-offset-2">
          {loading ? 'Criando página...' : title || 'Sem título'}
        </span>
      </a>
    </NodeViewWrapper>
  );
}

export const PageEmbed = Node.create<PageEmbedOptions>({
  name: 'pageEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { onCreatePage: undefined };
  },

  addAttributes() {
    return {
      pageId: { default: null, parseHTML: (el) => el.getAttribute('data-page-id') || null },
      title: { default: 'Sem título', parseHTML: (el) => el.getAttribute('data-title') || 'Sem título' },
      icon: { default: '📄', parseHTML: (el) => el.getAttribute('data-icon') || '📄' },
      loading: { default: false, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-page-embed]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { pageId, title, icon } = HTMLAttributes;
    return ['div', mergeAttributes({ 'data-page-embed': '', 'data-page-id': pageId, 'data-title': title, 'data-icon': icon })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageEmbedView);
  },

  addCommands() {
    return {
      insertPageEmbed:
        () =>
        ({ chain, editor }) => {
          const result = chain()
            .insertContent({ type: this.name, attrs: { pageId: null, title: 'Nova página', icon: '📄', loading: true } })
            .run();

          this.options.onCreatePage?.().then((page) => {
            if (!page) return;
            // Find the node we just inserted (still `loading`) and adopt the
            // real id/title once the capture finishes being created.
            editor.state.doc.descendants((node, pos) => {
              if (node.type.name === 'pageEmbed' && node.attrs.loading) {
                editor.chain().command(({ tr }) => {
                  tr.setNodeMarkup(pos, undefined, { pageId: page.id, title: page.title, icon: '📄', loading: false });
                  return true;
                }).run();
                return false;
              }
            });
          }).catch(() => {
            editor.state.doc.descendants((node, pos) => {
              if (node.type.name === 'pageEmbed' && node.attrs.loading) {
                editor.chain().command(({ tr }) => { tr.deleteRange(pos, pos + node.nodeSize); return true; }).run();
                return false;
              }
            });
          });

          return result;
        },
    };
  },
});
