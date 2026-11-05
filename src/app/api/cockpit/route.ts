import { NextResponse } from 'next/server';
import { readCockpitSignals } from '@/lib/cockpit';

// Sinais do cockpit do Diário de bordo. Só leitura; protegido pela sessão (proxy).
export async function GET() {
  try { return NextResponse.json(await readCockpitSignals()); }
  catch { return NextResponse.json({ error: 'Não foi possível ler os instrumentos.' }, { status: 500 }); }
}
