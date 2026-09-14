import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { FinancialGoal } from '@/types';
import { financialGoalSchema } from '@/lib/financial-validation';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = financialGoalSchema.partial().safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Meta financeira inválida.' }, { status: 400 });
  const goal = await storage.update<FinancialGoal>('financial-goals', id, parsed.data);
  if (!goal) return NextResponse.json({ error: 'Meta não encontrada.' }, { status: 404 });
  return NextResponse.json(goal);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await storage.delete('financial-goals', id);
  if (!deleted) return NextResponse.json({ error: 'Meta não encontrada.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
