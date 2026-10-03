import { parseMcpKeyConfigurations } from '@/lib/mcp/auth';
import type { McpCallLog } from '@/lib/mcp/log';
import { storage } from '@/lib/storage';
import { readHealthLedger } from '@/lib/health/store';
import { readLedger } from '@/lib/professional/store';

// What has actually been proven for each dedicated agent (E4). A credential
// belongs to a profile by its scope domain, never by its name. Each kind of
// evidence stays separate: configured credential, successful discovery or
// call, and an operation approved by the owner and applied. A conversation in
// the office proves none of these. Key values are never read into the result.

export type EvidenceState = 'unknown' | 'configured' | 'verified' | 'stale';
export type AgentEvidence = {
  domain: 'health' | 'professional';
  state: EvidenceState;
  credentials: { id: string; scopes: string[] }[];
  lastCall: { keyId: string; tool: string; at: string } | null;
  lastFailure: { keyId: string; tool: string; at: string } | null;
  lastApplied: { keyId: string; at: string; operation: string } | null;
  logWindow: number;
};

const STALE_MS = 7 * 86_400_000;
const domains = { orion: 'health', sirius: 'professional' } as const;

export async function capabilityEvidence(now = Date.now()): Promise<Record<keyof typeof domains, AgentEvidence>> {
  const keys = parseMcpKeyConfigurations(process.env.MCP_API_KEYS).map(({ id, scopes }) => ({ id, scopes }));
  const logs = (await storage.getAll<McpCallLog>('mcp-logs')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const health = await readHealthLedger();
  const professional = await readLedger();
  const result = {} as Record<keyof typeof domains, AgentEvidence>;
  for (const [agent, domain] of Object.entries(domains) as [keyof typeof domains, 'health' | 'professional'][]) {
    const credentials = keys.filter((key) => key.scopes.some((scope) => scope.startsWith(`${domain}:`)));
    const ids = new Set(credentials.map((key) => key.id));
    const ok = logs.find((log) => log.success && log.clientId && ids.has(log.clientId));
    const failed = logs.find((log) => !log.success && log.clientId && ids.has(log.clientId));
    const latestHealth = health.receipts
      .filter((r) => r.operation === 'apply' && ids.has(r.actor))
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
    const latestProfessional = professional.history
      .filter((h) => h.action.startsWith('save:') && ids.has(h.actor))
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    const applied = domain === 'health'
      ? latestHealth && { keyId: latestHealth.actor, at: latestHealth.recordedAt, operation: 'apply' }
      : latestProfessional && { keyId: latestProfessional.actor, at: latestProfessional.at, operation: latestProfessional.action };
    const state: EvidenceState = !credentials.length ? 'unknown' : !ok ? 'configured' : now - Date.parse(ok.createdAt) > STALE_MS ? 'stale' : 'verified';
    result[agent] = {
      domain,
      state,
      credentials,
      lastCall: ok ? { keyId: ok.clientId!, tool: ok.tool, at: ok.createdAt } : null,
      lastFailure: failed && (!ok || failed.createdAt > ok.createdAt) ? { keyId: failed.clientId!, tool: failed.tool, at: failed.createdAt } : null,
      lastApplied: applied || null,
      logWindow: logs.length,
    };
  }
  return result;
}
