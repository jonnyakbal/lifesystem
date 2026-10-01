import { expect, test } from '@playwright/test';
import { calculateWorkload, weekDates, type WorkloadTask } from '../src/lib/task-workload';
const stages = [{ id: 'todo', label: 'A fazer', color: '', dot: '' }, { id: 'finished', label: 'Finalizada', color: '', dot: '', isTerminal: true }];
const task = (id: string, extra: Partial<WorkloadTask> = {}): WorkloadTask => ({ id, status: 'todo', priority: 'normal', ...extra });
const plan = (startAt: string, endAt: string) => ({ date: '2026-12-31', timeZone: 'America/Sao_Paulo', startAt, endAt, syncToGoogle: false, syncState: 'local' as const });

test('carga mantém semana de segunda a domingo na virada do ano', () => {
  expect(weekDates('2027-01-01')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  expect(weekDates('2027-01-03')).toEqual(weekDates('2027-01-01'));
});

test('conflito atravessando domingo é visível na semana seguinte sem duplicar suas horas', () => {
  const result = calculateWorkload([
    task('sunday', { planning: plan('2027-01-04T02:00:00Z', '2027-01-04T04:00:00Z') }),
    task('monday', { planning: plan('2027-01-04T03:30:00Z', '2027-01-04T04:30:00Z') }),
  ], stages, weekDates('2027-01-04'));
  expect(result.overlaps).toBe(1);
  expect(result.hours).toBe(1);
});
test('carga separa sem prazo e outra semana e ignora terminal personalizado', () => {
  const result = calculateWorkload([task('week', { dueDate: '2027-01-01' }), task('next', { dueDate: '2027-01-04' }), task('undated'), task('done', { status: 'finished', dueDate: '2027-01-01' })], stages, weekDates('2027-01-01'));
  expect(result.inWeek.map(item => item.id)).toEqual(['week']);
  expect(result.undated.map(item => item.id)).toEqual(['undated']);
  expect(result.outside.map(item => item.id)).toEqual(['next']);
  expect(calculateWorkload([], stages, weekDates('2027-01-01')).hours).toBe(0);
});
test('horas usam o dia no fuso do bloco, soma explícita e sobreposição, descartando duração inválida', () => {
  const result = calculateWorkload([
    task('a', { planning: plan('2027-01-01T01:00:00Z', '2027-01-01T02:00:00Z') }),
    task('b', { planning: plan('2027-01-01T01:30:00Z', '2027-01-01T02:30:00Z') }),
    task('touch', { planning: plan('2027-01-01T02:30:00Z', '2027-01-01T03:00:00Z') }),
    task('invalid', { planning: plan('2027-01-01T02:00:00Z', '2027-01-01T01:00:00Z') }),
    task('nan', { planning: plan('invalid', 'invalid') }),
    task('done', { status: 'finished', planning: plan('2027-01-01T01:00:00Z', '2027-01-01T02:00:00Z') }),
  ], stages, weekDates('2027-01-01'));
  expect(result.distribution.find(day => day.date === '2026-12-31')).toMatchObject({ blocks: 3, hours: 2.5 });
  expect(result.distribution.find(day => day.date === '2027-01-01')?.hours).toBe(0);
  expect(result.hours).toBe(2.5); expect(result.overlaps).toBe(1);
});
