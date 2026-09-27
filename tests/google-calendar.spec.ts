import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

test('OAuth token saved by storage can create an event', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'lifesystem-calendar-'));
  const previousFetch = globalThis.fetch;
  const previousEnv = {
    dataDir: process.env.LIFESYSTEM_DATA_DIR,
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    encryptionKey: process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY,
  };
  process.env.LIFESYSTEM_DATA_DIR = dataDir;
  process.env.GOOGLE_CALENDAR_CLIENT_ID = 'test-client';
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'test-secret';
  process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('hex');

  try {
    const { exchangeGoogleCode, createGoogleCalendarEvent } = await import('../src/lib/google-calendar');
    const { storage } = await import('../src/lib/storage');
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith('/token')) return Response.json({ access_token: 'saved-access-token', refresh_token: 'saved-refresh-token', expires_in: 3600 });
      expect(url).toContain('/calendars/primary/events');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer saved-access-token');
      return Response.json({ id: 'google-event-id', htmlLink: 'https://calendar.google.com/event?eid=test' });
    };

    await exchangeGoogleCode('oauth-code', 'https://example.com/callback');
    const records = await storage.getAll<{ id: string }>('google-calendar');
    expect(records).toHaveLength(1);
    const event = await createGoogleCalendarEvent({ title: 'Calendar test', start: '2026-09-16T09:30:00.000Z', end: '2026-09-16T09:35:00.000Z' });
    expect(event.id).toBe('google-event-id');
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries({
      LIFESYSTEM_DATA_DIR: previousEnv.dataDir,
      GOOGLE_CALENDAR_CLIENT_ID: previousEnv.clientId,
      GOOGLE_CALENDAR_CLIENT_SECRET: previousEnv.clientSecret,
      GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY: previousEnv.encryptionKey,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('managed MCP events use a stable event id and refuse to delete foreign events', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'lifesystem-managed-calendar-'));
  const previousFetch = globalThis.fetch;
  const previousEnv = { dataDir: process.env.LIFESYSTEM_DATA_DIR, clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID, clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET, encryptionKey: process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY };
  process.env.LIFESYSTEM_DATA_DIR = dataDir;
  process.env.GOOGLE_CALENDAR_CLIENT_ID = 'test-client';
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'test-secret';
  process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  let remote: Record<string, unknown> | null = null;
  let inserts = 0;
  try {
    const { exchangeGoogleCode, removeManagedMcpCalendarEvent, syncManagedMcpCalendarEvent } = await import('../src/lib/google-calendar');
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith('/token')) return Response.json({ access_token: 'token', refresh_token: 'refresh', expires_in: 3600 });
      const method = init?.method || 'GET';
      if (method === 'GET') return remote ? Response.json(remote) : Response.json({}, { status: 404 });
      if (method === 'POST') { inserts += 1; remote = { ...JSON.parse(String(init?.body)), id: 'mcp-event-1', etag: 'v1', htmlLink: 'https://calendar.google.com/event?eid=mcp' }; return Response.json(remote); }
      if (method === 'DELETE') { remote = null; return new Response(null, { status: 204 }); }
      return Response.json(remote);
    };
    await exchangeGoogleCode('code', 'https://example.com/callback');
    const input = { eventId: 'mcp-event-1', clientId: 'hermes-mcp', title: 'Bloco Hermes', start: '2026-10-01T10:00:00-03:00', end: '2026-10-01T11:00:00-03:00', timeZone: 'America/Sao_Paulo' };
    await syncManagedMcpCalendarEvent(input);
    await syncManagedMcpCalendarEvent(input);
    expect(inserts).toBe(1);
    await removeManagedMcpCalendarEvent(input.eventId, input.clientId);
    expect(remote).toBeNull();
    remote = { id: input.eventId, etag: 'v2', extendedProperties: { private: { lifesystemTaskId: 'task' } } };
    await expect(removeManagedMcpCalendarEvent(input.eventId, input.clientId)).rejects.toThrow('não pertence');
    remote = { id: input.eventId, etag: 'v3', extendedProperties: { private: { lifesystemMcpEventId: input.eventId, lifesystemMcpClientId: 'another-agent' } } };
    await expect(syncManagedMcpCalendarEvent(input)).rejects.toThrow('outra credencial');
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries({ LIFESYSTEM_DATA_DIR: previousEnv.dataDir, GOOGLE_CALENDAR_CLIENT_ID: previousEnv.clientId, GOOGLE_CALENDAR_CLIENT_SECRET: previousEnv.clientSecret, GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY: previousEnv.encryptionKey })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await rm(dataDir, { recursive: true, force: true });
  }
});
