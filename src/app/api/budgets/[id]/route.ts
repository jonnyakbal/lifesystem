import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Budget } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const budget = await storage.update<Budget>('budgets', id, body);
  return NextResponse.json(budget);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await storage.delete('budgets', id);
  return NextResponse.json({ success: true });
}
