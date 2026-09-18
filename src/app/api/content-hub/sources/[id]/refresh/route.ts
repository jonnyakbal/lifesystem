import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ContentSource, ContentItem } from '@/types';
import { readJson } from '@/lib/validation';
import { fetchSource } from '@/lib/content-hub/fetch';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const source = await storage.getById<ContentSource>('content-sources', id);
  if (!source) return NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 });

  let body: unknown;
  try { body = await readJson(request); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'JSON inválido' }, { status: 400 });
  }

  const maxItems = Math.min(Math.max(Number((body as Record<string, unknown>)?.maxItems ?? 10), 1), 50);
  const { items, error } = await fetchSource(source, maxItems);

  if (error) {
    await storage.update<ContentSource>('content-sources', source.id, { fetchStatus: 'error', error });
    return NextResponse.json({ error }, { status: 500 });
  }

  const now = new Date().toISOString();
  const existing = await storage.getAll<{ id: string; url: string }>('content-items');
  const existingUrls = new Set(existing.map(i => i.url));
  const created: ContentItem[] = [];

  for (const item of items) {
    if (existingUrls.has(item.url)) continue;
    const createdItem = await storage.create<ContentItem>('content-items', {
      sourceId: source.id,
      title: item.title,
      url: item.url,
      author: item.author,
      content: item.content ?? '',
      excerpt: item.excerpt,
      imageUrl: item.imageUrl,
      publishedAt: item.publishedAt,
      fetchedAt: now,
      tags: item.tags ?? [],
      category: item.category,
      status: 'unread',
      importance: 'normal',
    });
    created.push(createdItem);
  }

  await storage.update<ContentSource>('content-sources', source.id, {
    fetchStatus: 'success',
    error: undefined,
    lastFetchedAt: now,
    nextFetchAt: new Date(Date.now() + (source.crawlInterval ? parseInterval(source.crawlInterval) : 3600_000)).toISOString(),
    itemCount: items.length,
  });

  return NextResponse.json({ fetched: created.length, items: created });
}

function parseInterval(value: string): number {
  const match = /^(\d+)(m|h|d)$/.exec(value.trim().toLowerCase());
  if (!match) return 3600_000;
  const amount = Number(match[1]);
  switch (match[2]) {
    case 'm': return amount * 60_000;
    case 'h': return amount * 3_600_000;
    case 'd': return amount * 86_400_000;
    default: return 3600_000;
  }
}