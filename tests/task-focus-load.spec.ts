import { expect, test, type APIRequestContext } from '@playwright/test';
import type { Task } from '../src/types';

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
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
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

test('Carga agrupa vínculos, soma blocos e sinaliza sobreposição sem incluir concluídas', async ({ page, request }) => {
  const tasks: Task[] = [];
  for (const [title, status, projectId, pillarId] of [['Carga QA · projeto A', 'todo', 'qa-project-a', 'qa-pillar'], ['Carga QA · projeto B', 'todo', 'qa-project-b', 'qa-pillar'], ['Carga QA · concluída', 'done', 'qa-project-a', 'qa-pillar']]) {
    tasks.push(await create(request, title, { status, projectId, pillarId, dueDate: '2027-01-04' }));
  }
  for (const [index, startAt, endAt] of [[0, '2027-01-04T12:00:00Z', '2027-01-04T14:00:00Z'], [1, '2027-01-04T13:00:00Z', '2027-01-04T14:00:00Z']] as const) {
    const response = await request.put(`/api/tasks/${tasks[index].id}/planning`, { data: { date: '2027-01-04', startAt, endAt, timeZone: 'America/Sao_Paulo', syncToGoogle: false } }); expect(response.ok()).toBe(true);
  }
  await page.route('**/api/projects', route => route.fulfill({ json: [{ id: 'qa-project-a', name: 'Projeto QA A' }, { id: 'qa-project-b', name: 'Projeto QA B' }] }));
  await page.route('**/api/pillars', route => route.fulfill({ json: [{ id: 'qa-pillar', name: 'Pilar QA' }] }));
  try {
    await page.goto('/tarefas'); await page.getByPlaceholder('Buscar tarefas...').fill('Carga QA');
    await page.getByRole('button', { name: 'Todas', exact: true }).click();
    await page.getByRole('button', { name: 'Visualização: Carga', exact: true }).click();
    await page.getByLabel('Semana da carga', { exact: true }).fill('2027-01-04');
    await expect(page.getByText('Prazos nesta semana', { exact: true }).locator('..').locator('strong')).toHaveText('2');
    await expect(page.getByText('Horas em blocos', { exact: true }).locator('..').locator('strong')).toHaveText('3h');
    await expect(page.getByText('1 pares de blocos se sobrepõem.', { exact: false })).toBeVisible();
    const groups = page.getByRole('region', { name: 'Carga por vínculo' });
    await groups.getByRole('button', { name: 'Projeto QA A 1', exact: true }).click();
    const details = page.getByRole('region', { name: 'Tarefas da carga selecionada' });
    await expect(details.getByRole('button', { name: tasks[0].title, exact: true })).toBeVisible();
    await expect(details.getByRole('button', { name: tasks[1].title, exact: true })).toHaveCount(0);
    await page.getByLabel('Agrupar carga por').selectOption('pillarId');
    await groups.getByRole('button', { name: 'Pilar QA 2', exact: true }).click();
    await expect(details.getByRole('button', { name: tasks[1].title, exact: true })).toBeVisible();
    await expect(details.getByRole('button', { name: tasks[2].title, exact: true })).toHaveCount(0);
  } finally { for (const item of tasks) await request.delete(`/api/tasks/${item.id}`); }
});

