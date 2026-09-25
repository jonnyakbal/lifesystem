// Reports whether the server-side secrets needed for the Hermes
// integration are configured — never the secret values themselves, only
// booleans, since this is read by the client-facing /hermes page.
import { NextResponse } from 'next/server';
import { googleCalendarConfigured } from '@/lib/google-calendar';
import { getMcpConfigurationStatus } from '@/lib/mcp/auth';
import { storage } from '@/lib/storage';
import type { McpCallLog } from '@/lib/mcp/log';

export async function GET() {
  const configuration = getMcpConfigurationStatus();
  let lastCallAt: string | null = null;
  let lastSuccessAt: string | null = null;
  let recentFailures = 0;
  let auditAvailable = true;
  try {
    const logs = (await storage.getAll<McpCallLog>('mcp-logs'))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    lastCallAt = logs[0]?.createdAt || null;
    lastSuccessAt = logs.find(log => log.success)?.createdAt || null;
    recentFailures = logs.slice(0, 20).filter(log => !log.success).length;
  } catch {
    auditAvailable = false;
  }
  return NextResponse.json({
    mcpConfigured: configuration.configured,
    mcpMode: configuration.mode,
    mcpKeyCount: configuration.keyCount,
    lastCallAt,
    lastSuccessAt,
    recentFailures,
    auditAvailable,
    nousConfigured: Boolean(process.env.NOUS_API_KEY),
    googleCalendarConfigured: googleCalendarConfigured(),
  });
}
