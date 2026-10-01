import { test, expect } from '@playwright/test';
import { freeIntervals, minutesOnDay } from '../src/lib/planning-availability';
import { DEFAULT_PLANNING_PREFERENCES, planningPreferencesSchema, workWindowOnDay } from '../src/lib/planning-preferences';
import { GET, PUT } from '../src/app/api/planning-preferences/route';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('availability minutes use the configured timezone across the year boundary', () => {
  expect(minutesOnDay('2027-01-01T01:30:00Z', '2026-12-31', 'America/Sao_Paulo')).toBe(1350);
  expect(minutesOnDay('2027-01-01T01:30:00Z', '2027-01-01', 'America/Sao_Paulo')).toBe(0);
  expect(minutesOnDay('2026-12-31T23:30:00Z', '2027-01-01', 'Asia/Tokyo')).toBe(510);
});

test('working windows preserve default hours and respect ISO weekdays across years', () => {
  expect(workWindowOnDay('2026-12-31', DEFAULT_PLANNING_PREFERENCES)).toEqual({ start: 480, end: 1200 });
  const preferences = { ...DEFAULT_PLANNING_PREFERENCES, workStart: '09:30', workEnd: '17:15', workingDays: [1, 2, 3, 4, 5] };
  expect(workWindowOnDay('2027-01-01', preferences)).toEqual({ start: 570, end: 1035 });
  expect(workWindowOnDay('2027-01-02', preferences)).toBeNull();
  expect(workWindowOnDay('2027-01-04', preferences)).toEqual({ start: 570, end: 1035 });
  expect(() => workWindowOnDay('2027-02-29', preferences)).toThrow(/dia inválido/i);
  expect(workWindowOnDay('2028-02-29', preferences)).toEqual({ start: 570, end: 1035 });
});

test('preferences reject invalid hours, timezone and working days', () => {
  for (const patch of [
    { workStart: '24:00' }, { workStart: '8:00' }, { workEnd: '08:00' }, { workEnd: '07:59' },
    { workStart: '20:00', workEnd: '08:00' }, { timeZone: 'Invalid/Somewhere' },
    { timeZone: '+03:00' }, { workingDays: [] }, { workingDays: [0] }, { workingDays: [8] },
    { workingDays: [1, 1] }, { workingDays: [1.5] }, { workingDays: ['1'] }, { surprise: true },
  ]) expect(planningPreferencesSchema.safeParse({ ...DEFAULT_PLANNING_PREFERENCES, ...patch }).success).toBe(false);
  expect(planningPreferencesSchema.parse({ workStart: '00:00', workEnd: '23:59', workingDays: [7], timeZone: 'Asia/Tokyo' })).toEqual({ workStart: '00:00', workEnd: '23:59', workingDays: [7], timeZone: 'Asia/Tokyo' });
});

test('custom daily capacity subtracts overlapping appointments once and clips outside hours', () => {
  const window = workWindowOnDay('2026-10-01', { ...DEFAULT_PLANNING_PREFERENCES, workStart: '09:00', workEnd: '17:00' })!;
  expect(freeIntervals([{ start: 480, end: 600 }, { start: 720, end: 780 }, { start: 750, end: 840 }], window.start, window.end))
    .toEqual([{ start: 600, end: 720 }, { start: 840, end: 1020 }]);
});

test('configured timezone handles fractional offsets and midnight without a 24:00 hour', () => {
  expect(minutesOnDay('2026-10-01T03:00:00Z', '2026-10-01', 'Asia/Kathmandu')).toBe(525);
  expect(minutesOnDay('2026-10-01T03:00:00Z', '2026-10-01', 'America/Sao_Paulo')).toBe(0);
  expect(minutesOnDay('not-a-date', '2026-10-01', 'America/Sao_Paulo')).toBeNaN();
});

test('preferences API returns defaults, persists valid preferences and refuses invalid writes', async () => {
  const old = process.env.LIFESYSTEM_DATA_DIR;
  const dir = await mkdtemp(join(tmpdir(), 'ls-planning-capacity-'));
  process.env.LIFESYSTEM_DATA_DIR = dir;
  const put = (value: unknown) => PUT(new Request('http://localhost/api/planning-preferences', { method: 'PUT', body: JSON.stringify(value), headers: { 'Content-Type': 'application/json' } }));
  try {
    expect(await (await GET()).json()).toEqual(DEFAULT_PLANNING_PREFERENCES);
    const preferences = { workStart: '09:00', workEnd: '18:00', workingDays: [1, 2, 3, 4, 5], timeZone: 'America/Sao_Paulo' };
    expect((await put(preferences)).status).toBe(200);
    expect(await (await GET()).json()).toEqual(preferences);
    expect((await put({ ...preferences, workEnd: '08:00' })).status).toBe(400);
    expect((await PUT(new Request('http://localhost/api/planning-preferences', { method: 'PUT', body: '{' }))).status).toBe(400);
    expect(await (await GET()).json()).toEqual(preferences);
  } finally {
    if (old === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = old;
    await rm(dir, { recursive: true, force: true });
  }
});

test('availability clips events to the configured local day', () => {
  expect(minutesOnDay('2026-10-01T02:00:00Z', '2026-10-01', 'America/Sao_Paulo')).toBe(0);
  expect(minutesOnDay('2026-10-02T03:00:00Z', '2026-10-01', 'America/Sao_Paulo')).toBe(1440);
});
