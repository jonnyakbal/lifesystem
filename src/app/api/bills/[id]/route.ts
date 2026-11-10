import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { billSchema } from '@/lib/financial-validation';
import {
  DuplicateFinancialBillError,
  updateFinancialBill,
} from '@/lib/financial-bills';
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
    if (error instanceof DuplicateFinancialBillError) {
      return NextResponse.json(
        { error: error.message, existingBillId: error.existingBillId },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Não foi possível atualizar a fatura.' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await storage.delete('bills', id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
