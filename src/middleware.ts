import { NextRequest, NextResponse } from 'next/server';

// Simple HTTP Basic Auth gate — the whole app is personal data (finanças,
// diário, tarefas), so it must never be reachable without a password once
// it's live on a public URL. Credentials come from env vars only (never
// hardcoded here), so the deploy fails closed if they're not set.
export function middleware(request: NextRequest) {
  const expectedUser = process.env.AUTH_USER;
  const expectedPassword = process.env.AUTH_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return new NextResponse(
      'Auth not configured: set AUTH_USER and AUTH_PASSWORD environment variables.',
      { status: 503 }
    );
  }

  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ');
    if (scheme === 'Basic' && encoded) {
      const [user, password] = Buffer.from(encoded, 'base64').toString().split(':');
      if (user === expectedUser && password === expectedPassword) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Autenticação necessária.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="LIFESYSTEM"' },
  });
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
