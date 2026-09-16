import { NextResponse } from 'next/server';
import { buildGoogleAuthorizationUrl, googleCalendarConfigured, signGoogleState } from '@/lib/google-calendar';

function callbackUrl() {
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'https://lifesystem.oj0nny.com/api/google-calendar/callback';
}

export async function GET() {
  const appOrigin = new URL(callbackUrl()).origin;
  if (!googleCalendarConfigured()) return NextResponse.redirect(new URL('/inbox?calendar=not-configured', appOrigin));
  const nonce = crypto.randomUUID(); const response = NextResponse.redirect(buildGoogleAuthorizationUrl(callbackUrl(), `${nonce}.${signGoogleState(nonce)}`));
  response.cookies.set('lifesystem_google_oauth', nonce, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/' });
  return response;
}
