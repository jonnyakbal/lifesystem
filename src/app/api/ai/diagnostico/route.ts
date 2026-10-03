// Session-authenticated (src/proxy.ts) check of every AI provider, one by
// one: whether it is configured, its place in the fallback order, and the
// real answer or error of each model, with and without tools. Key values
// never leave the server.
import { NextResponse } from 'next/server';
import { diagnoseProviders } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ checkedAt: new Date().toISOString(), ...(await diagnoseProviders()) });
}
