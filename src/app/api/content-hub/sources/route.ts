import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { storage } from '@/lib/storage';
import { ContentSource } from '@/types';
import { readJson, contentSourcePayloadSchema } from '@/lib/validation';

export async function GET() {
  const sources = await storage.getAll<ContentSource>('content-sources');
  return NextResponse.json(sources);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await readJson(request); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'JSON inválido' }, { status: 400 });
  }

  const parsed = contentSourcePayloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Dados da fonte inválidos', issues: parsed.error.flatten() }, { status: 400 });

  const source = await storage.create<ContentSource>('content-sources', {
    name: parsed.data.name,
    type: parsed.data.type,
    url: parsed.data.url,
    description: parsed.data.description,
    icon: parsed.data.icon,
    color: parsed.data.color,
    tags: parsed.data.tags || [],
    isActive: parsed.data.isActive ?? true,
    fetchStatus: 'idle',
    itemCount: 0,
  });
  return NextResponse.json(source, { status: 201 });
}