import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { accountSchema } from '@/lib/financial-validation';

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'digital' | 'cash' | 'investment' | 'pj';
  bank?: string;
  agency?: string;
  accountNumber?: string;
  balance: number;
  color: string;
  icon: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function GET() {
  const accounts = await storage.getAll<Account>('accounts');
  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  const parsed = accountSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Conta inválida.', details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  const account = await storage.create<Account>('accounts', {
    name: body.name,
    type: body.type,
    bank: body.bank,
    agency: body.agency,
    accountNumber: body.accountNumber,
    balance: body.balance || 0,
    color: body.color || '#64748b',
    icon: body.icon || '🏦',
    isActive: body.isActive !== false,
    isDefault: body.isDefault || false,
  });
  return NextResponse.json(account, { status: 201 });
}
