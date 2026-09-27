import { z } from 'zod';
import { storage } from '@/lib/storage';

const heartbeatSchema = z.object({
  version: z.string().trim().min(1).max(100).optional(),
  status: z.enum(['online', 'degraded']).default('online'),
  tools: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
}).strict();

export interface McpHeartbeat {
  id: string;
  clientId: string;
  version?: string;
  status: 'online' | 'degraded';
  tools: string[];
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export async function recordMcpHeartbeat(clientId: string, raw: unknown) {
  const data = heartbeatSchema.parse(raw);
  const previous = (await storage.getAll<McpHeartbeat>('mcp-heartbeats'))
    .filter(item => item.clientId === clientId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const payload = { clientId, ...data, lastSeenAt: new Date().toISOString() };
  if (!previous) return storage.create<McpHeartbeat>('mcp-heartbeats', payload);
  const updated = await storage.update<McpHeartbeat>('mcp-heartbeats', previous.id, payload);
  if (!updated) throw new Error('Não foi possível atualizar o heartbeat.');
  return updated;
}

export async function getLatestMcpHeartbeat() {
  const records = await storage.getAll<McpHeartbeat>('mcp-heartbeats');
  return records.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))[0] || null;
}
