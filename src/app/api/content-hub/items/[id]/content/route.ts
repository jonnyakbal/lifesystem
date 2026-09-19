import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ContentItem } from '@/types';
import { assertFetchableUrl } from '@/lib/fetch-page';
import { fetchRemote } from '@/lib/content-hub/fetch';
import { extractArticle } from '@/lib/content-hub/extract';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await storage.getById<ContentItem>('content-items', id);
  if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
  if (item.contentExtracted || item.extractFailed) return NextResponse.json(item);

  let article = '';
  try {
    const { text, contentType } = await fetchRemote(assertFetchableUrl(item.url));
    if (/html|xml/.test(contentType) || !contentType) article = extractArticle(text);
  } catch {
    // Falha de rede não é definitiva: não marca como tentado, para nova chance depois.
    return NextResponse.json(item);
  }

  const updated = await storage.update<ContentItem>(
    'content-items',
    id,
    article
      ? { content: article, contentExtracted: true }
      : { extractFailed: true },
  );
  return NextResponse.json(updated ?? item);
}
