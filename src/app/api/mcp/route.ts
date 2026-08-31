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
import { timingSafeStringEqual } from '@/lib/auth';

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.MCP_API_KEY;
  if (!expected) return false; // fail closed if not configured
  const header = request.headers.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return false;
  return timingSafeStringEqual(token, expected);
}

async function handle(request: NextRequest): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  const server = createLifesystemMcpServer();
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
