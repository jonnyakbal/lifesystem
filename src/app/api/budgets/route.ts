import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Budget } from '@/types';
import { budgetSchema } from '@/lib/financial-validation';

export async function GET() {
  const budgets = await storage.getAll<Budget>('budgets');
  return NextResponse.json(budgets);
}

export async function POST(request: NextRequest) {
  const parsed = budgetSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Orçamento inválido.', details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  const budget = await storage.create<Budget>('budgets', {
    category: body.category,
    type: body.type,
    monthlyLimit: body.monthlyLimit,
    spent: body.spent || 0,
    month: body.month,
  });
  return NextResponse.json(budget, { status: 201 });
}
