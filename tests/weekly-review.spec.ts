import { expect, test } from '@playwright/test';
import { DEFAULT_STAGES } from '../src/lib/default-stages';

const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString('en-CA'); };

test('API registra a revisão no servidor e recusa prioridades a mais ou repetidas', async ({ request }) => {
  expect((await request.post('/api/weekly-review', { data: { priorities: ['a', 'b', 'c', 'd'] } })).status()).toBe(400);
  expect((await request.post('/api/weekly-review', { data: { priorities: ['a', 'a'] } })).status()).toBe(400);
  const created = await request.post('/api/weekly-review', { data: { priorities: ['sintetica-1'], summary: { clarified: 2 } } });
  expect(created.status()).toBe(201);
  const latest = await (await request.get('/api/weekly-review')).json();
  expect(latest.id).toBe((await created.json()).id);
  expect(latest.priorities).toEqual(['sintetica-1']);
});

test('captura sem texto não derruba a API nem a Caixa', async ({ page, request }) => {
  const capture = await (await request.post('/api/captures', { data: { type: 'link', url: 'https://example.com/sintetico' } })).json();
  try {
    expect(capture.content).toBe('');
    await page.goto('/inbox');
    await expect(page.getByRole('region', { name: 'Esclarecer captura' })).toBeVisible();
    await expect(page.getByText('Algo deu errado')).toHaveCount(0);
  } finally {
    await request.delete(`/api/captures/${capture.id}`);
  }
});

test('revisão: captura legada sem texto, passo vazio pulado e prioridades da semana registradas', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await page.route('**/api/stage-configs/tasks', route => route.fulfill({ json: { stages: DEFAULT_STAGES.tasks } }));
  await page.route('**/api/captures', route => route.fulfill({ json: [{ id: 'legacy', status: 'inbox', type: 'link', createdAt: '2026-11-01T12:00:00Z' }] }));
  await page.route('**/api/tasks', route => route.fulfill({ json: [
    { id: 'late', title: 'Atrasada sintética', status: 'todo', priority: 'urgent', dueDate: day(-3) },
    { id: 'week', title: 'Prioridade sintética', status: 'todo', priority: 'important', dueDate: day(2) },
  ] }));
  let posted: unknown = null;
  await page.route('**/api/weekly-review', route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: null });
    posted = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { id: 'r1', completedAt: new Date().toISOString(), ...(posted as object) } });
  });

  await page.goto('/revisao');
  await expect(page.getByRole('heading', { name: 'Revisão semanal', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Esclarecer captura' }).getByRole('heading', { name: 'Sem título' })).toBeVisible();
  await expect(page.getByRole('button', { name: '4. Aguardando: nada aqui' })).toBeVisible();

  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Atrasadas' })).toBeVisible();
  await expect(page.getByText('há 3 d', { exact: true })).toBeVisible();
  // Projetos, Aguardando e Backlog estão vazios: o próximo passo é Direção.
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Áreas e rumo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Visão 5 anos' })).toBeVisible();
  await expect(page.getByText('vision_5y')).toHaveCount(0);

  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  const choices = page.getByRole('list', { name: 'Prioridades da semana' });
  await choices.getByRole('button', { name: /Prioridade sintética/ }).click();
  await expect(choices.getByRole('button', { name: /Prioridade sintética/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Concluir revisão', exact: true }).click();
  await expect(page.getByText('Revisão concluída!', { exact: true })).toBeVisible();
  expect(posted).toMatchObject({ priorities: ['week'] });
  await expect(page.getByRole('link', { name: 'Planejar a semana' })).toHaveAttribute('href', '/planejar');
});

test('atalho nas atrasadas: A manda a tarefa para amanhã', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await page.route('**/api/stage-configs/tasks', route => route.fulfill({ json: { stages: DEFAULT_STAGES.tasks } }));
  await page.route('**/api/weekly-review', route => route.fulfill({ json: null }));
  await page.route('**/api/tasks', route => route.fulfill({ json: [{ id: 'late', title: 'Atrasada sintética', status: 'todo', priority: 'normal', dueDate: day(-1) }] }));
  let patched: unknown = null;
  await page.route('**/api/tasks/late', route => { patched = route.request().postDataJSON(); return route.fulfill({ json: { id: 'late' } }); });
  await page.goto('/revisao');
  await page.getByRole('listitem', { name: 'Atrasada sintética' }).focus();
  await page.keyboard.press('a');
  await expect.poll(() => patched).toEqual({ dueDate: day(1) });
});
