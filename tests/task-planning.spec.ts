import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../src/lib/storage';
import type { Task } from '../src/types';
import { saveTaskPlanning, removeTaskPlanning, planningSchema, adoptTaskGoogleEvent } from '../src/lib/task-planning';
import { exchangeGoogleCode } from '../src/lib/google-calendar';

test('bloco preserva prazo, sincroniza sem duplicar, protege edição externa e recupera falhas', async () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const dir = await mkdtemp(join(tmpdir(), 'ls-planning-'));
  process.env.LIFESYSTEM_DATA_DIR = dir;
  process.env.GOOGLE_CALENDAR_CLIENT_ID = 'test';
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'test';
  process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
  type RemoteEvent = { id: string; etag: string; htmlLink: string; summary: string; description: string; start: { dateTime: string }; end: { dateTime: string }; extendedProperties: { private: { lifesystemTaskId: string } } };
  let remote: RemoteEvent | null = null;
  let inserts = 0; let patches = 0; let fail = false; let loseAcknowledgement = false;
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/token')) return Response.json({ access_token: 'test', refresh_token: 'test', expires_in: 3600 });
    if (fail) throw new Error('network');
    if (!options?.method || options.method === 'GET') return remote ? Response.json(remote) : Response.json({}, { status: 404 });
    if (options.method === 'POST') {
      inserts++;
      if (remote) return Response.json({}, { status: 409 });
      remote = { ...JSON.parse(String(options.body)), etag: 'v1', htmlLink: 'https://calendar.google.com/event?eid=test' };
      if (loseAcknowledgement) { loseAcknowledgement = false; throw new Error('response lost'); }
    }
    if (options.method === 'PATCH') {
      expect(new Headers(options.headers).get('If-Match')).toBe(remote!.etag);
      patches++; remote = { ...remote, ...JSON.parse(String(options.body)), etag: `v${patches + 1}` };
    }
    if (options.method === 'DELETE') { remote = null; return new Response(null, { status: 204 }); }
    return Response.json(remote);
  };
  try {
    await exchangeGoogleCode('test', 'https://example.com/callback');
    const task = await storage.create<Task>('tasks', { title: 'Foco', dueDate: '2026-10-15', status: 'todo', priority: 'normal', sortOrder: 0, tags: [], checklist: [] });
    const input = { date: '2026-10-01', startAt: '2026-10-01T13:00:00.000Z', endAt: '2026-10-01T13:45:00.000Z', timeZone: 'America/Sao_Paulo', syncToGoogle: true };
    let result = await saveTaskPlanning(task.id, input);
    expect(result.dueDate).toBe('2026-10-15');
    expect(result.planning?.syncState).toBe('synced');
    const id = result.planning?.eventId;
    await expect(storage.delete('tasks', task.id)).rejects.toThrow('Planejar');
    await expect(storage.deleteMany('tasks', [task.id])).rejects.toThrow('Planejar');
    await expect(storage.deleteWhere<{ id: string }>('tasks', item => item.id === task.id)).rejects.toThrow('Planejar');
    await saveTaskPlanning(task.id, input);
    expect(inserts).toBe(1); expect(patches).toBe(0);
    const moved = { ...input, startAt: '2026-10-01T14:00:00.000Z', endAt: '2026-10-01T14:45:00.000Z' };
    result = await saveTaskPlanning(task.id, moved);
    expect(result.planning?.eventId).toBe(id); expect(patches).toBe(1);
    fail = true;
    result = await saveTaskPlanning(task.id, input);
    expect(result.planning?.syncState).toBe('error');
    expect(result.planning?.startAt).toBe(input.startAt);
    fail = false;
    result = await saveTaskPlanning(task.id, input);
    expect(result.planning?.syncState).toBe('synced'); expect(inserts).toBe(1);
    remote!.etag = 'externally-edited'; remote!.summary = 'Editado no Google'; remote!.description = 'Anotações externas a preservar';
    result = await saveTaskPlanning(task.id, moved);
    expect(result.planning?.syncState).toBe('error');
    expect(remote!.summary).toBe('Editado no Google');
    await expect(removeTaskPlanning(task.id, false)).rejects.toThrow();
    await expect(removeTaskPlanning(task.id, true)).rejects.toThrow();
    result = await adoptTaskGoogleEvent(task.id);
    expect(result.title).toBe('Editado no Google');
    await saveTaskPlanning(task.id, moved);
    expect(remote!.description).toBe('Anotações externas a preservar');
    result = await removeTaskPlanning(task.id, true);
    expect(result.planning?.date).toBeNull();
    expect(result.dueDate).toBe('2026-10-15');
    expect(remote).toBeNull();
    loseAcknowledgement = true;
    result = await saveTaskPlanning(task.id, input);
    expect(result.planning?.syncState).toBe('error');
    expect(result.planning?.eventId).not.toBe(id);
    result = await saveTaskPlanning(task.id, moved);
    expect(result.planning?.syncState).toBe('synced');
    const retried = await Promise.all([saveTaskPlanning(task.id, input), saveTaskPlanning(task.id, input)]);
    expect(retried.every(task => task.planning?.syncState === 'synced')).toBe(true);
    expect(inserts).toBe(2);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ['LIFESYSTEM_DATA_DIR', 'GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET', 'GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY']) {
      if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test('planejamento rejeita horário invertido, dia inválido, fuso inválido e espelho sem horário', () => {
  const day = { date: '2026-10-01', timeZone: 'America/Sao_Paulo', syncToGoogle: false };
  expect(planningSchema.safeParse(day).success).toBe(true);
  for (const invalid of [{ ...day, date: '2026-02-30' }, { ...day, timeZone: 'Invalid/Zone' }, { ...day, syncToGoogle: true }, { ...day, startAt: '2026-10-01T15:00:00Z', endAt: '2026-10-01T14:00:00Z' }]) {
    expect(planningSchema.safeParse(invalid).success).toBe(false);
  }
});
