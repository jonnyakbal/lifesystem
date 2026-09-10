// Minimal OpenAI-compatible model listing, so clients that probe
// GET /v1/models before accepting a custom provider (e.g. Hermes Agent's
// "Refresh Models" in its custom-endpoint setup) get a non-empty response.
// The actual model used per request is chosen by the fallback chain in
// src/lib/ai.ts, not by this list — see /api/ai/v1/chat/completions.
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeStringEqual } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  const auth = request.headers.get('authorization') || '';
  const presented = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!presented || !timingSafeStringEqual(presented, apiKey)) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  return NextResponse.json({
    object: 'list',
    data: [{ id: 'lifesystem-auto', object: 'model', created: 0, owned_by: 'lifesystem' }],
  });
}
