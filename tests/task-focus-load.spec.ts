import { expect, test, type APIRequestContext } from '@playwright/test';

async function create(request: APIRequestContext, title: string, extra = {}) {
  const response = await request.post('/api/tasks', { data: { title, status: 'todo', priority: 'normal', ...extra } });
  expect(response.ok()).toBe(true);
  return response.json();
}

test('Foco salva checklist, separa título de conclusão e permite desfazer', async ({ page, request }) => {
  const task = await create(request, 'Foco sintético', { checklist: [{ id: 'qa-focus-step', text: 'Revisar o briefing sintético', done: false }] });
  try {
    await page.goto('/tarefas');
    await page.getByPlaceholder('Buscar tarefas...').fill(task.title);
    await expect(page.getByRole('button', { name: 'Visualização: Foco', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Visualização: Foco', exact: true }).click();
    const focus = page.getByRole('region', { name: 'Tarefa em foco' });
    await focus.getByRole('checkbox', { name: 'Revisar o briefing sintético', exact: true }).click();
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).checklist[0].done).toBe(true);
    await focus.getByRole('button', { name: task.title, exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Editar Tarefa' })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    expect((await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('todo');
    await focus.getByRole('button', { name: 'Concluir tarefa em foco', exact: true }).click();
    await expect(page.getByText('Nenhuma tarefa em aberto nesta seleção.', { exact: true })).toBeVisible();
    await page.locator('[data-sonner-toast]').getByRole('button', { name: 'Desfazer', exact: true }).click();
    await expect(focus.getByRole('button', { name: task.title, exact: true })).toBeVisible();
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test('Foco troca a tarefa sem alterar status e mantém checklist numa falha', async ({ page, request }) => {
  const first = await create(request, 'Fila QA · primeiro');
  const second = await create(request, 'Fila QA · segundo', { checklist: [{ id: 'qa-rejected', text: 'Passo recusado QA', done: false }] });
  await page.route(`**/api/tasks/${second.id}`, route => route.request().method() === 'PATCH' ? route.fulfill({ status: 409, json: { error: 'Checklist recusado QA' } }) : route.continue());
  try {
    await page.goto('/tarefas'); await page.getByPlaceholder('Buscar tarefas...').fill('Fila QA');
    await page.getByRole('button', { name: 'Visualização: Foco', exact: true }).click();
    await page.getByRole('button', { name: `Focar ${second.title}`, exact: true }).click();
    const focus = page.getByRole('region', { name: 'Tarefa em foco' });
    await focus.getByRole('checkbox', { name: 'Passo recusado QA' }).click();
    await expect(page.getByText('Checklist recusado QA', { exact: true })).toBeVisible();
    await expect(focus.getByRole('checkbox', { name: 'Passo recusado QA' })).not.toBeChecked();
    await page.getByRole('button', { name: `Focar ${first.title}`, exact: true }).click();
    await expect(focus.getByRole('button', { name: first.title, exact: true })).toBeVisible();
    for (const item of [first, second]) expect((await (await request.get(`/api/tasks/${item.id}`)).json()).status).toBe('todo');
  } finally { for (const item of [first, second]) await request.delete(`/api/tasks/${item.id}`); }
});

test('Foco em celular/desktop, claro/escuro sem transbordamento', async ({ page, request }) => {
  test.setTimeout(90000);
  const task = await create(request, 'Visual QA · preparar a próxima entrega', { dueDate: '2027-01-04', description: 'Organize o contexto, revise os materiais e escolha o próximo passo.', checklist: [{ id: 'qa-visual', text: 'Revisar os materiais', done: false }], priority: 'important' });
  await page.route('**/api/tasks', route => route.fulfill({ json: [task] }));
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 }); await page.goto('/tarefas');
      await page.evaluate(t => { document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(t); }, theme);
      for (const view of ['Foco']) {
        await page.getByRole('button', { name: `Visualização: ${view}`, exact: true }).click();
        await expect(page.getByRole('button', { name: task.title, exact: true })).toBeVisible();
        await expect(page.locator('.task-focus-view').locator('..')).toHaveCSS('opacity', '1');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
        await page.screenshot({ path: `../lifesystem-task-focus-${theme}-${width}.png`, fullPage: true });
      }
    }
    expect(errors).toEqual([]);
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});
