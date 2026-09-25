import { timingSafeStringEqual } from '../auth';

export interface McpKeyConfiguration {
  id: string;
  key: string;
  scopes: string[];
}

export interface McpAuthorization {
  keyId: string;
  scopes: string[];
}

type McpAuthEnvironment = {
  MCP_API_KEY?: string;
  MCP_API_KEYS?: string;
};

export function getMcpConfigurationStatus(environment: McpAuthEnvironment = {
  MCP_API_KEY: process.env.MCP_API_KEY,
  MCP_API_KEYS: process.env.MCP_API_KEYS,
}) {
  const legacy = Boolean(environment.MCP_API_KEY);
  const scoped = parseMcpKeyConfigurations(environment.MCP_API_KEYS).length;
  return {
    configured: legacy || scoped > 0,
    mode: legacy ? (scoped > 0 ? 'both' : 'legacy') : (scoped > 0 ? 'scoped' : 'none'),
    keyCount: scoped + (legacy ? 1 : 0),
  };
}

export function parseMcpKeyConfigurations(raw: string | undefined): McpKeyConfiguration[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is McpKeyConfiguration => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = entry as Partial<McpKeyConfiguration>;
      return typeof candidate.id === 'string' && candidate.id.length > 0
        && typeof candidate.key === 'string' && candidate.key.length >= 32
        && Array.isArray(candidate.scopes)
        && candidate.scopes.every((scope) => typeof scope === 'string' && scope.length > 0);
    });
  } catch {
    return [];
  }
}

export function authorizeMcpToken(
  presented: string,
  environment: McpAuthEnvironment = {
    MCP_API_KEY: process.env.MCP_API_KEY,
    MCP_API_KEYS: process.env.MCP_API_KEYS,
  },
): McpAuthorization | null {
  if (!presented) return null;

  const legacyKey = environment.MCP_API_KEY;
  if (legacyKey && timingSafeStringEqual(presented, legacyKey)) {
    // Backward compatibility for the existing Hermes integration. Replace it
    // with a scoped key when the client can be updated independently.
    return { keyId: 'legacy', scopes: ['*'] };
  }

  const match = parseMcpKeyConfigurations(environment.MCP_API_KEYS)
    .find((entry) => timingSafeStringEqual(presented, entry.key));
  return match ? { keyId: match.id, scopes: match.scopes } : null;
}

const ENTITY_SCOPES: Record<string, string> = {
  task: 'tasks', content: 'content', capture: 'captures', pillar: 'pillars',
  indicator: 'indicators', project: 'projects', log_entry: 'log_entries', edital: 'editais',
  financial_entry: 'financial', account: 'financial', budget: 'financial', card: 'financial',
  payee: 'financial', bill: 'financial', financial_goal: 'financial',
  calendar_event: 'calendar',
  content_source: 'content_hub', content_item: 'content_hub',
};

const PLURAL_SCOPES: Record<string, string> = {
  tasks: 'tasks', content: 'content', captures: 'captures', pillars: 'pillars',
  indicators: 'indicators', projects: 'projects', log_entries: 'log_entries', editais: 'editais',
  financial_entries: 'financial', accounts: 'financial', budgets: 'financial', cards: 'financial',
  payees: 'financial', bills: 'financial', financial_goals: 'financial',
  content_sources: 'content_hub', content_items: 'content_hub',
};

export function canUseMcpTool(toolName: string, scopes: string[]): boolean {
  if (scopes.includes('*')) return true;

  const summary = toolName === 'get_financial_summary';
  if (summary) return scopes.includes('financial:read') || scopes.includes('financial:*');

  const operation = /^(list|create|update|delete)_/.exec(toolName);
  if (!operation) return false;
  const domain = operation[1] === 'list'
    ? PLURAL_SCOPES[toolName.slice('list_'.length)]
    : ENTITY_SCOPES[toolName.slice(`${operation[1]}_`.length)];
  if (!domain) return false;

  const action = operation[1] === 'list' ? 'read' : 'write';
  return scopes.includes(`${domain}:${action}`) || scopes.includes(`${domain}:*`);
}

export function scopeForMcpEntity(entity: string) {
  return ENTITY_SCOPES[entity] || `${entity}s`;
}
