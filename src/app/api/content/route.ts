import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Content } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  
  let items = await storage.getAll<Content>('content');
  
  if (status) items = items.filter(i => i.status === status);
  if (category) items = items.filter(i => i.category === category);
  
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(i => 
      i.title.toLowerCase().includes(q) ||
      i.body.toLowerCase().includes(q) ||
      i.tags.some(tag => tag.toLowerCase().includes(q))
    );
  }
  
  items.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const item = await storage.create<Content>('content', {
    title: body.title || 'Sem título',
    body: body.body || '',
    channel: body.channel || 'blog',
    stage: body.stage || 'idea',
    category: body.category || 'Geral',
    format: body.format || '',
    tags: body.tags || [],
    status: body.status || 'draft',
    pinned: body.pinned || false,
    scheduledDate: body.scheduledDate,
    scheduledTime: body.scheduledTime,
    publishedUrl: body.publishedUrl,
    responsible: body.responsible,
    editorialLine: body.editorialLine,
    checklist: body.checklist || [],
    metrics: body.metrics,
    linkedTaskIds: body.linkedTaskIds || [],
    linkedProjectIds: body.linkedProjectIds || [],
  });
  return NextResponse.json(item, { status: 201 });
}
