import { NextRequest, NextResponse } from 'next/server';
import { isValidSessionToken, SESSION_COOKIE } from '@/lib/auth';

// Cookie-based auth gate — the whole app is personal data (finanças, diário,
// tarefas), so it must never be reachable without logging in once it's live
// on a public URL. Credentials come from AUTH_USER/AUTH_PASSWORD env vars
// only (never hardcoded here), so the deploy fails closed if they're not set.
// /api/mcp does its own Bearer-token auth (see src/app/api/mcp/route.ts) —
// it's called by external agents with no browser session, so the cookie
// gate below doesn't apply to it.
const PUBLIC_PATHS = ['/login', '/api/login', '/api/mcp'];

export async function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
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
