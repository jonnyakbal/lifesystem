import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/mcp/route';
import { getWeekAvailability } from '../src/lib/week-availability';
import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../src/lib/storage';
import { runMcpIdempotent } from '../src/lib/mcp/receipts';
import { canUseMcpTool } from '../src/lib/mcp/auth';

test('novas consultas requerem escopos explícitos e de origem', () => {
  expect(canUseMcpTool('get_week_availability', ['*'])).toBe(false);
  expect(canUseMcpTool('get_week_availability', ['agenda:read', 'tasks:read'])).toBe(false);
  expect(canUseMcpTool('get_week_availability', ['agenda:read', 'tasks:read', 'calendar:read'])).toBe(true);
  expect(canUseMcpTool('prepare_weekly_review', ['weekly_review:read', 'tasks:read', 'captures:read', 'projects:read'])).toBe(true);
  expect(canUseMcpTool('prepare_weekly_review', ['weekly_review:read'])).toBe(false);
  expect(canUseMcpTool('get_note', ['notes:read'])).toBe(true);
  expect(canUseMcpTool('list_vision_documents', ['vision:read'])).toBe(true);
});

test('a intenção sobrevive a erro de recibo e rejeita campos diferentes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-mcp-intent-'));
  const previous = process.env.LIFESYSTEM_DATA_DIR;
  process.env.LIFESYSTEM_DATA_DIR = dir;
  const create = storage.create;
  let calls = 0;
  const action = async () => { calls++; return { id: 'synthetic' }; };
  const run = (input: Record<string, unknown>) => runMcpIdempotent('scoped-test', 'create_financial_entry', 'synthetic-intent', action, input);
  try {
    storage.create = (...args) => {
      if (args[0] === 'mcp-receipts') throw new Error('synthetic receipt failure');
      return create(...args);
    };
    await expect(run({ amount: 12, category: 'Teste' })).rejects.toThrow('synthetic receipt failure');
    storage.create = create;
    await expect(run({ amount: 20, category: 'Teste' })).rejects.toThrow('dados diferentes');
    await expect(run({ category: 'Teste', amount: 12 })).resolves.toMatchObject({ result: { id: 'synthetic' } });
    await expect(run({ amount: 12, category: 'Teste' })).resolves.toMatchObject({ replayed: true });
    expect(calls).toBe(2);
  } finally {
    storage.create = create;
    if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR;
    else process.env.LIFESYSTEM_DATA_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test.describe('consultas pessoais do MCP', () => {
  let directory: string;
  let previous: string | undefined;

  test.beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ls-personal-mcp-'));
    previous = process.env.LIFESYSTEM_DATA_DIR;
    process.env.LIFESYSTEM_DATA_DIR = directory;
  });

  test.afterEach(async () => {
    if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR;
    else process.env.LIFESYSTEM_DATA_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  });

  test('agenda combina jornada, tarefas e Google; falha não vira disponibilidade', async () => {
    await storage.createOnce('planning_preferences', 'default', {
      preferences: { workStart: '09:00', workEnd: '13:00', workingDays: [1, 2], timeZone: 'America/Sao_Paulo' },
    });
    await storage.create('tasks', {
      status: 'todo',
      planning: { startAt: '2030-01-07T09:30:00-03:00', endAt: '2030-01-07T10:30:00-03:00' },
    });
    const result = await getWeekAvailability('2030-01-09', 30, async () => [
      { id: 'busy', title: 'synthetic', start: '2030-01-07T10:00:00-03:00', end: '2030-01-07T11:00:00-03:00', allDay: false },
      { id: 'free', title: 'synthetic', start: '2030-01-07T11:00:00-03:00', end: '2030-01-07T12:00:00-03:00', allDay: false, busy: false },
      { id: 'all-day', title: 'synthetic', start: '2030-01-08', end: '2030-01-09', allDay: true },
    ]);
    expect(result.calendarStatus).toBe('verified');
    expect(result.days[0].freeWindows).toEqual([{ start: '09:00', end: '09:30' }, { start: '11:00', end: '13:00' }]);
    expect(result.days[1].freeWindows).toEqual([]);
    expect(result.days[2].workWindow).toBeNull();
    const failed = await getWeekAvailability('2030-01-09', 30, async () => { throw new Error('offline'); });
    expect(failed.calendarStatus).toBe('unavailable');
    expect(failed.days[0].freeWindows).toBeNull();
  });

  test('a rota HTTP autentica, anuncia anotações e consulta sem gravar revisão', async () => {
    const previousKeys = process.env.MCP_API_KEYS;
    const key = 'synthetic-personal-mcp-test-only-0123456789';
    const scopes = ['agenda:read', 'tasks:read', 'calendar:read', 'weekly_review:read', 'captures:read', 'projects:read', 'notes:read', 'vision:read'];
    process.env.MCP_API_KEYS = JSON.stringify([{ id: 'personal-http-test', key, scopes }]);

    // Local listener exposes the production route handler, with isolated storage.
    const server = createServer(async (request, response) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (url.pathname !== '/api/mcp' || request.method !== 'POST') {
          response.writeHead(405).end();
          return;
        }
        const input = new NextRequest(url, { method: 'POST', headers: request.headers as Record<string, string>, body: Buffer.concat(chunks).toString() });
        const output = await POST(input);
        response.writeHead(output.status, Object.fromEntries(output.headers));
        response.end(await output.text());
      } catch {
        response.writeHead(500).end();
      }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = new URL('/api/mcp', 'http://127.0.0.1:' + (server.address() as AddressInfo).port);
    const client = new Client({ name: 'personal-http-test', version: '1' });
    try {
      expect((await fetch(url, { method: 'POST', body: '{}' })).status).toBe(401);
      await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: 'Bearer ' + key } } }));
      const { tools } = await client.listTools();
      for (const name of ['get_week_availability', 'get_weekly_review', 'prepare_weekly_review', 'list_notes', 'get_note', 'list_wiki_collections', 'list_vision_documents', 'list_tasks', 'list_calendar_events']) {
        expect(tools.find(tool => tool.name === name)?.annotations?.readOnlyHint).toBe(true);
      }
      expect(tools.some(tool => /^(delete|create|save|update)_/.test(tool.name))).toBe(false);

      const note = await storage.create('captures', { status: 'noted', category: 'wiki', content: '<h2>Plano sintético</h2><p>Teste &amp; contexto</p>' });
      const inbox = await storage.create('captures', { status: 'inbox', content: 'Plano sintético privado no Inbox' });
      await storage.create('vision', { section: 'identity', title: 'Visão sintética', content: 'Contexto privado sintético', sortOrder: 0 });
      await storage.createOnce('wiki-collections', 'wiki', { name: 'Wiki sintética', sortOrder: 0 });

      const call = async (name: string, args: Record<string, unknown> = {}) => {
        const reply = await client.callTool({ name, arguments: args });
        expect(reply.isError).toBeFalsy();
        return JSON.parse((reply.content as { text: string }[])[0].text);
      };
      expect((await call('list_notes', { collectionId: 'wiki', query: 'plano', codeStage: 'captured' })).items).toEqual([expect.objectContaining({ id: note.id })]);
      expect(await call('get_note', { id: inbox.id })).toBeNull();
      expect((await call('get_note', { id: note.id })).content).toContain('Teste & contexto');
      expect((await call('list_wiki_collections')).items[0].id).toBe('wiki');
      expect((await call('list_vision_documents')).items[0]).not.toHaveProperty('content');
      expect((await call('list_vision_documents', { section: 'identity', includeContent: true })).items[0].content).toBe('Contexto privado sintético');
      expect(await call('get_weekly_review')).toEqual({ latest: null, reviewDay: 1 });
      expect(await call('prepare_weekly_review', { through: '2030-01-07' })).toMatchObject({ status: 'draft', inbox: { total: 1 } });
      expect(await storage.getAll('weekly_reviews')).toHaveLength(0);
    } finally {
      await client.close();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      if (previousKeys === undefined) delete process.env.MCP_API_KEYS;
      else process.env.MCP_API_KEYS = previousKeys;
    }
  });
});
