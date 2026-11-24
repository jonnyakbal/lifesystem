import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { cardSchema } from '@/lib/financial-validation';
import type { Card } from '../route';

const cardUpdateSchema = cardSchema.partial().extend({
  limit: cardSchema.shape.limit.nullable(),
  closingDay: cardSchema.shape.closingDay.nullable(),
  dueDay: cardSchema.shape.dueDay.nullable(),
  accountId: cardSchema.shape.accountId.nullable(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = cardUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Cartão inválido.' }, { status: 400 });
  const { limit, closingDay, dueDay, accountId, ...fields } = parsed.data;
  const updated = await storage.update<Card>('cards', id, {
    ...fields,
    ...(limit !== undefined && { limit: limit ?? undefined }),
    ...(closingDay !== undefined && { closingDay: closingDay ?? undefined }),
    ...(dueDay !== undefined && { dueDay: dueDay ?? undefined }),
    ...(accountId !== undefined && { accountId: accountId ?? undefined }),
  });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await storage.delete('cards', id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
