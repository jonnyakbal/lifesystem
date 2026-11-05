import { NextRequest, NextResponse } from 'next/server';
import { consumeRateLimit } from '@/lib/rate-limit';
import { importDeviceObservations } from '@/lib/health/service';
import { APPLE_ACTOR, appleObservations, applePayloadSchema, rememberImport, verifyAppleToken } from '@/lib/health/apple';

// Recebe as amostras enviadas pela automação do app Atalhos no iPhone.
// Autentica pela chave do Apple Saúde (Bearer), não pela sessão do navegador.
export async function POST(request: NextRequest) {
  const [scheme, token, extra] = (request.headers.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token || extra || !await verifyAppleToken(token)) {
    return NextResponse.json({ error: 'Chave do Apple Saúde inválida ou revogada.' }, { status: 401 });
  }
  const rate = consumeRateLimit('apple-health-import', 30, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: 'Muitos envios nesta hora.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Envie as amostras em JSON.' }, { status: 400 }); }
  const parsed = applePayloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Formato de amostras inválido.' }, { status: 400 });
  let timezone = parsed.data.timezone || 'America/Sao_Paulo';
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { timezone = 'America/Sao_Paulo'; }
  try {
    const result = await importDeviceObservations(appleObservations(parsed.data.samples, timezone), APPLE_ACTOR);
    await rememberImport(result);
    return NextResponse.json(result);
  } catch { return NextResponse.json({ error: 'Não foi possível registrar as amostras.' }, { status: 500 }); }
}
