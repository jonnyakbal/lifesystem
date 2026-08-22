import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { FinancialEntry } from '@/types';

export async function GET() {
  const entries = await storage.getAll<FinancialEntry>('financial');
  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const entry = await storage.create<FinancialEntry>('financial', {
    type: body.type,
    category: body.category,
    description: body.description,
    amount: body.amount,
    date: body.date,
    recurring: body.recurring !== 'none' && !!body.recurring,
    recurringFrequency: body.recurring === 'none' ? undefined : body.recurring,
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
