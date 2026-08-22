// Table of Contents - rendered as a React component, not a tiptap node
// This file provides the TOC extraction logic

export interface TocItem {
  level: number;
  text: string;
  id: string;
}

export function extractToc(html: string): TocItem[] {
  const items: TocItem[] = [];
  const regex = /<h([1-3])[^>]*>(.*?)<\/h[1-3]>/gi;
  let match;
  let index = 0;

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    if (text) {
      items.push({
        level,
        text,
        id: `heading-${index++}`,
      });
    }
  }

  return items;
}
