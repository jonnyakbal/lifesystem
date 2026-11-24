import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { accountSchema } from '@/lib/financial-validation';
import { balanceCheck } from '@/lib/financial-cash';
import type { Account } from '../route';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = accountSchema.partial().safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Conta inválida.' }, { status: 400 });
  const updated = await storage.update<Account>('accounts', id, {
    ...parsed.data, ...balanceCheck(parsed.data.balance),
  });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const deleted = await storage.delete('accounts', id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'CashHistoryError') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Não foi possível excluir a conta.' }, { status: 500 });
  }
}
