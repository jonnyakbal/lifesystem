import { test, expect } from '@playwright/test';
import { projectAgenda } from '../src/lib/agenda/projection';

const tz = 'America/Sao_Paulo';
const at = '2026-10-01T10:00:00.000Z';
const tasks = [
  { id: 't1', title: 'Dia sem horário', dueDate: '2026-10-05', updatedAt: at },
  { id: 't2', title: 'Bloco reservado', dueDate: '2026-10-06', updatedAt: at, planning: { date: '2026-10-06', startAt: '2026-10-06T09:00:00-03:00', endAt: '2026-10-06T10:30:00-03:00', timeZone: tz } },
  { id: 't3', title: 'Concluída', dueDate: '2026-10-05', updatedAt: at, completedAt: at },
  { id: 't4', title: 'Fora da semana', dueDate: '2026-11-01', updatedAt: at },
];
const content = [
  { id: 'c1', title: 'Post com hora', status: 'draft', scheduledDate: '2026-10-07', scheduledTime: '18:30', updatedAt: at },
  { id: 'c2', title: 'Post sem hora', status: 'draft', scheduledDate: '2026-10-07', updatedAt: at },
  { id: 'c3', title: 'Arquivado', status: 'archived', scheduledDate: '2026-10-07', updatedAt: at },
  { id: 'c4', title: 'Data impossível', status: 'draft', scheduledDate: '2026-02-30', updatedAt: at },
];
const financial = [
  { id: 'f1', category: 'Moradia', description: 'Aluguel', status: 'pending', date: '2026-10-01', dueDate: '2026-10-08', updatedAt: at },
  { id: 'f2', category: 'Serviços', description: 'Internet', status: 'pending', date: '2026-10-09', dueDate: null, updatedAt: at },
  { id: 'f3', category: 'Saúde', description: 'Consulta', status: 'paid', date: '2026-10-02', dueDate: '2026-10-08', paidDate: '2026-10-05', updatedAt: at },
];
const week = { from: '2026-10-05', to: '2026-10-11', timeZone: tz, tasks, content, financial };

test('tasks project as a legacy primary block or a day, completed and out-of-range skipped', () => {
  const items = projectAgenda(week).filter((i) => i.entity.type === 'task');
  expect(items.map((i) => [i.id, i.kind, i.busy])).toEqual([
    ['task-day:t1', 'task_day', false],
    ['legacy-task-block:t2', 'task_block', true],
  ]);
  expect(items[1].time).toEqual({ kind: 'interval', startAt: '2026-10-06T09:00:00-03:00', endAt: '2026-10-06T10:30:00-03:00', timeZone: tz });
});

test('content keeps its day, gets no invented duration and hides archived or invalid dates', () => {
  const items = projectAgenda(week).filter((i) => i.entity.type === 'content');
  expect(items.map((i) => i.id).sort()).toEqual(['content_publication:c1', 'content_publication:c2']);
  const timed = items.find((i) => i.id === 'content_publication:c1')!;
  expect(timed).toMatchObject({ busy: false, confidence: 'fallback', time: { kind: 'point', at: '2026-10-07T18:30' } });
  expect(items.find((i) => i.id === 'content_publication:c2')!.time).toEqual({ kind: 'day', date: '2026-10-07', timeZone: tz });
});

test('finance follows the effective-date rule, labels the fallback and never shows an entry twice', () => {
  const due = projectAgenda(week).filter((i) => i.entity.type === 'financial');
  expect(due.map((i) => [i.id, i.day, i.confidence])).toEqual([
    ['financial_due:f1', '2026-10-08', 'explicit'],
    ['financial_due:f2', '2026-10-09', 'fallback'],
  ]);
  const withPaid = projectAgenda({ ...week, filters: { includePaid: true } }).filter((i) => i.entity.id === 'f3');
  expect(withPaid).toEqual([expect.objectContaining({ id: 'financial_paid:f3', day: '2026-10-05', busy: false })]);
  expect(due.every((i) => !i.busy)).toBe(true);
});

test('filters remove a source without touching the others, and inputs are not mutated', () => {
  const snapshot = JSON.stringify(week);
  const onlyTasks = projectAgenda({ ...week, filters: { content: false, financial: false } });
  expect(new Set(onlyTasks.map((i) => i.entity.type))).toEqual(new Set(['task']));
  expect(JSON.stringify(week)).toBe(snapshot);
});

test('Planejar shows reminder filters and a labelled bill without an explicit due date', async ({ page }) => {
  await page.request.post('/api/login', { data: { user: 'office-test', password: 'office-ui-test-only' } });
  await page.context().addCookies((await page.request.storageState()).cookies);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  await page.route('**/api/financial', (route) => route.request().method() === 'GET'
    ? route.fulfill({ json: [{ id: 'fx', type: 'expense_fixed', category: 'Serviços', description: 'Conta sem vencimento', amount: 10, status: 'pending', date: today, dueDate: null, createdAt: today, updatedAt: today }] })
    : route.continue());
  await page.goto('/planejar');
  const filters = page.getByRole('group', { name: 'Lembretes na semana' });
  await expect(filters).toBeVisible();
  await expect(page.getByText('Conta sem vencimento').first()).toBeVisible();
  await expect(page.getByText('· sem vencimento, pela data do lançamento').first()).toBeVisible();
  await filters.getByRole('button', { name: 'Contas' }).click();
  await expect(filters.getByRole('button', { name: 'Contas' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('Conta sem vencimento')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('group', { name: 'Lembretes na semana' }).getByRole('button', { name: 'Contas' })).toHaveAttribute('aria-pressed', 'false');
});
