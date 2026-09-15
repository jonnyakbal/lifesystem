import { NextRequest, NextResponse } from 'next/server';
import { checkCredentials, createSessionToken, SESSION_COOKIE } from '@/lib/auth';
import { clearRateLimit, consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit';
import { readJson } from '@/lib/validation';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const rateLimitKey = getRateLimitKey(request, 'login');
  const rateLimit = consumeRateLimit(rateLimitKey, MAX_ATTEMPTS, WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente mais tarde.' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } });
  }

  let body: unknown;
  try { body = await readJson(request); } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const { user, password } = (body && typeof body === 'object' ? body : {}) as { user?: unknown; password?: unknown };

  if (typeof user !== 'string' || typeof password !== 'string' || !checkCredentials(user, password)) {
    return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 });
  }

  clearRateLimit(rateLimitKey);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
