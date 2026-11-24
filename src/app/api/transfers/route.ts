import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CashOperationError, listCashTransfers, transferBetweenAccounts } from '@/lib/financial-cash';

const transferSchema = z.object({
  id: z.string().min(12).max(80),
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.number().finite().positive().max(1_000_000_000),
}).strict();

export async function GET() {
  return NextResponse.json(await listCashTransfers());
}

export async function POST(request: NextRequest) {
  const parsed = transferSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Transferência inválida.' }, { status: 400 });
  try {
    return NextResponse.json(await transferBetweenAccounts(parsed.data));
  } catch (error) {
    if (error instanceof CashOperationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Não foi possível registrar a transferência. Tente novamente.' }, { status: 500 });
  }
}
