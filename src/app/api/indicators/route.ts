import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { Indicator } from '@/types';
import { indicatorPayloadSchema, readJson } from '@/lib/validation';

export async function GET() {
  const indicators = await storage.getAll<Indicator>('indicators');
  return NextResponse.json(indicators);
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try { rawBody = await readJson(request); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'JSON inválido' }, { status: 400 });
  }
  const parsed = indicatorPayloadSchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'Dados do indicador inválidos' }, { status: 400 });
  const body = parsed.data;
  const indicator = await storage.create<Indicator>('indicators', {
    pillarId: body.pillarId,
    name: body.name,
    description: body.description,
    type: body.type,
    targetValue: body.targetValue,
    currentValue: body.currentValue,
    unit: body.unit,
    frequency: body.frequency,
  });
  return NextResponse.json(indicator, { status: 201 });
}
