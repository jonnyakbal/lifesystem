import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { LogEntry } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const updated = await storage.update<LogEntry>('log-entries', id, body);
  if (!updated) {
    return NextResponse.json({ error: 'Entrada não encontrada' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await storage.delete<LogEntry>('log-entries', id);
  if (!deleted) {
    return NextResponse.json({ error: 'Entrada não encontrada' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
