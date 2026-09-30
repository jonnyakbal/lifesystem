import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createLifesystemMcpServer } from '../src/lib/mcp/server';

const healthScopes = ['health:only', 'health:read', 'health:propose', 'health:apply'];
const healthNames = ['get_health_capabilities', 'get_health_schemas', 'get_health_context', 'get_health_daily_brief', 'list_health_observations', 'get_health_summary', 'get_health_receipt', 'propose_health_change', 'apply_health_change', 'record_health_observation', 'correct_health_observation'];
const capabilities = { contractVersion: '1.2', availableTools: healthNames, permissions: ['health:read', 'health:propose', 'health:apply'].map(scope => ({ scope, granted: true })), humanApprovalTool: false, recurringConsent: false, taskCalendarBridge: 'approved-proposals' };
const schemas = { contractVersion: '1.2', observation: { type: 'object' }, context: { type: 'object' }, proposal: { oneOf: ['record', 'correct', 'context', 'task_create', 'task_plan'].map(operation => ({ properties: { operation: { const: operation } } })) }, approvals: 'Authenticated LifeSystem UI only' };

function fixture(names: string[], values: Record<string, unknown> = {}) {
  const server = new McpServer({ name: 'synthetic-smoke-fixture', version: '1.0' });
  if (!names.length) server.registerTool('temporary', { inputSchema: {} }, async () => ({ content: [] })).remove();
  for (const name of names) server.registerTool(name, { inputSchema: {} }, async () => ({ content: [{ type: 'text', text: JSON.stringify(values[name] ?? {}) }] }));
  return server;
}

async function runSmoke(makeServer: () => McpServer, profile = 'health', denyTransport = false) {
  const calls: string[] = [];
  const http = createServer(async (req, res) => {
    if (denyTransport) { res.writeHead(401); res.end('synthetic-private-error-marker'); return; }
    let body = '';
    for await (const chunk of req) body += chunk;
    const parsed = body ? JSON.parse(body) : undefined;
    if (parsed?.method === 'tools/call') calls.push(parsed.params.name);
    const server = makeServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, parsed);
  });
  await new Promise<void>(resolveListen => http.listen(0, '127.0.0.1', resolveListen));
  const address = http.address();
  if (!address || typeof address === 'string') throw new Error('Fixture sem porta.');
  try {
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>(resolveRun => {
      execFile(process.execPath, [resolve('scripts/mcp-smoke.mjs')], { env: { ...process.env, MCP_URL: `http://127.0.0.1:${address.port}/mcp`, MCP_API_KEY: 'synthetic-smoke-token', MCP_SMOKE_PROFILE: profile }, timeout: 20000 }, (error, stdout, stderr) => resolveRun({ code: error ? Number((error as { code?: number }).code) || 1 : 0, stdout, stderr }));
    });
    return { ...result, calls };
  } finally {
    http.closeAllConnections();
    await new Promise<void>(resolveClose => http.close(() => resolveClose()));
  }
}

test('smoke health validates the actual 1.2 contract with discovery calls only', async () => {
  const result = await runSmoke(() => createLifesystemMcpServer(healthScopes, 'orion-smoke-test'));
  expect(result.code).toBe(0);
  expect(result.stdout).toContain('contrato saúde 1.2');
  expect(result.calls).toEqual(['get_health_capabilities', 'get_health_schemas']);
});

test('empty scoped catalog does not announce a successful smoke', async () => {
  const result = await runSmoke(() => fixture([]), 'auto');
  expect(result.code).toBe(1);
  expect(result.stdout).not.toContain('MCP funcional');
});

test('health profile rejects a legacy catalog before reading personal records', async () => {
  const result = await runSmoke(() => fixture(['list_tasks']));
  expect(result.code).toBe(1);
  expect(result.calls).toEqual([]);
});

test('health profile rejects any tool outside the health catalog', async () => {
  const result = await runSmoke(() => fixture([...healthNames, 'list_tasks'], { get_health_capabilities: capabilities, get_health_schemas: schemas }));
  expect(result.code).toBe(1);
  expect(result.calls).toEqual([]);
});

test('health smoke rejects an older bridge contract', async () => {
  const result = await runSmoke(() => fixture(healthNames, { get_health_capabilities: { ...capabilities, contractVersion: '1.1', taskCalendarBridge: 'not-yet-available' }, get_health_schemas: schemas }));
  expect(result.code).toBe(1);
});

test('health smoke rejects schemas without the task planning operation', async () => {
  const result = await runSmoke(() => fixture(healthNames, { get_health_capabilities: capabilities, get_health_schemas: { ...schemas, proposal: { oneOf: schemas.proposal.oneOf.slice(0, 4) } } }));
  expect(result.code).toBe(1);
});

test('remote error bodies never reach smoke logs', async () => {
  const result = await runSmoke(() => fixture([]), 'auto', true);
  expect(result.code).toBe(1);
  expect(result.stdout + result.stderr).not.toContain('synthetic-private-error-marker');
});

test('generic smoke preserves existing read checks', async () => {
  const result = await runSmoke(() => fixture(['list_tasks']), 'auto');
  expect(result.code).toBe(0);
  expect(result.calls).toEqual(['list_tasks']);
});

test('health smoke rejects human approval and missing apply permissions', async () => {
  for (const changed of [{ ...capabilities, humanApprovalTool: true }, { ...capabilities, permissions: capabilities.permissions.slice(0, 2) }]) {
    const result = await runSmoke(() => fixture(healthNames, { get_health_capabilities: changed, get_health_schemas: schemas }));
    expect(result.code).toBe(1);
  }
});
