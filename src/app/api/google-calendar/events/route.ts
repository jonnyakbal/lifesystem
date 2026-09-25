import { NextRequest, NextResponse } from 'next/server';
import { GoogleCalendarError, listGoogleCalendarEvents } from '@/lib/google-calendar';

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from') || '';
  const to = request.nextUrl.searchParams.get('to') || '';
  try {
    return NextResponse.json(await listGoogleCalendarEvents(from, to));
  } catch (error) {
    if (error instanceof GoogleCalendarError) {
      const status = error.message.includes('intervalo') ? 400 : error.message.includes('Conecte') ? 409 : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ error: 'Não foi possível consultar a agenda.' }, { status: 502 });
  }
}
