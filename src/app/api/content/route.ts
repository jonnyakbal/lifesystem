import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Content } from '@/types';
import { createContent } from '@/lib/content-domain';

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
  try { return NextResponse.json(await createContent(await request.json()), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Dados de conteúdo inválidos.' }, { status: 400 }); }
}
