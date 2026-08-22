import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Task } from '@/types';

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { ids, data } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'IDs array required' }, { status: 400 });
  }

  const results = await Promise.all(
    ids.map((id: string) => {
      const updateData = { ...data };
      if (updateData.status === 'done' && !updateData.completedAt) {
        updateData.completedAt = new Date().toISOString();
      } else if (updateData.status !== 'done') {
        updateData.completedAt = undefined;
      }
      return storage.update<Task>('tasks', id, updateData);
    })
  );

  return NextResponse.json({ updated: results.length });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'IDs array required' }, { status: 400 });
  }

  await Promise.all(ids.map((id: string) => storage.delete('tasks', id)));

  return NextResponse.json({ deleted: ids.length });
}
