import { NextRequest, NextResponse } from 'next/server';
import { listJournalEntries, saveJournalEntry } from '@/lib/journal';
import { journalPayloadSchema, readJson } from '@/lib/validation';

export async function GET() {
  return NextResponse.json(await listJournalEntries());
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try { rawBody = await readJson(request); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'JSON inválido' }, { status: 400 });
  }
  const parsed = journalPayloadSchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'Dados do diário inválidos' }, { status: 400 });
  const { entryDate, content, pillarChecks, gratitude, mood } = parsed.data;
  const result = await saveJournalEntry(entryDate, { content, pillarChecks, gratitude, mood });
  if (!result) return NextResponse.json({ error: 'Conflito de versão do diário' }, { status: 409 });
  return NextResponse.json(result.entry, { status: result.created ? 201 : 200 });
}
