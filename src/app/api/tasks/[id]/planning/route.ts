import { NextRequest, NextResponse } from 'next/server';
import { adoptTaskGoogleEvent, planningSchema, removeTaskPlanning, saveTaskPlanning } from '@/lib/task-planning';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parsed = planningSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Planejamento inválido.' }, { status: 400 });
  try { return NextResponse.json(await saveTaskPlanning((await params).id, parsed.data)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível salvar o planejamento.' }, { status: 409 }); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => ({}));
  try { return NextResponse.json(await removeTaskPlanning((await params).id, body?.removeGoogleEvent === true)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível remover o planejamento.' }, { status: 409 }); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  if (body?.action !== 'adopt-google') return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  try { return NextResponse.json(await adoptTaskGoogleEvent((await params).id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar o bloco.' }, { status: 409 }); }
}
