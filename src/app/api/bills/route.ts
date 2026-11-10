import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { billSchema } from '@/lib/financial-validation';
import {
  createFinancialBill,
  DuplicateFinancialBillError,
} from '@/lib/financial-bills';

export interface Bill {
  id: string;
  cardId: string;
  month: string; // YYYY-MM
  amount: number;
  paidAmount: number;
  status: 'open' | 'paid' | 'overdue' | 'partial' | 'closed';
  dueDate: string;
  closeDate: string;
  description?: string;
  items: BillItem[];
  createdAt: string;
  updatedAt: string;
}

export interface BillItem {
  id: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
  installments?: { current: number; total: number };
}

export async function GET() {
  const bills = await storage.getAll<Bill>('bills');
  return NextResponse.json(bills);
}

export async function POST(request: NextRequest) {
  const parsed = billSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Fatura inválida.', details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  try {
    const bill = await createFinancialBill({
      cardId: body.cardId,
      month: body.month,
      amount: body.amount || 0,
      paidAmount: body.paidAmount || 0,
      status: body.status || 'open',
      dueDate: body.dueDate,
      closeDate: body.closeDate,
      description: body.description,
      items: body.items || [],
    });
    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateFinancialBillError) {
      return NextResponse.json(
        { error: error.message, existingBillId: error.existingBillId },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Não foi possível criar a fatura.' }, { status: 500 });
  }
}
