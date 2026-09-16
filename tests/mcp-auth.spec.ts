import { test, expect } from '@playwright/test';
import { authorizeMcpToken, canUseMcpTool, parseMcpKeyConfigurations } from '../src/lib/mcp/auth';

const scopedKey = 'test-mcp-key-that-is-long-enough-123456';
const configured = JSON.stringify([{ id: 'hermes-readonly', key: scopedKey, scopes: ['tasks:read', 'financial:read'] }]);

test.describe('MCP key scopes', () => {
  test('keeps the legacy key compatible with full access', () => {
    expect(authorizeMcpToken('legacy-secret', { MCP_API_KEY: 'legacy-secret' }))
      .toEqual({ keyId: 'legacy', scopes: ['*'] });
  });

  test('authorizes configured keys without exposing write scopes', () => {
    expect(authorizeMcpToken(scopedKey, { MCP_API_KEYS: configured }))
      .toEqual({ keyId: 'hermes-readonly', scopes: ['tasks:read', 'financial:read'] });
    expect(canUseMcpTool('list_tasks', ['tasks:read'])).toBe(true);
    expect(canUseMcpTool('create_task', ['tasks:read'])).toBe(false);
    expect(canUseMcpTool('get_financial_summary', ['financial:read'])).toBe(true);
    expect(canUseMcpTool('create_financial_entry', ['financial:read'])).toBe(false);
    expect(canUseMcpTool('create_calendar_event', ['calendar:write'])).toBe(true);
    expect(canUseMcpTool('create_calendar_event', ['calendar:read'])).toBe(false);
  });

  test('fails closed for malformed key configuration', () => {
    expect(parseMcpKeyConfigurations('{invalid')).toEqual([]);
    expect(authorizeMcpToken(scopedKey, { MCP_API_KEYS: '{invalid' })).toBeNull();
    expect(authorizeMcpToken('short', {
      MCP_API_KEYS: JSON.stringify([{ id: 'short', key: 'short', scopes: ['*'] }]),
    })).toBeNull();
  });

  test('does not permit unknown tools through scoped credentials', () => {
    expect(canUseMcpTool('delete_everything', ['tasks:write'])).toBe(false);
    expect(canUseMcpTool('get_vision', ['tasks:read'])).toBe(false);
  });
});
