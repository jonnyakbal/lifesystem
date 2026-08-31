// Reports whether the server-side secrets needed for the Hermes
// integration are configured — never the secret values themselves, only
// booleans, since this is read by the client-facing /hermes page.
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    mcpConfigured: Boolean(process.env.MCP_API_KEY),
    nousConfigured: Boolean(process.env.NOUS_API_KEY),
  });
}
