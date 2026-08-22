import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Indicator } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const indicator = await storage.update<Indicator>('indicators', id, body);
  return NextResponse.json(indicator);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await storage.delete('indicators', id);
  return NextResponse.json({ success: true });
}
