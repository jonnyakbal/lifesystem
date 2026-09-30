import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Edital } from '@/types';
import { updateEdital } from '@/lib/edital-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { expectedUpdatedAt, ...body } = await request.json();
  let updated;
  try { updated = await updateEdital(id, body, expectedUpdatedAt); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao alterar edital.' }, { status: 409 }); }
  if (!updated) {
    return NextResponse.json({ error: 'Edital não encontrado' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await storage.delete<Edital>('editais', id);
  if (!deleted) {
    return NextResponse.json({ error: 'Edital não encontrado' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
