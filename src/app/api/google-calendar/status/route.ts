import { NextResponse } from 'next/server';
import { getGoogleCalendarConnectionStatus } from '@/lib/google-calendar';

export async function GET() {
  return NextResponse.json(await getGoogleCalendarConnectionStatus());
}
