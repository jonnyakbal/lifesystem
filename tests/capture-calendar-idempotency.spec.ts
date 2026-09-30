import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../src/lib/storage';
import { convertCapture } from '../src/lib/capture-conversion';
import { exchangeGoogleCode } from '../src/lib/google-calendar';

test('timeout após criar evento de captura recupera o mesmo ID sem inserir novamente', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-capture-calendar-'));
  const keys = ['LIFESYSTEM_DATA_DIR', 'GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET', 'GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY'] as const;
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]])); const oldFetch = globalThis.fetch;
  process.env.LIFESYSTEM_DATA_DIR = dir; process.env.GOOGLE_CALENDAR_CLIENT_ID = 'synthetic'; process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'synthetic'; process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY = 'c'.repeat(64);
  let event: Record<string, unknown> | undefined, inserts = 0;
  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).endsWith('/token')) return Response.json({ access_token: 'synthetic', refresh_token: 'synthetic', expires_in: 3600 });
      if (options?.method === 'POST') { inserts++; event = JSON.parse(String(options.body)); event!.htmlLink = 'https://example.test/calendar'; if (inserts === 1) throw new Error('ack lost'); return Response.json(event); }
      return event ? Response.json(event) : Response.json({}, { status: 404 });
    };
    await exchangeGoogleCode('synthetic', 'https://example.test/callback');
    const capture = await storage.create('captures', { title: 'Evento sintético', content: 'Teste local', status: 'inbox' });
    const input = { targetType: 'event' as const, event: { start: '2030-01-01T10:00:00-03:00', end: '2030-01-01T11:00:00-03:00' } };
    await expect(convertCapture(capture.id, input)).rejects.toThrow();
    const recovered = await convertCapture(capture.id, input);
    expect(inserts).toBe(1); expect(recovered.id).toBe(event!.id);
    expect(await convertCapture(capture.id, input)).toEqual(recovered);
    expect(inserts).toBe(1);
  } finally { globalThis.fetch = oldFetch; for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } await rm(dir, { recursive: true, force: true }); }
});
