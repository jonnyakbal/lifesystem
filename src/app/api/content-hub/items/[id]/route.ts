import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { storage } from '@/lib/storage';
import { ContentItem } from '@/types';
import { readJson, contentItemPayloadSchema } from '@/lib/validation';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await storage.getById<ContentItem>('content-items', id);
  if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await storage.getById<ContentItem>('content-items', id);
  if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });

  let body: unknown;
  try { body = await readJson(request); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'JSON inválido' }, { status: 400 });
  }

  const parsed = contentItemPayloadSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Dados de atualização inválidos', issues: parsed.error.flatten() }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.url !== undefined) update.url = parsed.data.url;
  if (parsed.data.author !== undefined) update.author = parsed.data.author;
  if (parsed.data.content !== undefined) update.content = parsed.data.content;
  if (parsed.data.excerpt !== undefined) update.excerpt = parsed.data.excerpt;
  if (parsed.data.imageUrl !== undefined) update.imageUrl = parsed.data.imageUrl;
  if (parsed.data.publishedAt !== undefined) update.publishedAt = parsed.data.publishedAt;
  if (parsed.data.tags !== undefined) update.tags = parsed.data.tags;
  if (parsed.data.category !== undefined) update.category = parsed.data.category;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.importance !== undefined) update.importance = parsed.data.importance;

  const updated = await storage.update<ContentItem>('content-items', id, update as Partial<ContentItem>);
  if (!updated) return NextResponse.json({ error: 'Falha ao atualizar' }, { status: 500 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = await storage.delete<ContentItem>('content-items', id);
  if (!ok) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
  return NextResponse.json({ success: true });
}