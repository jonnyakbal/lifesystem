import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { storage } from '@/lib/storage';
import { ContentSource, ContentItem } from '@/types';
import { readJson, contentSourceUpdateSchema } from '@/lib/validation';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const source = await storage.getById<ContentSource>('content-sources', id);
  if (!source) return NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 });
  return NextResponse.json(source);
}

export async function PATCH(
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

  const parsed = contentSourceUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Dados de atualização inválidos', issues: parsed.error.flatten() }, { status: 400 });

  const updated = await storage.update<ContentSource>('content-sources', id, {
    name: parsed.data.name ?? source.name,
    type: parsed.data.type ?? source.type,
    url: parsed.data.url ?? source.url,
    description: parsed.data.description ?? source.description,
    icon: parsed.data.icon ?? source.icon,
    color: parsed.data.color ?? source.color,
    tags: parsed.data.tags ?? source.tags,
    isActive: parsed.data.isActive ?? source.isActive,
  });
  if (!updated) return NextResponse.json({ error: 'Falha ao atualizar' }, { status: 500 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = await storage.delete<ContentSource>('content-sources', id);
  if (!ok) return NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 });

  await storage.deleteWhere<ContentItem>('content-items', i => i.sourceId === id);
  return NextResponse.json({ success: true });
}