import { assertFetchableUrl } from '@/lib/fetch-page';
import { ContentSource } from '@/types';

export interface RawContentItem {
  title: string;
  url: string;
  author?: string;
  content?: string;
  excerpt?: string;
  imageUrl?: string;
  publishedAt?: string;
  tags?: string[];
  category?: string;
}

export interface FetchSourceResult {
  items: RawContentItem[];
  title?: string;
  feedUrl?: string;
  error?: string;
}

const MAX_BYTES = 5_000_000;
const MAX_CONTENT_CHARS = 20_000;
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function fetchRemote(url: URL): Promise<{ text: string; contentType: string; finalUrl: string }> {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5',
    },
  });
  if (!res.ok) throw new Error(`A fonte respondeu ${res.status}.`);
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_BYTES) throw new Error('Esse feed é grande demais pra ler.');
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) throw new Error('Esse feed é grande demais pra ler.');
  return {
    text: new TextDecoder('utf-8', { fatal: false }).decode(buffer),
    contentType: (res.headers.get('content-type') || '').toLowerCase(),
    finalUrl: res.url || url.toString(),
  };
}

function looksLikeFeed(text: string, contentType: string): boolean {
  if (/xml|rss|atom|rdf/.test(contentType) && !/html/.test(contentType)) return true;
  const head = text.slice(0, 1500).toLowerCase();
  return /<rss[\s>]|<feed[\s>]|<rdf:rdf[\s>]/.test(head);
}

