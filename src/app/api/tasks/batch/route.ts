import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Task } from '@/types';
import { taskUpdateSchema, prepareTaskUpdate } from '@/lib/task-domain';

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { ids, data } = body;

  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'IDs array required' }, { status: 400 });
  }

  const parsed = taskUpdateSchema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: 'Dados de tarefa inválidos.' }, { status: 400 });
  const updateData = await prepareTaskUpdate(parsed.data);
  const results = await storage.updateMany<Task>('tasks', ids, updateData);

  return NextResponse.json({ updated: results.length, missing: ids.filter((id: string) => !results.some((task) => task.id === id)) });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'IDs array required' }, { status: 400 });
  }

  let deleted: string[];
  try { deleted = await storage.deleteMany<Task>('tasks', ids); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível excluir as tarefas.' }, { status: 409 }); }

  return NextResponse.json({ deleted: deleted.length, missing: ids.filter((id: string) => !deleted.includes(id)) });
}
