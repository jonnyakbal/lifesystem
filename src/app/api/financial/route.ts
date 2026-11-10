import { NextRequest, NextResponse } from 'next/server';
import { createFinancialEntries } from '@/lib/financial-card-purchases';
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
  const created = await createFinancialEntries({
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
    installments: body.installments,
    billMonth: body.billMonth,
  });
  // Compatível: devolve o primeiro lançamento; parcelas extras vêm em `installments`.
  return NextResponse.json({ ...created[0], ...(created.length > 1 ? { installments: created } : {}) }, { status: 201 });
}
