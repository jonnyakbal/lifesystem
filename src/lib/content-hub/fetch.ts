import { fetchPageText, assertFetchableUrl } from '@/lib/fetch-page';
import { ContentSource, ContentItem } from '@/types';
import { todayStr } from '@/lib/utils';

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

export async function fetchSource(source: ContentSource, maxItems = 10): Promise<{
  items: RawContentItem[];
  title?: string;
  description?: string;
  error?: string;
}> {
  try {
    assertFetchableUrl(source.url);
  } catch (err) {
    return { items: [], error: err instanceof Error ? err.message : 'URL inválida' };
  }

  try {
    const res = await fetch(source.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
      headers: { 'User-Agent': 'LifeSystem/1.0 (+https://lifesystem.app)' },
    });
    if (!res.ok) return { items: [], error: `A fonte respondeu ${res.status}.` };

    const tipo = (res.headers.get('content-type') || '').toLowerCase();
    const buffer = Buffer.from(await res.arrayBuffer());
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

    if (isXml(tipo) || isRss(tipo) || isAtom(tipo) || source.type === 'rss') {
      return { items: parseXmlItems(text, source), title: source.name };
    }
    return { items: parseHtmlPage(text, source), title: source.name };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { items: [], error: 'Tempo esgotado ao buscar a fonte.' };
    }
    return { items: [], error: err instanceof Error ? err.message : 'Falha ao buscar a fonte.' };
  }
}

function isXml(tipo: string) { return /xml|atom|rss|rdf/i.test(tipo); }
function isRss(tipo: string) { return tipo.includes('rss') || tipo.includes('rdf'); }
function isAtom(tipo: string) { return tipo.includes('atom'); }

function parseXmlItems(xml: string, source: ContentSource): RawContentItem[] {
  const items: RawContentItem[] = [];
  const isAtomDoc = xml.includes('<feed');

  if (isAtomDoc) return parseAtom(xml, source);
  return parseRss(xml, source);
}

function parseRss(xml: string, source: ContentSource): RawContentItem[] {
  const channelMatch = xml.match(/<channel>[\s\S]*?<\/channel>/i);
  if (!channelMatch) return [];
  const channel = channelMatch[0];

  const title = firstTag(channel, 'title') ?? source.name;
  const desc = firstTag(channel, 'description');
  const itemMatches = [...channel.matchAll(/<item[\s\S]*?<\/item>/gi)];

  return itemMatches.slice(0, 200).map(match => {
    const block = match[0];
    const pubDate = firstTag(block, 'pubDate') ?? firstTag(block, 'dc:date') ?? firstTag(block, 'atom:published');
    const publishedAt = parseDate(pubDate) ?? undefined;
    const content = firstTag(block, 'content:encoded') ?? firstTag(block, 'description') ?? '';
    const excerpt = firstTag(block, 'description') ?? undefined;
    const author = firstTag(block, 'dc:creator') ?? firstTag(block, 'author') ?? undefined;
    const tags = [...block.matchAll(/<category.*?>(.*?)<\/category>/gi)].map(m => m[1]);
    const link = firstTag(block, 'link') ?? firstTag(block, 'guid') ?? '';
    const imageMatch = content.match(/<img[^>]+src="([^"]+)"/i);

    return {
      title: cleanHtml(firstTag(block, 'title') ?? 'Sem título'),
      url: link,
      author: author ? cleanHtml(author) : undefined,
      content: cleanHtml(content).slice(0, 8000),
      excerpt: excerpt ? cleanHtml(excerpt).slice(0, 1000) : undefined,
      imageUrl: imageMatch?.[1],
      publishedAt,
      tags: tags.length ? tags.map(cleanHtml) : undefined,
      category: firstTag(block, 'category'),
    };
  });
}

function parseAtom(xml: string, source: ContentSource): RawContentItem[] {
  const feedMatch = xml.match(/<feed[\s\S]*?<\/feed>/i);
  if (!feedMatch) return [];
  const feed = feedMatch[0];
  const title = firstTag(feed, 'title') ?? source.name;
  const desc = firstTag(feed, 'subtitle');

  const itemMatches = [...feed.matchAll(/<entry[\s\S]*?<\/entry>/gi)];
  return itemMatches.slice(0, 200).map(match => {
    const block = match[0];
    const pubDate = firstTag(block, 'published') ?? firstTag(block, 'updated');
    const publishedAt = parseDate(pubDate) ?? undefined;
    const content = firstTag(block, 'content') ?? firstTag(block, 'summary') ?? '';
    const linkMatch = block.match(/<link[^>]+href="([^"]+)"/i);
    const authorMatch = block.match(/<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/i);
    const tags = [...block.matchAll(/<category.*?term="([^"]+)"/gi)].map(m => m[1]);
    const imageMatch = content.match(/<img[^>]+src="([^"]+)"/i);

    return {
      title: cleanHtml(firstTag(block, 'title') ?? 'Sem título'),
      url: linkMatch?.[1] ?? '',
      author: authorMatch?.[1] ? cleanHtml(authorMatch[1]) : undefined,
      content: cleanHtml(content).slice(0, 8000),
      excerpt: content ? cleanHtml(content).slice(0, 1000) : undefined,
      imageUrl: imageMatch?.[1],
      publishedAt,
      tags: tags.length ? tags : undefined,
    };
  });
}

function parseHtmlPage(html: string, source: ContentSource): RawContentItem[] {
  const title = html.match(/<title>(.*?)<\/title>/i)?.[1];
  const cleaned = cleanHtml(html).replace(/\s+/g, ' ').trim();
  if (!title) return [];
  return [{
    title: cleanHtml(title),
    url: source.url,
    content: cleaned.slice(0, 8000),
    excerpt: cleaned.slice(0, 1000),
    publishedAt: undefined,
  }];
}

function firstTag(xml: string, tag: string): string | undefined {
  const open = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'i');
  const close = new RegExp(`</${tag}>`, 'i');
  const openMatch = xml.match(open);
  if (!openMatch || openMatch.index === undefined) return undefined;
  const start = openMatch.index + openMatch[0].length;
  const closeMatch = xml.slice(start).match(close);
  if (!closeMatch || closeMatch.index === undefined) return undefined;
  return xml.slice(start, start + closeMatch.index);
}

function cleanHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (isNaN(date.getTime())) return undefined;
  return date.toISOString();
}