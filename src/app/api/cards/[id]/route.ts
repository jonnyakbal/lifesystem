import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { cardSchema } from '@/lib/financial-validation';
import type { Card } from '../route';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = cardSchema.partial().safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Cartão inválido.' }, { status: 400 });
  const updated = await storage.update<Card>('cards', id, parsed.data);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await storage.delete('cards', id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
