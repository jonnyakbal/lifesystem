import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Pillar } from '@/types';

export async function GET() {
  const pillars = await storage.getAll<Pillar>('pillars');
  return NextResponse.json(pillars);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const pillar = await storage.create<Pillar>('pillars', {
    name: body.name,
    description: body.description,
    icon: body.icon,
    color: body.color,
    sortOrder: body.sortOrder || 0,
    currentStatus: body.currentStatus || '',
    target: body.target || '',
  });
  return NextResponse.json(pillar, { status: 201 });
}
