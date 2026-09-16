import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCode, signGoogleState } from '@/lib/google-calendar';

export async function GET(request: NextRequest) {
  const errorUrl = new URL('/inbox?calendar=error', request.url); const code = request.nextUrl.searchParams.get('code'); const [nonce, signature] = (request.nextUrl.searchParams.get('state') || '').split('.');
  if (!code || !nonce || request.cookies.get('lifesystem_google_oauth')?.value !== nonce || signature !== signGoogleState(nonce)) return NextResponse.redirect(errorUrl);
  try {
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'https://lifesystem.oj0nny.com/api/google-calendar/callback';
    await exchangeGoogleCode(code, redirectUri);
  }
  catch { return NextResponse.redirect(errorUrl); }
  const response = NextResponse.redirect(new URL('/inbox?calendar=connected', request.url)); response.cookies.delete('lifesystem_google_oauth'); return response;
}
