import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { billSchema } from '@/lib/financial-validation';
import type { Bill } from '../route';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = billSchema.partial().safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Fatura inválida.' }, { status: 400 });
  const updated = await storage.update<Bill>('bills', id, parsed.data);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await storage.delete('bills', id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
