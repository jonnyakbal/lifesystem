import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { storage } from '@/lib/storage';
import { StageConfig, Task } from '@/types';
import { readJson, taskPayloadSchema } from '@/lib/validation';

async function isTerminalStatus(status: string): Promise<boolean> {
  const matches = await storage.query<StageConfig>('stage-configs', { scope: 'tasks' });
  const config = matches[0];
  if (!config) return status === 'done';
  const stage = config.stages.find(s => s.id === status);
  return stage ? !!stage.isTerminal : status === 'done';
}

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
  const parsed = taskPayloadSchema.partial().extend({ dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() }).safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'Dados de tarefa inválidos' }, { status: 400 });
  const { dueDate, ...data } = parsed.data;
  const body: Partial<Task> = dueDate === null
    ? { ...data, dueDate: undefined }
    : { ...data, ...(dueDate !== undefined ? { dueDate } : {}) };
  
  if (body.status !== undefined) {
    const terminal = await isTerminalStatus(body.status);
    if (terminal && !body.completedAt) {
      body.completedAt = new Date().toISOString();
    } else if (!terminal) {
      body.completedAt = undefined;
    }
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
