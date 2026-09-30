import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { FinancialEntry } from '@/types';
import { financialEntrySchema } from '@/lib/financial-validation';
import { getFinancialDisplayEntries } from '@/lib/financial-categories';

export async function GET() {
  const entries = await getFinancialDisplayEntries();
  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const parsed = financialEntrySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Dados financeiros inválidos.', details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  const entry = await storage.create<FinancialEntry>('financial', {
    projectId: body.projectId,
    type: body.type,
    category: body.category,
    description: body.description,
    amount: body.amount,
    date: body.date,
    recurring: body.recurring || false,
    recurringFrequency: body.recurringFrequency,
    accountId: body.accountId,
    cardId: body.cardId,
    payee: body.payee,
    tags: body.tags || [],
    status: body.status || 'pending',
    dueDate: body.dueDate,
    paidDate: body.paidDate,
  });
  return NextResponse.json(entry, { status: 201 });
}
