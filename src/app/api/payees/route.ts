import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { payeeSchema } from '@/lib/financial-validation';

export interface Payee {
  id: string;
  name: string;
  type: 'person' | 'company' | 'government' | 'other';
  document?: string;
  email?: string;
  phone?: string;
  category?: string;
  notes?: string;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export async function GET() {
  const payees = await storage.getAll<Payee>('payees');
  return NextResponse.json(payees);
}

export async function POST(request: NextRequest) {
  const parsed = payeeSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Credor inválido.' }, { status: 400 });
  const body = parsed.data;
  const payee = await storage.create<Payee>('payees', {
    name: body.name,
    type: body.type,
    document: body.document,
    email: body.email,
    phone: body.phone,
    category: body.category,
    notes: body.notes,
    color: body.color || '#64748b',
    icon: body.icon || '👤',
  });
  return NextResponse.json(payee, { status: 201 });
}
