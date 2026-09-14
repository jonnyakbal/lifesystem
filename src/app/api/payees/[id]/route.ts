import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { payeeSchema } from '@/lib/financial-validation';
import type { Payee } from '../route';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = payeeSchema.partial().safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Credor inválido.' }, { status: 400 });
  const updated = await storage.update<Payee>('payees', id, parsed.data);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await storage.delete('payees', id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
