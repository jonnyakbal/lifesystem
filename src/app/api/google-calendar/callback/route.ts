import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCode, signGoogleState } from '@/lib/google-calendar';

export async function GET(request: NextRequest) {
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'https://lifesystem.oj0nny.com/api/google-calendar/callback';
  const appOrigin = new URL(redirectUri).origin;
  const errorUrl = new URL('/inbox?calendar=error', appOrigin); const code = request.nextUrl.searchParams.get('code'); const [nonce, signature] = (request.nextUrl.searchParams.get('state') || '').split('.');
  if (!code || !nonce || request.cookies.get('lifesystem_google_oauth')?.value !== nonce || signature !== signGoogleState(nonce)) return NextResponse.redirect(errorUrl);
  try {
    await exchangeGoogleCode(code, redirectUri);
  }
  catch { return NextResponse.redirect(errorUrl); }
  const response = NextResponse.redirect(new URL('/inbox?calendar=connected', appOrigin)); response.cookies.delete('lifesystem_google_oauth'); return response;
}
