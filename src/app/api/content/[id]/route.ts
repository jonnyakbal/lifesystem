import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Content } from '@/types';
import { updateContent } from '@/lib/content-domain';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { expectedUpdatedAt, ...body } = await request.json();
  let updated;
  try { updated = await updateContent(id, body, expectedUpdatedAt); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Conteúdo inválido.' }, { status: 409 }); }
  if (!updated) {
    return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await storage.delete<Content>('content', id);
  if (!deleted) {
    return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