test('Foco e Carga em celular/desktop, claro/escuro sem transbordamento', async ({ page, request }) => {
  test.setTimeout(90000);
  const task = await create(request, 'Visual QA · preparar a próxima entrega', { dueDate: '2027-01-04', description: 'Organize o contexto, revise os materiais e escolha o próximo passo.', checklist: [{ id: 'qa-visual', text: 'Revisar os materiais', done: false }], priority: 'important' });
  await page.route('**/api/tasks', route => route.fulfill({ json: [task] }));
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 }); await page.goto('/tarefas');
      await page.evaluate(t => { document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(t); }, theme);
      for (const view of ['Foco', 'Carga']) {
        await page.getByRole('button', { name: `Visualização: ${view}`, exact: true }).click();
        if (view === 'Carga') await page.getByLabel('Semana da carga', { exact: true }).fill('2027-01-04');
        await expect(page.getByRole('button', { name: task.title, exact: true })).toBeVisible();
        await expect(page.locator(view === 'Foco' ? '.task-focus-view' : '.task-load-view').locator('..')).toHaveCSS('opacity', '1');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
        await page.screenshot({ path: `../lifesystem-task-${view === 'Foco' ? 'focus' : 'load'}-${theme}-${width}.png`, fullPage: true });
      }
    }
    expect(errors).toEqual([]);
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test('Carga navega semanas vazias e permite manipular os prazos do dia', async ({ page, request }) => {
  const task = await create(request, 'Carga sintética datada', { dueDate: '2027-01-04', priority: 'urgent' });
  const backlog = await create(request, 'Carga sintética sem prazo');
  try {
    await page.goto('/tarefas');
    await page.getByPlaceholder('Buscar tarefas...').fill('Carga sintética');
    await expect(page.getByRole('button', { name: 'Visualização: Carga', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Visualização: Carga', exact: true }).click();
    await page.getByLabel('Semana da carga', { exact: true }).fill('2027-01-04');
    await page.getByRole('button', { name: 'Ver carga de 04/01/2027', exact: true }).click();
    const day = page.getByRole('region', { name: 'Tarefas da carga selecionada' });
    await expect(day.getByRole('button', { name: task.title, exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Carga sem prazo' }).getByRole('button', { name: backlog.title, exact: true })).toBeVisible();
    await day.getByRole('button', { name: `Prazo de ${task.title}`, exact: true }).click();
    await page.getByLabel('Novo prazo').fill('2027-01-11');
    await page.getByRole('button', { name: 'Salvar prazo', exact: true }).click();
    await expect(day.getByRole('button', { name: task.title, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Próxima semana da carga', exact: true }).click();
    await page.getByRole('button', { name: 'Ver carga de 11/01/2027', exact: true }).click();
    await expect(day.getByRole('button', { name: task.title, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Semana anterior da carga', exact: true }).click();
    await expect(page.getByText('Nenhuma tarefa com prazo nesta semana.', { exact: true })).toBeVisible();
  } finally { for (const item of [task, backlog]) await request.delete(`/api/tasks/${item.id}`); }
});

test('Semana bloqueia abertura durante remoção de plano e entrega snapshot atualizado antes do GET', async ({ page, request }) => {
  await page.clock.install({ time: new Date('2027-01-04T15:00:00Z') });
  const task = await create(request, 'Snapshot semanal QA', { dueDate: '2027-01-04' });
  const planned = await request.put(`/api/tasks/${task.id}/planning`, { data: { date: '2027-01-04', timeZone: 'America/Sao_Paulo', syncToGoogle: false } }); expect(planned.ok()).toBe(true);
  let releaseDelete!: () => void; const deleting = new Promise<void>(resolve => { releaseDelete = resolve; });
  let releaseRead!: () => void; const reading = new Promise<void>(resolve => { releaseRead = resolve; });
  let holdReads = false;
  await page.route('**/api/tasks', async route => { if (holdReads) await reading; await route.continue(); });
  await page.route(`**/api/tasks/${task.id}/planning`, async route => { if (route.request().method() === 'DELETE') { holdReads = true; await deleting; } await route.continue(); });
  try {
    await page.goto('/tarefas'); await page.getByRole('button', { name: 'Visualização: Semana', exact: true }).click();
    const card = page.getByTestId(`planning-task-${task.id}`);
    await card.getByRole('button', { name: 'Devolver ao planejamento', exact: true }).click();
    await expect(card.getByRole('button', { name: task.title, exact: true })).toBeDisabled();
    releaseDelete(); await expect(card.getByRole('button', { name: 'Planejar', exact: true })).toBeVisible();
    await card.getByRole('button', { name: task.title, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar Tarefa' });
    await expect(dialog.locator('input[type="date"]')).toHaveValue('');
    await dialog.getByPlaceholder('Detalhes, notas, links...').fill('Descrição preserva plano removido');
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
    const saved = await (await request.get(`/api/tasks/${task.id}`)).json();
    expect(saved.dueDate || null).toBeNull(); expect(saved.planning?.date || null).toBeNull();
  } finally { releaseDelete(); releaseRead(); await request.delete(`/api/tasks/${task.id}`); }
});
