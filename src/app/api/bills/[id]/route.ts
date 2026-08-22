import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const updated = await storage.update('bills', id, body);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await storage.delete('bills', id);
  return NextResponse.json({ ok: true });
}