function discoverFeedUrl(html: string, baseUrl: string): string | undefined {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => m[0]);
  for (const tag of links) {
    if (!/rel\s*=\s*["']?alternate/i.test(tag)) continue;
    if (!/type\s*=\s*["']?application\/(rss|atom)\+xml/i.test(tag)) continue;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      return new URL(decodeEntities(href), baseUrl).toString();
    } catch {
      continue;
    }
  }
  return undefined;
}

export async function fetchSource(source: ContentSource, maxItems = 20): Promise<FetchSourceResult> {
  try {
    let url = assertFetchableUrl(source.url);
    let body = await fetchRemote(url);

    if (!looksLikeFeed(body.text, body.contentType)) {
      const discovered = discoverFeedUrl(body.text, body.finalUrl);
      if (!discovered) {
        return { items: [], error: 'Não achei um feed RSS/Atom nesse endereço. Cole a URL do feed diretamente.' };
      }
      url = assertFetchableUrl(discovered);
      body = await fetchRemote(url);
      if (!looksLikeFeed(body.text, body.contentType)) {
        return { items: [], error: 'O feed encontrado não pôde ser lido.' };
      }
    }

    const parsed = parseFeed(body.text);
    return {
      items: parsed.items.slice(0, maxItems),
      title: parsed.title,
      feedUrl: url.toString(),
    };
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      return { items: [], error: 'Tempo esgotado ao buscar a fonte.' };
    }
    return { items: [], error: err instanceof Error ? err.message : 'Falha ao buscar a fonte.' };
  }
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

export function parseFeed(xml: string): { title?: string; items: RawContentItem[] } {
  const isAtom = xml.includes('<feed') && !/<rss[\s>]/i.test(xml.slice(0, 1500));
  return isAtom ? parseAtom(xml) : parseRss(xml);
}

function parseRss(xml: string): { title?: string; items: RawContentItem[] } {
  const channel = xml.match(/<channel[\s\S]*?<\/channel>/i)?.[0] ?? xml;
  const title = text(firstTag(channel.replace(/<item[\s\S]*<\/item>/i, ''), 'title'));
  const blocks = [...channel.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map(m => m[0]);

  const items = blocks.map(block => {
    const encoded = raw(firstTag(block, 'content:encoded'));
    const description = raw(firstTag(block, 'description'));
    const html = encoded || description;
    const body = htmlToText(html);
    const desc = htmlToText(description);
    const link = text(firstTag(block, 'link')) || text(firstTag(block, 'guid'));
    const categories = allTags(block, 'category').map(text).filter(Boolean);
    const author = text(firstTag(block, 'dc:creator')) || text(firstTag(block, 'author'));

    return buildItem({
      title: text(firstTag(block, 'title')),
      url: link,
      author,
      body,
      excerptSource: desc && desc !== body ? desc : body,
      imageUrl: findImage(block, html),
      publishedAt: parseDate(text(firstTag(block, 'pubDate')) || text(firstTag(block, 'dc:date'))),
      tags: categories,
    });
  });
  return { title, items: items.filter((i): i is RawContentItem => i !== null) };
}

function parseAtom(xml: string): { title?: string; items: RawContentItem[] } {
  const feed = xml.match(/<feed[\s\S]*<\/feed>/i)?.[0] ?? xml;
  const title = text(firstTag(feed.replace(/<entry[\s\S]*<\/entry>/i, ''), 'title'));
  const blocks = [...feed.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].map(m => m[0]);

  const items = blocks.map(block => {
    const html = raw(firstTag(block, 'content')) || raw(firstTag(block, 'summary'));
    const body = htmlToText(html);
    const summary = htmlToText(raw(firstTag(block, 'summary')));
    const links = [...block.matchAll(/<link\b[^>]*>/gi)].map(m => m[0]);
    const alternate = links.find(l => !/rel\s*=/i.test(l) || /rel\s*=\s*["']alternate["']/i.test(l)) ?? links[0];
    const href = alternate?.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    const author = text(firstTag(firstTag(block, 'author') ?? '', 'name'));
    const categories = [...block.matchAll(/<category\b[^>]*\bterm\s*=\s*["']([^"']+)["']/gi)].map(m => decodeEntities(m[1]).trim()).filter(Boolean);

    return buildItem({
      title: text(firstTag(block, 'title')),
      url: href ? decodeEntities(href) : '',
      author,
      body,
      excerptSource: summary && summary !== body ? summary : body,
      imageUrl: findImage(block, html),
      publishedAt: parseDate(text(firstTag(block, 'published')) || text(firstTag(block, 'updated'))),
      tags: categories,
    });
  });
  return { title, items: items.filter((i): i is RawContentItem => i !== null) };
}

function buildItem(input: {
  title: string;
  url: string;
  author: string;
  body: string;
  excerptSource: string;
  imageUrl?: string;
  publishedAt?: string;
  tags: string[];
}): RawContentItem | null {
  if (!input.url) return null;
  try {
    const parsed = new URL(input.url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  } catch {
    return null;
  }
  const body = stripBoilerplate(input.body).slice(0, MAX_CONTENT_CHARS);
  return {
    title: input.title || 'Sem título',
    url: input.url,
    author: input.author || undefined,
    content: body || input.title,
    excerpt: makeExcerpt(stripBoilerplate(input.excerptSource)),
    imageUrl: input.imageUrl,
    publishedAt: input.publishedAt,
    tags: [...new Set(input.tags)].slice(0, 10),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstTag(xml: string | undefined, tag: string): string | undefined {
  if (!xml) return undefined;
  const name = tag.replace(/[:.]/g, '\\$&');
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return match?.[1];
}

function allTags(xml: string, tag: string): string[] {
  const name = tag.replace(/[:.]/g, '\\$&');
  return [...xml.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'gi'))].map(m => m[1]);
}

// Unwraps CDATA and returns the tag's payload as-is (HTML stays HTML).
function raw(value: string | undefined): string {
  if (!value) return '';
  const cdata = [...value.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)];
  if (cdata.length > 0) return cdata.map(m => m[1]).join('');
  return decodeEntities(value);
}

// Plain single-line text (titles, names, dates). Only known inline formatting
// tags are dropped: titles legitimately contain things like "<geolocation>".
function text(value: string | undefined): string {
  const unwrapped = raw(value).replace(/<\/?(?:b|i|em|strong|span|a|code|br|p)[^>]*>/gi, '');
  return decodeEntities(unwrapped).replace(/\s+/g, ' ').trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»', bull: '•', middot: '·', copy: '©', reg: '®', trade: '™',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return ' ';
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

// HTML → plain text with paragraphs separated by a blank line. The result is
// rendered as React text nodes, never as HTML, so nothing here needs to be
// re-escaped.
export function htmlToText(html: string): string {
  if (!html) return '';
  const withBreaks = html
    .replace(/<(script|style|iframe|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote|pre|figure|tr|section|article)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(withBreaks)
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripBoilerplate(value: string): string {
  return value
    .replace(/\s*The post .{1,300}? appeared first on .{1,200}?\.?\s*$/i, '')
    .replace(/\s*(?:This|The) (?:article|post|entry) .{0,120}?originally (?:handwritten and )?published (?:with love )?(?:on|at) .{1,120}$/i, '')
    .trim();
}

function makeExcerpt(value: string): string | undefined {
  const flat = value.replace(/\s+/g, ' ').trim();
  if (!flat) return undefined;
  if (flat.length <= 280) return flat;
  const cut = flat.slice(0, 280);
  const lastSentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  if (lastSentence > 140) return cut.slice(0, lastSentence + 1);
  return cut.slice(0, cut.lastIndexOf(' ')).trimEnd() + '…';
}

function findImage(block: string, html: string): string | undefined {
  const candidates = [
    block.match(/<media:(?:content|thumbnail)\b[^>]*\burl\s*=\s*["']([^"']+)["']/i)?.[1],
    block.match(/<enclosure\b[^>]*\btype\s*=\s*["']image\/[^"']+["'][^>]*\burl\s*=\s*["']([^"']+)["']/i)?.[1],
    block.match(/<enclosure\b[^>]*\burl\s*=\s*["']([^"']+)["'][^>]*\btype\s*=\s*["']image\//i)?.[1],
    html.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1],
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const url = decodeEntities(candidate).trim();
    if (/^https?:\/\//i.test(url)) return url;
  }
  return undefined;
}

function parseDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
