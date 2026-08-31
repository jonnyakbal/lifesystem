import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import type { McpCallLog } from '@/lib/mcp/log';

export async function GET() {
  const logs = await storage.getAll<McpCallLog>('mcp-logs');
  logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json(logs.slice(0, 50));
}
