import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

test('lista eventos da semana, incluindo dia inteiro, sem alterar a agenda', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'lifesystem-calendar-read-'));
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
    const { exchangeGoogleCode, listGoogleCalendarEvents, getGoogleCalendarConnectionStatus } = await import('../src/lib/google-calendar');
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/token')) return Response.json({ access_token: 'read-token', refresh_token: 'refresh-token', expires_in: 3600 });
      expect(init?.method || 'GET').toBe('GET');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer read-token');
      expect(url.searchParams.get('singleEvents')).toBe('true');
      expect(url.searchParams.get('timeMin')).toBe('2026-09-21T00:00:00.000Z');
      expect(url.searchParams.get('timeMax')).toBe('2026-09-28T00:00:00.000Z');
      if (url.searchParams.get('pageToken') === 'next') return Response.json({ items: [
        { id: 'free-event', summary: 'Lembrete', transparency: 'transparent', start: { dateTime: '2026-09-22T16:00:00-03:00' }, end: { dateTime: '2026-09-22T17:00:00-03:00' } },
      ] });
      return Response.json({ nextPageToken: 'next', items: [
        { id: 'meeting-1', summary: 'Reunião', start: { dateTime: '2026-09-22T14:00:00-03:00' }, end: { dateTime: '2026-09-22T15:00:00-03:00' }, htmlLink: 'https://calendar.google.com/a' },
        { id: 'holiday-1', summary: 'Feriado', start: { date: '2026-09-23' }, end: { date: '2026-09-24' } },
        { id: 'deleted', status: 'cancelled', summary: 'Removido', start: { date: '2026-09-24' }, end: { date: '2026-09-25' } },
      ] });
    };
    expect((await getGoogleCalendarConnectionStatus()).connected).toBe(false);
    await exchangeGoogleCode('oauth-code', 'https://example.com/callback');
    expect((await getGoogleCalendarConnectionStatus()).connected).toBe(true);
    const events = await listGoogleCalendarEvents('2026-09-21T00:00:00.000Z', '2026-09-28T00:00:00.000Z');
    expect(events).toEqual([
      { id: 'meeting-1', title: 'Reunião', start: '2026-09-22T14:00:00-03:00', end: '2026-09-22T15:00:00-03:00', allDay: false, url: 'https://calendar.google.com/a' },
      { id: 'holiday-1', title: 'Feriado', start: '2026-09-23', end: '2026-09-24', allDay: true, url: undefined },
      { id: 'free-event', title: 'Lembrete', start: '2026-09-22T16:00:00-03:00', end: '2026-09-22T17:00:00-03:00', allDay: false, busy: false, url: undefined },
    ]);
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
