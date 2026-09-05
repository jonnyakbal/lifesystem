import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Task } from '@/types';
import { readJson, taskPayloadSchema } from '@/lib/validation';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let rawBody: unknown;
  try { rawBody = await readJson(request); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'JSON inválido' }, { status: 400 });
  }
  const parsed = taskPayloadSchema.partial().safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'Dados de tarefa inválidos' }, { status: 400 });
  const body = parsed.data;
  
  if (body.status === 'done' && !body.completedAt) {
    body.completedAt = new Date().toISOString();
  } else if (body.status !== 'done') {
    body.completedAt = undefined;
  }
  
  const updated = await storage.update<Task>('tasks', id, body);
  if (!updated) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await storage.delete<Task>('tasks', id);
  if (!deleted) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
