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
  const professional = ['query_professional', 'get_professional_schemas', 'get_professional_receipt', 'get_professional_diagnostics', 'propose_professional_change', 'batch_professional_proposals', 'apply_professional_proposal', 'submit_professional_artifact', 'report_professional_execution'];
  if (scopes.includes('professional:only') && !professional.includes(toolName)) return false;
  if (scopes.includes('*')) return true;

  const professionalActions: Record<string, string> = { query_professional: 'read', get_professional_schemas: 'read', get_professional_receipt: 'read', get_professional_diagnostics: 'read', propose_professional_change: 'propose', batch_professional_proposals: 'propose', apply_professional_proposal: 'apply', submit_professional_artifact: 'artifact', report_professional_execution: 'execution' };
  if (professionalActions[toolName]) return scopes.includes(`professional:${professionalActions[toolName]}`);

  const actionScopes: Record<string, string[]> = {
    convert_capture: ['captures:convert', 'captures:write', 'captures:*'],
    plan_task_block: ['tasks:plan', 'tasks:write', 'tasks:*'],
    remove_task_block: ['tasks:plan', 'tasks:write', 'tasks:*'],
    adopt_task_calendar_event: ['tasks:plan', 'tasks:write', 'tasks:*'],
    list_calendar_events: ['calendar:read', 'calendar:write', 'calendar:*'],
    create_calendar_event: ['calendar:legacy', 'calendar:*'],
    create_managed_calendar_event: ['calendar:write', 'calendar:*'],
    update_managed_calendar_event: ['calendar:write', 'calendar:*'],
    cancel_managed_calendar_event: ['calendar:write', 'calendar:*'],
  };
  if (actionScopes[toolName]) return actionScopes[toolName].some(scope => scopes.includes(scope));

  const summary = toolName === 'get_financial_summary';
  if (summary) return scopes.includes('financial:read') || scopes.includes('financial:*');

  const operation = /^(list|create|update|delete)_/.exec(toolName);
  if (!operation) return false;
  const domain = operation[1] === 'list'
    ? PLURAL_SCOPES[toolName.slice('list_'.length)]
    : ENTITY_SCOPES[toolName.slice(`${operation[1]}_`.length)];
  if (!domain) return false;

  const action = operation[1] === 'list' ? 'read' : operation[1] === 'delete' ? 'delete' : 'write';
  return scopes.includes(`${domain}:${action}`) || scopes.includes(`${domain}:*`);
}

/** The model gateway is a separate capability from data/tool access. */
export function canInvokeAi(scopes: string[]): boolean {
  return scopes.includes('*') || scopes.includes('ai:invoke');
}

export function canPublishAgentHeartbeat(scopes: string[]): boolean {
  return scopes.includes('*') || scopes.includes('agent:heartbeat');
}

export function scopeForMcpEntity(entity: string) {
  return ENTITY_SCOPES[entity] || `${entity}s`;
}
