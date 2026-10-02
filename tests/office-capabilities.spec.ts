import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../src/lib/storage';
import { transactHealthLedger } from '../src/lib/health/store';
import { transactLedger } from '../src/lib/professional/store';
import { capabilityEvidence } from '../src/lib/office/capabilities';

const keys = [
  // Named unlike the robot on purpose: membership comes from the scope domain.
  { id: 'vps-health-bridge', key: 'synthetic-health-capability-key-000001', scopes: ['health:only', 'health:read'] },
  { id: 'vps-work-bridge', key: 'synthetic-work-capability-key-0000001', scopes: ['professional:only', 'professional:read'] },
];
let dir: string; const saved: Record<string, string | undefined> = {};
test.beforeEach(async () => {
  for (const name of ['LIFESYSTEM_DATA_DIR', 'MCP_API_KEYS']) saved[name] = process.env[name];
  dir = await mkdtemp(join(tmpdir(), 'office-capabilities-'));
  process.env.LIFESYSTEM_DATA_DIR = dir;
  process.env.MCP_API_KEYS = JSON.stringify(keys);
});
test.afterEach(async () => {
  for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  await rm(dir, { recursive: true, force: true });
});

test('evidence is grouped by scope domain and keeps each kind of proof separate', async () => {
  let evidence = await capabilityEvidence();
  expect(evidence.orion).toMatchObject({ state: 'configured', credentials: [{ id: 'vps-health-bridge', scopes: ['health:only', 'health:read'] }], lastCall: null, lastApplied: null });
  expect(evidence.sirius.credentials.map((c) => c.id)).toEqual(['vps-work-bridge']);
  expect(JSON.stringify(evidence)).not.toContain('synthetic-health-capability-key');

  await storage.create('mcp-logs', { tool: 'get_health_capabilities', success: true, clientId: 'vps-health-bridge' });
  await storage.create('mcp-logs', { tool: 'query_professional', success: true, clientId: 'someone-else' });
  await transactHealthLedger((ledger) => { ledger.receipts.push({ actor: 'vps-health-bridge', key: 'k1', operation: 'apply', fingerprint: 'f', resultId: 'r', recordedAt: new Date().toISOString() }); });
  evidence = await capabilityEvidence();
  expect(evidence.orion).toMatchObject({ state: 'verified', lastCall: { keyId: 'vps-health-bridge', tool: 'get_health_capabilities' }, lastApplied: { keyId: 'vps-health-bridge', operation: 'apply' } });
  // A call by an unrelated credential proves nothing for Sirius.
  expect(evidence.sirius).toMatchObject({ state: 'configured', lastCall: null, lastApplied: null });

  await transactLedger((ledger) => { ledger.history.push({ at: new Date().toISOString(), actor: 'vps-work-bridge', action: 'save:work', recordId: 'w1' }); });
  expect((await capabilityEvidence()).sirius.lastApplied).toMatchObject({ keyId: 'vps-work-bridge', operation: 'save:work' });
});

test('old success turns stale, a later failure is reported, and no credential means unknown', async () => {
  await storage.create('mcp-logs', { tool: 'get_health_schemas', success: true, clientId: 'vps-health-bridge' });
  await new Promise((r) => setTimeout(r, 5));
  await storage.create('mcp-logs', { tool: 'apply_health_change', success: false, clientId: 'vps-health-bridge', error: 'x' });
  const later = Date.now() + 8 * 86_400_000;
  const evidence = await capabilityEvidence(later);
  expect(evidence.orion.state).toBe('stale');
  expect(evidence.orion.lastFailure).toMatchObject({ tool: 'apply_health_change' });
  process.env.MCP_API_KEYS = '';
  expect((await capabilityEvidence()).orion).toMatchObject({ state: 'unknown', credentials: [] });
});

test('the evidence endpoint is owner-only and the sheet shows it only for Órion and Sirius', async ({ page, playwright, baseURL }) => {
  const stranger = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  expect((await stranger.get('/api/hermes/office/capabilities')).status()).toBe(401);
  await stranger.dispose();
  await page.request.post('/api/login', { data: { user: 'office-test', password: 'office-ui-test-only' } });
  await page.context().addCookies((await page.request.storageState()).cookies);
  const at = new Date().toISOString();
  await page.route('**/api/hermes/office/capabilities', (route) => route.fulfill({ json: {
    orion: { domain: 'health', state: 'verified', credentials: [{ id: 'vps-health-bridge', scopes: ['health:read'] }], lastCall: { keyId: 'vps-health-bridge', tool: 'get_health_capabilities', at }, lastFailure: null, lastApplied: null, logWindow: 12 },
    sirius: { domain: 'professional', state: 'unknown', credentials: [], lastCall: null, lastFailure: null, lastApplied: null, logWindow: 12 },
  } }));
  await page.goto('/escritorio');
  await page.getByRole('button', { name: 'Focalizar Órion', exact: true }).click();
  const proof = page.getByRole('region', { name: 'O que foi comprovado sobre Órion' });
  await expect(proof).toContainText('vps-health-bridge · escopos de saúde');
  await expect(proof).toContainText('get_health_capabilities');
  await expect(proof).toContainText('Operação aprovada por você e aplicadaNenhuma ainda.');
  await page.getByRole('button', { name: 'Focalizar Sirius', exact: true }).click();
  await expect(page.getByRole('region', { name: 'O que foi comprovado sobre Sirius' })).toContainText('Nenhuma configurada neste servidor.');
  await page.getByRole('button', { name: 'Focalizar Hermes', exact: true }).click();
  await expect(page.getByRole('region', { name: /O que foi comprovado/ })).toHaveCount(0);
});
