import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Task } from '@/types';

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { ids, data } = body;

  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'IDs array required' }, { status: 400 });
  }

  const updateData = { ...data };
  if (updateData.status === 'done' && !updateData.completedAt) {
    updateData.completedAt = new Date().toISOString();
  } else if (updateData.status !== 'done') {
    updateData.completedAt = undefined;
  }
  const results = await storage.updateMany<Task>('tasks', ids, updateData);

  return NextResponse.json({ updated: results.length, missing: ids.filter((id: string) => !results.some((task) => task.id === id)) });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'IDs array required' }, { status: 400 });
  }

  const deleted = await storage.deleteMany<Task>('tasks', ids);

  return NextResponse.json({ deleted: deleted.length, missing: ids.filter((id: string) => !deleted.includes(id)) });
}
