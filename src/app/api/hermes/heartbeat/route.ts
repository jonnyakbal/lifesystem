import { NextRequest, NextResponse } from 'next/server';
import { authorizeMcpToken, canPublishAgentHeartbeat } from '@/lib/mcp/auth';
import { recordMcpHeartbeat } from '@/lib/mcp/heartbeat';
import { consumeRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const [scheme, token, extra] = header.split(' ');
  const authorization = scheme === 'Bearer' && token && !extra ? authorizeMcpToken(token) : null;
  if (!authorization || !canPublishAgentHeartbeat(authorization.scopes)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  const rate = consumeRateLimit(`heartbeat:${authorization.keyId}`, 20, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: 'Muitos heartbeats.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });
  try {
    const heartbeat = await recordMcpHeartbeat(authorization.keyId, await request.json());
    return NextResponse.json({ heartbeat });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Heartbeat inválido.' }, { status: 400 });
  }
}
