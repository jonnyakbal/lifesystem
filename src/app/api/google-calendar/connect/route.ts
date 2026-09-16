import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleAuthorizationUrl, googleCalendarConfigured, signGoogleState } from '@/lib/google-calendar';

function callbackUrl(request: NextRequest) { return new URL('/api/google-calendar/callback', request.url).toString(); }

export async function GET(request: NextRequest) {
  if (!googleCalendarConfigured()) return NextResponse.redirect(new URL('/inbox?calendar=not-configured', request.url));
  const nonce = crypto.randomUUID(); const response = NextResponse.redirect(buildGoogleAuthorizationUrl(callbackUrl(request), `${nonce}.${signGoogleState(nonce)}`));
  response.cookies.set('lifesystem_google_oauth', nonce, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/' });
  return response;
}
