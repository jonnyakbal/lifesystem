import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { storage } from '@/lib/storage';
import { Task } from '@/types';
import { readJson, taskPayloadSchema } from '@/lib/validation';
import { reconcilePlannedTaskDeadlines } from '@/lib/task-domain';

export async function GET() {
  const tasks = await reconcilePlannedTaskDeadlines();
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await readJson(request); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'JSON inválido' }, { status: 400 });
  }

  if (Array.isArray(body)) {
    const parsed = z.array(taskPayloadSchema).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Dados de tarefa inválidos' }, { status: 400 });
    const tasks = await Promise.all(
      parsed.data.map((task) =>
        storage.create<Task>('tasks', {
          workType: task.workType, responsible: task.responsible, nextAction: task.nextAction,
          title: task.title || 'Sem título',
          description: task.description,
          priority: task.priority || 'normal',
          status: task.status || 'todo',
          projectId: task.projectId,
          pillarId: task.pillarId,
          dueDate: task.dueDate,
          tags: task.tags || [],
          checklist: task.checklist || [],
          sortOrder: task.sortOrder || 0,
          recurring: task.recurring,
          recurringFrequency: task.recurringFrequency,
        })
      )
    );
    return NextResponse.json(tasks, { status: 201 });
  }

  const parsed = taskPayloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Dados de tarefa inválidos' }, { status: 400 });
  const task = await storage.create<Task>('tasks', {
    workType: parsed.data.workType, responsible: parsed.data.responsible, nextAction: parsed.data.nextAction,
    title: parsed.data.title || 'Sem título',
    description: parsed.data.description,
    priority: parsed.data.priority || 'normal',
    status: parsed.data.status || 'todo',
    projectId: parsed.data.projectId,
    pillarId: parsed.data.pillarId,
    dueDate: parsed.data.dueDate,
    tags: parsed.data.tags || [],
    checklist: parsed.data.checklist || [],
    sortOrder: parsed.data.sortOrder || 0,
    recurring: parsed.data.recurring,
    recurringFrequency: parsed.data.recurringFrequency,
  });
  return NextResponse.json(task, { status: 201 });
}
