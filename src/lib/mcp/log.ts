// Lightweight audit trail for what an external MCP client (the Hermes
// Agent) actually calls — surfaced on the /hermes page so Jonny can see
// activity without digging into server logs. Capped at MAX_LOGS so this
// never grows unbounded in the JSON-file storage layer.
import { storage } from '@/lib/storage';

export interface McpCallLog {
  id: string;
  tool: string;
  success: boolean;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const MAX_LOGS = 200;

export async function logMcpCall(tool: string, success: boolean, error?: string): Promise<void> {
  await storage.create<McpCallLog>('mcp-logs', { tool, success, error } as Omit<McpCallLog, 'id' | 'createdAt' | 'updatedAt'>);
  const all = await storage.getAll<McpCallLog>('mcp-logs');
  if (all.length > MAX_LOGS) {
    const sorted = [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const excess = sorted.slice(0, all.length - MAX_LOGS);
    await Promise.all(excess.map(item => storage.delete('mcp-logs', item.id)));
  }
}
