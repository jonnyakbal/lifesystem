import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Task } from '@/types';
import { readJson } from '@/lib/validation';
import { updateTaskRecord, taskUpdateSchema } from '@/lib/task-domain';
import { deletePlannedTask } from '@/lib/task-planning';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const task = await storage.getById<Task>('tasks', id);
  if (!task) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }
  return NextResponse.json(task);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let rawBody: unknown;
  try { rawBody = await readJson(request); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'JSON inválido' }, { status: 400 });
  }
  const parsed = taskUpdateSchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'Dados de tarefa inválidos' }, { status: 400 });
  const existing = await storage.getById<Task>('tasks', id);
  if (!existing) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  let updated: Task | null;
  try { updated = await updateTaskRecord(id, parsed.data); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível alterar a data.' }, { status: 409 }); }
  if (!updated) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let deleted: boolean;
  try {
    const body = await request.json().catch(() => ({}));
    deleted = await deletePlannedTask(id, body?.removeGoogleEvent === true);
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível excluir a tarefa.' }, { status: 409 }); }
  if (!deleted) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
