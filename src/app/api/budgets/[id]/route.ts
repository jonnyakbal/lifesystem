import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Budget } from '@/types';
import { budgetSchema } from '@/lib/financial-validation';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = budgetSchema.partial().safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Orçamento inválido.' }, { status: 400 });
  const budget = await storage.update<Budget>('budgets', id, parsed.data);
  if (!budget) return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
  return NextResponse.json(budget);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await storage.delete('budgets', id);
  if (!deleted) return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
