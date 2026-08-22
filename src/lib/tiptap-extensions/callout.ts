import { Node, mergeAttributes } from '@tiptap/core';

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>;
  defaultColor: string;
  defaultIcon: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: { color?: string; icon?: string }) => ReturnType;
      toggleCallout: (attributes?: { color?: string; icon?: string }) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      defaultColor: 'gray',
      defaultIcon: '💡',
    };
  },

  addAttributes() {
    return {
      color: {
        default: this.options.defaultColor,
        parseHTML: (element) => element.getAttribute('data-color') || this.options.defaultColor,
        renderHTML: (attributes) => ({ 'data-color': attributes.color }),
      },
      icon: {
        default: this.options.defaultIcon,
        parseHTML: (element) => element.getAttribute('data-icon') || this.options.defaultIcon,
        renderHTML: (attributes) => ({ 'data-icon': attributes.icon }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const { color, icon } = node.attrs as { color: string; icon: string };
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'callout',
        class: `callout callout-${color}`,
      }),
      ['span', { class: 'callout-icon' }, icon],
      ['div', { class: 'callout-content' }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attributes);
        },
      toggleCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attributes);
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => this.editor.commands.toggleCallout(),
    };
  },
});
