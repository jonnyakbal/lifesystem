import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { FinancialGoal } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const goal = await storage.update<FinancialGoal>('financial-goals', id, body);
  return NextResponse.json(goal);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await storage.delete('financial-goals', id);
  return NextResponse.json({ success: true });
}
