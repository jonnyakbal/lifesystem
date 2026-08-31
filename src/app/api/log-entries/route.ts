import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { LogEntry } from '@/types';

export async function GET() {
  const entries = await storage.getAll<LogEntry>('log-entries');
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const entry = await storage.create<LogEntry>('log-entries', {
    title: body.title || 'Sem título',
    body: body.body || '',
    category: body.category || 'geral',
    date: body.date || new Date().toISOString().split('T')[0],
  });
  return NextResponse.json(entry, { status: 201 });
}
