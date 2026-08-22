import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { FinancialGoal } from '@/types';

export async function GET() {
  const goals = await storage.getAll<FinancialGoal>('financial-goals');
  return NextResponse.json(goals);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const goal = await storage.create<FinancialGoal>('financial-goals', {
    name: body.name,
    description: body.description,
    targetAmount: body.targetAmount,
    currentAmount: body.currentAmount || 0,
    deadline: body.deadline,
    icon: body.icon || '🎯',
    color: body.color || 'primary',
    status: body.status || 'active',
  });
  return NextResponse.json(goal, { status: 201 });
}
