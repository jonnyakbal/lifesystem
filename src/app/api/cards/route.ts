import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { cardSchema } from '@/lib/financial-validation';

export interface Card {
  id: string;
  name: string;
  type: 'credit' | 'debit' | 'multiple';
  lastDigits: string;
  brand: string;
  limit?: number;
  used?: number;
  closingDay?: number;
  dueDay?: number;
  color: string;
  accountId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function GET() {
  const cards = await storage.getAll<Card>('cards');
  return NextResponse.json(cards);
}

export async function POST(request: NextRequest) {
  const parsed = cardSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Cartão inválido.' }, { status: 400 });
  const body = parsed.data;
  const card = await storage.create<Card>('cards', {
    name: body.name,
    type: body.type,
    lastDigits: body.lastDigits,
    brand: body.brand,
    limit: body.limit,
    used: body.used || 0,
    closingDay: body.closingDay,
    dueDay: body.dueDay,
    color: body.color || '#64748b',
    accountId: body.accountId,
    isActive: body.isActive !== false,
  });
  return NextResponse.json(card, { status: 201 });
}
