import { expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { DELETE } from '../src/app/api/tasks/[id]/route';
import { storage } from '../src/lib/storage';
import { exchangeGoogleCode } from '../src/lib/google-calendar';
import type { Task } from '../src/types';

for (const scenario of ['confirmed', 'unconfirmed', 'network-failure', 'external-change', 'already-removed'] as const) {
  test(`excluir tarefa espelhada: ${scenario}`, async () => {
    const keys = ['LIFESYSTEM_DATA_DIR', 'GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET', 'GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY'] as const;
    const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    const originalFetch = globalThis.fetch;
    const dir = await mkdtemp(join(tmpdir(), 'ls-delete-planned-'));
    process.env.LIFESYSTEM_DATA_DIR = dir;
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'synthetic';
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'synthetic';
    process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY = 'b'.repeat(64);
    let remoteExists = scenario !== 'already-removed';
    try {
      const task = await storage.create<Task>('tasks', { title: 'Tarefa sintética', status: 'todo', priority: 'normal', tags: [], checklist: [], sortOrder: 0,
        dueDate: '2026-10-01', planning: { date: '2026-10-01', timeZone: 'America/Sao_Paulo', syncToGoogle: true, syncState: 'synced', eventId: 'testevent', etag: 'v1' } });
      globalThis.fetch = async (url, options) => {
        if (String(url).endsWith('/token')) return Response.json({ access_token: 'synthetic', refresh_token: 'synthetic', expires_in: 3600 });
        if (scenario === 'network-failure') throw new Error('network');
        if (!remoteExists) return Response.json({}, { status: 404 });
        if (options?.method === 'DELETE') { remoteExists = false; return new Response(null, { status: 204 }); }
        return Response.json({ id: 'testevent', etag: scenario === 'external-change' ? 'v2' : 'v1', extendedProperties: { private: { lifesystemTaskId: task.id } } });
      };
      await exchangeGoogleCode('synthetic', 'https://example.com/callback');
      const response = await DELETE(new NextRequest(`https://example.com/api/tasks/${task.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ removeGoogleEvent: scenario !== 'unconfirmed' }) }), { params: Promise.resolve({ id: task.id }) });
      const success = scenario === 'confirmed' || scenario === 'already-removed';
      expect(response.status).toBe(success ? 200 : 409);
      const remaining = await storage.getById<Task>('tasks', task.id);
      if (success) { expect(remaining).toBeNull(); expect(remoteExists).toBe(false); }
      else { expect(remaining?.planning?.eventId).toBe('testevent'); expect(remoteExists).toBe(true); }
    } finally {
      globalThis.fetch = originalFetch;
      for (const key of keys) { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; }
      await rm(dir, { recursive: true, force: true });
    }
  });
}
