import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { storage } from '@/lib/storage';
import { ContentItem } from '@/types';
import { readJson, contentItemPayloadSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get('sourceId');
  const status = searchParams.get('status');
  const importance = searchParams.get('importance');
  const search = searchParams.get('search');

  let items = await storage.getAll<ContentItem>('content-items');

  if (sourceId) items = items.filter(i => i.sourceId === sourceId);
  if (status) items = items.filter(i => i.status === status);
  if (importance) items = items.filter(i => i.importance === importance);
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.excerpt?.toLowerCase().includes(q) ||
      i.content.toLowerCase().includes(q)
    );
  }

  items.sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await readJson(request); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'JSON inválido' }, { status: 400 });
  }

  const parsed = contentItemPayloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Dados do item inválidos', issues: parsed.error.flatten() }, { status: 400 });

  const item = await storage.create<ContentItem>('content-items', {
    sourceId: parsed.data.sourceId,
    title: parsed.data.title,
    url: parsed.data.url,
    author: parsed.data.author,
    content: parsed.data.content,
    excerpt: parsed.data.excerpt,
    imageUrl: parsed.data.imageUrl,
    publishedAt: parsed.data.publishedAt,
    fetchedAt: new Date().toISOString(),
    tags: parsed.data.tags || [],
    category: parsed.data.category,
    status: parsed.data.status,
    importance: parsed.data.importance,
  });
  return NextResponse.json(item, { status: 201 });
}