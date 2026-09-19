import { htmlToText } from '@/lib/content-hub/fetch';

const MAX_CHARS = 30_000;
const MIN_ARTICLE_CHARS = 400;
const NOISE = /^(share|compartilhe|subscribe|assine|related|leia (também|mais)|comments?|comentários|leave a reply|advertisement|publicidade|newsletter|sign up|follow us)\b/i;

function largestMatch(html: string, tag: string): string | undefined {
  const matches = [...html.matchAll(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'gi'))].map(m => m[0]);
  return matches.sort((a, b) => b.length - a.length)[0];
}

// Heuristic readability: picks the main container, keeps text blocks of real
// prose and drops link-heavy or boilerplate ones. Returns paragraphs separated
// by blank lines, or '' when the page doesn't look like an article.
export function extractArticle(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe|form|nav|footer|aside|header|button|template)\b[\s\S]*?<\/\1>/gi, ' ');

  const container = largestMatch(cleaned, 'article') ?? largestMatch(cleaned, 'main') ?? cleaned;

  const blocks: string[] = [];
  for (const match of container.matchAll(/<(p|h[2-4]|li|blockquote|pre)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const tag = match[1].toLowerCase();
    const inner = match[2];
    const value = htmlToText(inner);
    if (!value) continue;

    const linkChars = [...inner.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].reduce((sum, m) => sum + htmlToText(m[1]).length, 0);
    if (linkChars / value.length > 0.5 && tag !== 'blockquote') continue;
    if (NOISE.test(value)) continue;

    if (tag.startsWith('h')) {
      if (value.length >= 3 && value.length <= 160) blocks.push(value);
    } else if (tag === 'pre') {
      blocks.push(value.slice(0, 1500));
    } else if (tag === 'li') {
      if (value.length >= 20) blocks.push(value);
    } else if (value.length >= 40) {
      blocks.push(value);
    }
  }

  const deduped = blocks.filter((block, i) => blocks.indexOf(block) === i);
  const article = deduped.join('\n\n').slice(0, MAX_CHARS);
  return article.length >= MIN_ARTICLE_CHARS ? article : '';
}
