import type { NextRequest } from 'next/server';
import { isValidSessionToken, SESSION_COOKIE } from '@/lib/auth';
export async function requireProfessionalOwner(request: NextRequest) {
  if (!await isValidSessionToken(request.cookies.get(SESSION_COOKIE)?.value)) throw new Error('Identidade humana autenticada necessária.');
  if (request.method !== 'GET') {
    const origin = request.headers.get('origin');
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host;
    if (origin && new URL(origin).host !== host) throw new Error('Origem da aprovação inválida.');
  }
  return { id: process.env.AUTH_USER!, human: true };
}
