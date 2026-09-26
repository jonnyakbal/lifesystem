import { test, expect } from '@playwright/test';
import { freeIntervals } from '../src/lib/planning-availability';

test('intervalos livres unem sobreposições e recortam os limites do dia', () => {
  expect(freeIntervals([{ start: 7 * 60, end: 10 * 60 }, { start: 9 * 60, end: 11 * 60 }, { start: 19 * 60, end: 22 * 60 }], 480, 1200))
    .toEqual([{ start: 660, end: 1140 }]);
});

test('intervalos contíguos não criam lacunas e entradas inválidas são ignoradas', () => {
  expect(freeIntervals([{ start: 480, end: 600 }, { start: 600, end: 1200 }, { start: NaN, end: 10 }], 480, 1200)).toEqual([]);
  expect(freeIntervals([], 480, 1200)).toEqual([{ start: 480, end: 1200 }]);
});
