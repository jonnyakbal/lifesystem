import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { accountSchema } from '@/lib/financial-validation';
import type { Account } from '../route';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = accountSchema.partial().safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Conta inválida.' }, { status: 400 });
  const updated = await storage.update<Account>('accounts', id, parsed.data);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await storage.delete('accounts', id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
