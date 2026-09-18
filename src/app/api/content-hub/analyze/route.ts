import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ContentItem } from '@/types';
import { analyzeContentItem } from '@/lib/content-hub/ai';

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const id = (body as Record<string, unknown>)?.id as string | undefined;
  if (!id) return NextResponse.json({ error: 'ID do item é obrigatório' }, { status: 400 });

  const item = await storage.getById<ContentItem>('content-items', id);
  if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });

  const insights = await analyzeContentItem(item);
  if (!insights) return NextResponse.json({ error: 'Não foi possível analisar o item' }, { status: 500 });

  await storage.update<ContentItem>('content-items', id, { aiInsights: insights });
  return NextResponse.json(insights);
}