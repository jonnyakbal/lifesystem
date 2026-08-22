import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Pillar } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const updated = await storage.update<Pillar>('pillars', id, body);
  if (!updated) {
    return NextResponse.json({ error: 'Pilar não encontrado' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await storage.delete<Pillar>('pillars', id);
  if (!deleted) {
    return NextResponse.json({ error: 'Pilar não encontrado' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}