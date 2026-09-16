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
