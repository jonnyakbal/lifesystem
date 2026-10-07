import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidSessionToken, SESSION_COOKIE } from '@/lib/auth';
import { copyToD1, migrationPlan } from '@/lib/storage/d1-migration';
import { consumeRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Owner session only (src/proxy.ts also enforces same-origin for writes).
// Responses carry collection names and item counts, never record contents.
async function authorized(r: NextRequest) {
  return isValidSessionToken(r.cookies.get(SESSION_COOKIE)?.value);
}

export async function GET(r: NextRequest) {
  if (!(await authorized(r))) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  try {
    return NextResponse.json(await migrationPlan(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 200) : 'Falha ao comparar.' }, { status: 502 });
  }
}

const body = z.object({ replace: z.array(z.string().max(128)).max(200).default([]) }).strict();

export async function POST(r: NextRequest) {
  if (!(await authorized(r))) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });
  if (!consumeRateLimit('d1-migration', 5, 60_000).allowed)
    return NextResponse.json({ error: 'Aguarde um instante antes de copiar de novo.' }, { status: 429 });
  const parsed = body.safeParse(await r.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  try {
    const results = await copyToD1(parsed.data.replace);
    return NextResponse.json({ results, plan: await migrationPlan() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 200) : 'Falha ao copiar.' }, { status: 502 });
  }
}
