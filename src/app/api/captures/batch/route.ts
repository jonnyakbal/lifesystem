import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Capture } from '@/types';

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'IDs array required' }, { status: 400 });
  }

  const deleted = await storage.deleteMany<Capture>('captures', ids);

  return NextResponse.json({ deleted: deleted.length, missing: ids.filter((id: string) => !deleted.includes(id)) });
}
