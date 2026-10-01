import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readJson, taskPayloadSchema } from '@/lib/validation';
import { createTaskRecords, reconcilePlannedTaskDeadlines } from '@/lib/task-domain';

export async function GET() {
  const tasks = await reconcilePlannedTaskDeadlines();
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await readJson(request); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'JSON inválido' }, { status: 400 });
  }

  const batch = Array.isArray(body);
  const parsed = z.array(taskPayloadSchema).max(500).safeParse(batch ? body : [body]);
  if (!parsed.success) return NextResponse.json({ error: 'Dados de tarefa inválidos' }, { status: 400 });
  try {
    const tasks = await createTaskRecords(parsed.data);
    return NextResponse.json(batch ? tasks : tasks[0], { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível criar tarefa.' }, { status: 409 }); }
}
