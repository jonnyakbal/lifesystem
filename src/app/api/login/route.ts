import { NextRequest, NextResponse } from 'next/server';
import { checkCredentials, createSessionToken, SESSION_COOKIE } from '@/lib/auth';
import { readJson } from '@/lib/validation';

const failedAttempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const attempt = failedAttempts.get(address);
  if (attempt && attempt.blockedUntil > Date.now()) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente mais tarde.' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((attempt.blockedUntil - Date.now()) / 1000)) } });
  }

  let body: unknown;
  try { body = await readJson(request); } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const { user, password } = (body && typeof body === 'object' ? body : {}) as { user?: unknown; password?: unknown };

  if (typeof user !== 'string' || typeof password !== 'string' || !checkCredentials(user, password)) {
    const count = (attempt?.count || 0) + 1;
    failedAttempts.set(address, { count, blockedUntil: count >= MAX_ATTEMPTS ? Date.now() + BLOCK_MS : 0 });
    return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 });
  }

  failedAttempts.delete(address);

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
