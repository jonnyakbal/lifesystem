import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Capture, ContentItem } from '@/types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await storage.getById<ContentItem>('content-items', id);
  if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });

  const capture = await storage.create<Capture>('captures', {
    content: `<p>${escapeHtml(item.title)}</p><p>${escapeHtml((item.excerpt || item.content || '').slice(0, 500))}</p>`,
    type: 'link',
    title: item.title,
    description: item.excerpt ?? undefined,
    url: item.url,
    status: 'inbox',
    coverUrl: item.imageUrl || '',
    coverColor: '',
    category: item.category || '',
  });

  await storage.update<ContentItem>('content-items', id, { linkedCaptureId: capture.id });

  return NextResponse.json({ captureId: capture.id, status: 'captured' });
}