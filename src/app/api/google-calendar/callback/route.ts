import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCode, signGoogleState } from '@/lib/google-calendar';

export async function GET(request: NextRequest) {
  const errorUrl = new URL('/inbox?calendar=error', request.url); const code = request.nextUrl.searchParams.get('code'); const [nonce, signature] = (request.nextUrl.searchParams.get('state') || '').split('.');
  if (!code || !nonce || request.cookies.get('lifesystem_google_oauth')?.value !== nonce || signature !== signGoogleState(nonce)) return NextResponse.redirect(errorUrl);
  try { await exchangeGoogleCode(code, new URL('/api/google-calendar/callback', request.url).toString()); }
  catch { return NextResponse.redirect(errorUrl); }
  const response = NextResponse.redirect(new URL('/inbox?calendar=connected', request.url)); response.cookies.delete('lifesystem_google_oauth'); return response;
}
