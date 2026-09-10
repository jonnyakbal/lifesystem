import { NextRequest, NextResponse } from 'next/server';
import { isValidSessionToken, SESSION_COOKIE } from '@/lib/auth';

// Cookie-based auth gate — the whole app is personal data (finanças, diário,
// tarefas), so it must never be reachable without logging in once it's live
// on a public URL. Credentials come from AUTH_USER/AUTH_PASSWORD env vars
// only (never hardcoded here), so the deploy fails closed if they're not set.
// /api/mcp does its own Bearer-token auth (see src/app/api/mcp/route.ts) —
// it's called by external agents with no browser session, so the cookie
// gate below doesn't apply to it.
const PUBLIC_PATHS = ['/login', '/api/login', '/api/mcp', '/api/ai/v1/chat/completions', '/api/ai/v1/models'];

export async function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && pathname !== '/api/mcp') {
    const origin = request.headers.get('origin');
    if (origin) {
      // request.nextUrl.origin is built from the Host header Next.js sees
      // directly — behind Hostinger's reverse proxy that's not necessarily
      // the public hostname the browser sent as Origin (confirmed in prod:
      // a same-page fetch() with a matching window.location.origin still
      // got rejected), so comparing against it directly 403's every real
      // same-origin write. Accept it if it matches either the standard
      // forwarded headers a reverse proxy sets, OR just the hostname of
      // what Next.js saw — covers a proxy that forwards a different scheme
      // or port without needing to know its exact header conventions,
      // while still rejecting a genuinely different site.
      const forwardedHost = request.headers.get('x-forwarded-host');
      const forwardedProto = request.headers.get('x-forwarded-proto');
      const expectedOrigin = forwardedHost
        ? `${forwardedProto || request.nextUrl.protocol.replace(':', '')}://${forwardedHost}`
        : request.nextUrl.origin;
      let originHostname: string | null = null;
      try { originHostname = new URL(origin).hostname; } catch { /* malformed Origin — falls through to reject below */ }
      const hostnameMatches = originHostname !== null && originHostname === request.nextUrl.hostname;
      if (origin !== expectedOrigin && !hostnameMatches) {
        return NextResponse.json({ error: 'Origem não permitida.' }, { status: 403 });
      }
    }
  }
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  if (!process.env.AUTH_USER || !process.env.AUTH_PASSWORD) {
    return new NextResponse(
      'Auth not configured: set AUTH_USER and AUTH_PASSWORD environment variables.',
      { status: 503 }
    );
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await isValidSessionToken(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|covers/).*)',
};
