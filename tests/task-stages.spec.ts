import { expect, test } from '@playwright/test';
import { isTaskCompleted, resolveTaskStages, taskCompletionStatus, taskReopenStatus } from '../src/lib/task-stages';

test('historical completion is per record and independent of order', () => {
  const configured = [{ id: 'active', label: 'Em aberto', color: '', dot: '' }];
  const open = { status: 'old-finished' };
  const done = { status: 'old-finished', completedAt: '2026-09-30T12:00:00Z' };
  for (const tasks of [[open, done], [done, open]]) {
    const stages = resolveTaskStages(configured, tasks);
    expect(isTaskCompleted(open, stages)).toBe(false);
    expect(isTaskCompleted(done, stages)).toBe(true);
    expect(taskCompletionStatus(stages)).toBe('done');
    expect(taskReopenStatus(stages)).toBe('active');
  }
});

test('configured terminal stage governs transitions and old done remains discoverable', () => {
  const stages = resolveTaskStages([
    { id: 'queued', label: 'Fila', color: '', dot: '' },
    { id: 'finished', label: 'Feito', color: '', dot: '', isTerminal: true },
  ], [{ status: 'done' }]);
  expect(taskCompletionStatus(stages)).toBe('finished');
  expect(taskReopenStatus(stages)).toBe('queued');
  expect(isTaskCompleted({ status: 'done' }, stages)).toBe(true);
  expect(isTaskCompleted({ status: 'finished' }, stages)).toBe(true);
});
