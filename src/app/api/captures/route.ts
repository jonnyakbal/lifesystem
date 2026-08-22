import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Capture } from '@/types';

export async function GET() {
  const captures = await storage.getAll<Capture>('captures');
  const inbox = captures.filter(c => c.status === 'inbox');
  return NextResponse.json(inbox);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const capture = await storage.create<Capture>('captures', {
    content: body.content,
    type: body.type || 'text',
    title: body.title,
    description: body.description,
    url: body.url,
    status: 'inbox',
    coverUrl: body.coverUrl || '',
    coverColor: body.coverColor || '',
    category: body.category || '',
  });
  return NextResponse.json(capture, { status: 201 });
}
