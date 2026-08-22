import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'IDs array required' }, { status: 400 });
  }

  await Promise.all(ids.map((id: string) => storage.delete('captures', id)));

  return NextResponse.json({ deleted: ids.length });
}
