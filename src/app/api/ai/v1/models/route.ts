// Minimal OpenAI-compatible model listing, so clients that probe
// GET /v1/models before accepting a custom provider (e.g. Hermes Agent's
// "Refresh Models" in its custom-endpoint setup) get a non-empty response.
// The actual model used per request is chosen by the fallback chain in
// src/lib/ai.ts, not by this list — see /api/ai/v1/chat/completions.
import { NextRequest, NextResponse } from 'next/server';
import { authorizeMcpToken, canInvokeAi } from '@/lib/mcp/auth';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization') || '';
  const presented = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const authorization = presented ? authorizeMcpToken(presented) : null;
  if (!authorization || !canInvokeAi(authorization.scopes)) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  return NextResponse.json({
    object: 'list',
    data: [{ id: 'lifesystem-auto', object: 'model', created: 0, owned_by: 'lifesystem' }],
  });
}
