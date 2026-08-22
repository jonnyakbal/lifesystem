import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Indicator } from '@/types';

export async function GET() {
  const indicators = await storage.getAll<Indicator>('indicators');
  return NextResponse.json(indicators);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const indicator = await storage.create<Indicator>('indicators', {
    pillarId: body.pillarId,
    name: body.name,
    description: body.description,
    type: body.type || 'count',
    targetValue: body.targetValue,
    currentValue: body.currentValue || 0,
    unit: body.unit,
    frequency: body.frequency || 'weekly',
  });
  return NextResponse.json(indicator, { status: 201 });
}
