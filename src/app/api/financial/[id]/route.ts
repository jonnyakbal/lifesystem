import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { FinancialEntry } from '@/types';
import { financialEntryUpdateSchema } from '@/lib/financial-validation';
import { deleteInstallmentGroup } from '@/lib/financial-card-purchases';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = financialEntryUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Dados financeiros inválidos.', details: parsed.error.flatten() }, { status: 400 });
  const entry = await storage.update<FinancialEntry>('financial', id, parsed.data);
  if (!entry) return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 });
  return NextResponse.json(entry);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (request.nextUrl.searchParams.get('scope') === 'installments') {
    const removed = await deleteInstallmentGroup(id);
    if (removed === null) return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 });
    return NextResponse.json({ success: true, removed });
  }
  const deleted = await storage.delete('financial', id);
  if (!deleted) return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
