import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { DEFAULT_PLANNING_PREFERENCES, planningPreferencesSchema, type PlanningPreferences } from '@/lib/planning-preferences';

type PreferencesRecord = { id: string; preferences: PlanningPreferences; updatedAt?: string };
const COLLECTION = 'planning_preferences';
const ID = 'default';

export async function GET() {
  try {
    const record = await storage.getById<PreferencesRecord>(COLLECTION, ID);
    return NextResponse.json(record ? planningPreferencesSchema.parse(record.preferences) : DEFAULT_PLANNING_PREFERENCES);
  } catch { return NextResponse.json({ error: 'Não foi possível carregar sua capacidade de planejamento.' }, { status: 500 }); }
}

export async function PUT(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Envie preferências em JSON válido.' }, { status: 400 }); }
  const parsed = planningPreferencesSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Preferências inválidas.' }, { status: 400 });
  try {
    await storage.transact<PreferencesRecord, void>(COLLECTION, records => {
      const record = { id: ID, preferences: parsed.data, updatedAt: new Date().toISOString() };
      const index = records.findIndex(item => item.id === ID);
      if (index === -1) records.push(record); else records[index] = record;
    });
    return NextResponse.json(parsed.data);
  } catch { return NextResponse.json({ error: 'Não foi possível salvar sua capacidade de planejamento.' }, { status: 500 }); }
}
