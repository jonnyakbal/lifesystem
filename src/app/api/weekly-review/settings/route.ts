import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { DEFAULT_REVIEW_SETTINGS, REVIEW_SETTINGS_COLLECTION, reviewSettingsSchema, type ReviewSettings } from '@/lib/weekly-review';

type SettingsRecord = { id: string; settings: ReviewSettings; updatedAt?: string };
const ID = 'default';

export async function GET() {
  try {
    const record = await storage.getById<SettingsRecord>(REVIEW_SETTINGS_COLLECTION, ID);
    const parsed = reviewSettingsSchema.safeParse(record?.settings);
    return NextResponse.json(parsed.success ? parsed.data : DEFAULT_REVIEW_SETTINGS);
  } catch { return NextResponse.json({ error: 'Não foi possível carregar o dia da revisão.' }, { status: 500 }); }
}

export async function PUT(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Envie o dia da revisão em JSON válido.' }, { status: 400 }); }
  const parsed = reviewSettingsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Escolha um dia da semana entre 1 (segunda) e 7 (domingo).' }, { status: 400 });
  try {
    await storage.transact<SettingsRecord, void>(REVIEW_SETTINGS_COLLECTION, records => {
      const record = { id: ID, settings: parsed.data, updatedAt: new Date().toISOString() };
      const index = records.findIndex(item => item.id === ID);
      if (index === -1) records.push(record); else records[index] = record;
    });
    return NextResponse.json(parsed.data);
  } catch { return NextResponse.json({ error: 'Não foi possível salvar o dia da revisão.' }, { status: 500 }); }
}
