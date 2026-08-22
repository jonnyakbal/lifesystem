import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { WikiCollection } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const collection = await storage.update<WikiCollection>('wiki-collections', id, body);
  return NextResponse.json(collection);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await storage.delete('wiki-collections', id);
  return NextResponse.json({ success: true });
}
