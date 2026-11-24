import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { billSchema } from '@/lib/financial-validation';
import {
  DuplicateFinancialBillError,
  deleteFinancialBill,
  registerBillPayment,
  updateFinancialBill,
} from '@/lib/financial-bills';
import { CashOperationError } from '@/lib/financial-cash';
import { settleInvoiceEntries } from '@/lib/financial-card-purchases';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = billSchema.partial().safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Fatura inválida.' }, { status: 400 });
  try {
    const updated = await updateFinancialBill(id, parsed.data);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (parsed.data.status === 'paid') {
      await settleInvoiceEntries(updated.cardId, updated.month, new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()));
    }
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof CashOperationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof DuplicateFinancialBillError) {
      return NextResponse.json(
        { error: error.message, existingBillId: error.existingBillId },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Não foi possível atualizar a fatura.' }, { status: 500 });
  }
}

const paymentSchema = z.object({ accountId: z.string().min(1) }).strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = paymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Selecione a conta pagadora.' }, { status: 400 });
  try {
    return NextResponse.json(await registerBillPayment(id, parsed.data.accountId));
  } catch (error) {
    if (error instanceof CashOperationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Não foi possível concluir a quitação. Você pode tentar novamente com a mesma conta.' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const deleted = await deleteFinancialBill(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CashOperationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Não foi possível excluir a fatura.' }, { status: 500 });
  }
}
