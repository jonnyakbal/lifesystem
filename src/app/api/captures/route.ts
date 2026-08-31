import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Capture } from '@/types';

export async function GET() {
  // Returns every capture regardless of status — filtering to just
  // status:'inbox' here would hide converted/organized captures from
  // callers that need the full list (backlinks on Task/Project, the
  // "Virou tarefa" provenance badge on the capture itself). The Inbox
  // page applies its own default view filter client-side instead.
  const captures = await storage.getAll<Capture>('captures');
  return NextResponse.json(captures);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const capture = await storage.create<Capture>('captures', {
    content: body.content,
    type: body.type || 'text',
    title: body.title,
    description: body.description,
    url: body.url,
    status: body.status || 'inbox',
    coverUrl: body.coverUrl || '',
    coverColor: body.coverColor || '',
    category: body.category || '',
  });
  return NextResponse.json(capture, { status: 201 });
}
