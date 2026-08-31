import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Task } from '@/types';

export async function GET() {
  const tasks = await storage.getAll<Task>('tasks');
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (Array.isArray(body)) {
    const tasks = await Promise.all(
      body.map((task: Partial<Task>) =>
        storage.create<Task>('tasks', {
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

  const task = await storage.create<Task>('tasks', {
    title: body.title || 'Sem título',
    description: body.description,
    priority: body.priority || 'normal',
    status: body.status || 'todo',
    projectId: body.projectId,
    pillarId: body.pillarId,
    dueDate: body.dueDate,
    tags: body.tags || [],
    checklist: body.checklist || [],
    sortOrder: body.sortOrder || 0,
    recurring: body.recurring,
    recurringFrequency: body.recurringFrequency,
  });
  return NextResponse.json(task, { status: 201 });
}
