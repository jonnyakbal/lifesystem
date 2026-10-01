import { test, expect } from '@playwright/test';
import { planningClockParts, planningStartAt, planningTimeZone } from '../src/lib/task-planning-timezone';

test('new planning uses the preference while an existing timed block keeps its own timezone', () => {
  expect(planningTimeZone({ preferredTimeZone: 'Asia/Tokyo' })).toBe('Asia/Tokyo');
  expect(planningTimeZone({ previousStartAt: '2026-11-01T06:30:00Z', previousTimeZone: 'America/New_York', preferredTimeZone: 'America/Sao_Paulo' })).toBe('America/New_York');
  expect(planningTimeZone({ previousTimeZone: 'America/New_York', preferredTimeZone: 'Asia/Tokyo' })).toBe('Asia/Tokyo');
});

test('planning converts local clocks in the selected timezone across the year boundary', () => {
  expect(planningStartAt('2026-12-31', '23:30', 'America/Sao_Paulo')).toBe('2027-01-01T02:30:00.000Z');
  expect(planningStartAt('2027-01-01', '00:30', 'Asia/Tokyo')).toBe('2026-12-31T15:30:00.000Z');
  expect(planningClockParts('2026-12-31T15:30:00Z', 'Asia/Tokyo')).toEqual({ date: '2027-01-01', time: '00:30' });
});

test('planning preserves the original instant when reopening the second DST hour', () => {
  expect(planningStartAt('2026-11-01', '01:30', 'America/New_York', '2026-11-01T06:30:00.000Z')).toBe('2026-11-01T06:30:00.000Z');
  expect(planningClockParts('2026-11-01T06:30:00Z', 'America/New_York')).toEqual({ date: '2026-11-01', time: '01:30' });
  expect(planningStartAt('2026-11-01', '01:30', 'America/New_York')).toBe('2026-11-01T05:30:00.000Z');
});

test('planning rejects a nonexistent local time during spring DST', () => {
  expect(() => planningStartAt('2026-03-08', '02:30', 'America/New_York')).toThrow(/não existe/i);
  expect(planningStartAt('2026-03-08', '03:30', 'America/New_York')).toBe('2026-03-08T07:30:00.000Z');
});

test('planning does not retain the old instant when moving the clock or day', () => {
  expect(planningStartAt('2026-11-01', '02:30', 'America/New_York', '2026-11-01T06:30:00Z')).toBe('2026-11-01T07:30:00.000Z');
  expect(planningStartAt('2026-11-02', '01:30', 'America/New_York', '2026-11-01T06:30:00Z')).toBe('2026-11-02T06:30:00.000Z');
});

test('planning validates civil dates, clocks, zones and supports fractional offsets', () => {
  for (const [day, time, zone] of [
    ['2027-02-29', '09:00', 'UTC'], ['2026-01-01', '24:00', 'UTC'],
    ['2026-01-01', '9:00', 'UTC'], ['2026-01-01', '09:00', 'Invalid/Zone'],
  ]) expect(() => planningStartAt(day, time, zone)).toThrow();
  expect(planningStartAt('2026-10-01', '08:45', 'Asia/Kathmandu')).toBe('2026-10-01T03:00:00.000Z');
});
