import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Capture } from '@/types';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await storage.delete<Capture>('captures', id);
  if (!deleted) {
    return NextResponse.json({ error: 'Captura não encontrada' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const updated = await storage.update<Capture>('captures', id, body);
  if (!updated) {
    return NextResponse.json({ error: 'Captura não encontrada' }, { status: 404 });
  }
  return NextResponse.json(updated);
}