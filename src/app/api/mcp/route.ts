// MCP endpoint for external AI agents (e.g. Hermes Agent) to read/write
// LIFESYSTEM data. Deliberately NOT behind the cookie session used by the
// web UI (see src/middleware.ts PUBLIC_PATHS) — an agent running on a
// separate VPS has no browser session, so it authenticates with its own
// bearer token instead. A fresh server+transport is created per request
// (stateless mode) since there's no need to hold MCP session state across
// requests for simple tool calls, and it avoids leaking memory across a
// long-running Node process on Hostinger.
import { NextRequest } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createLifesystemMcpServer } from '@/lib/mcp/server';
import { authorizeMcpToken } from '@/lib/mcp/auth';
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit';

const MCP_REQUEST_LIMIT = 120;
const MCP_WINDOW_MS = 60 * 1000;

function getAuthorization(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const [scheme, token, extra] = header.split(' ');
  if (scheme !== 'Bearer' || !token || extra) return null;
  return authorizeMcpToken(token);
}

async function handle(request: NextRequest): Promise<Response> {
  const rateLimit = consumeRateLimit(getRateLimitKey(request, 'mcp'), MCP_REQUEST_LIMIT, MCP_WINDOW_MS);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'Muitas solicitações ao MCP. Tente novamente em instantes.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const authorization = getAuthorization(request);
  if (!authorization) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  const server = createLifesystemMcpServer(authorization.scopes, authorization.keyId);
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function DELETE(request: NextRequest) {
  return handle(request);
}
