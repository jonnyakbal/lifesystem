import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { JournalEntry } from '@/types';
import { journalPayloadSchema, readJson } from '@/lib/validation';

export async function GET() {
  const entries = await storage.getAll<JournalEntry>('journal');
  const pillars = await storage.getAll<{ id: string; sortOrder: number }>('pillars');
  const orderedPillars = [...pillars].sort((a, b) => a.sortOrder - b.sortOrder);
  const normalized = entries.map((entry) => {
    const checks = { ...entry.pillarChecks };
    for (const [key, value] of Object.entries(entry.pillarChecks || {})) {
      if (/^[1-6]$/.test(key)) {
        const pillar = orderedPillars[Number(key) - 1];
        if (pillar) checks[pillar.id] = value;
        delete checks[key];
      }
    }
    return { ...entry, pillarChecks: checks };
  });
  return NextResponse.json(normalized);
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try { rawBody = await readJson(request); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'JSON inválido' }, { status: 400 });
  }
  const parsed = journalPayloadSchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'Dados do diário inválidos' }, { status: 400 });
  const body = parsed.data;
  
  // Check if entry exists for this date
  const existing = await storage.query<JournalEntry>('journal', { entryDate: body.entryDate });
  
  if (existing.length > 0) {
    const updated = await storage.update<JournalEntry>('journal', existing[0].id, {
      content: body.content,
      pillarChecks: body.pillarChecks,
      gratitude: body.gratitude,
      mood: body.mood,
    });
    return NextResponse.json(updated);
  }
  
  const entry = await storage.create<JournalEntry>('journal', {
    content: body.content,
    pillarChecks: body.pillarChecks || {},
    gratitude: body.gratitude,
    mood: body.mood,
    entryDate: body.entryDate,
  });
  return NextResponse.json(entry, { status: 201 });
}
