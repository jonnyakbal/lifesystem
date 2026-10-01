import { expect, test, type APIRequestContext } from '@playwright/test';
import type { Task } from '../src/types';

async function create(request: APIRequestContext, title: string, extra = {}) {
  const response = await request.post('/api/tasks', { data: { title, priority: 'normal', status: 'todo', ...extra } });
  expect(response.ok()).toBe(true); return response.json();
}

test('quadro permite mover e priorizar sem arrastar nem concluir pelo título', async ({ page, request }) => {
  const task = await create(request, 'Cartão manipulável');
  try {
    await page.goto('/tarefas');
    await page.getByRole('button', { name: 'Visualização: Quadro Kanban' }).click();
    await page.getByRole('combobox', { name: `Etapa no quadro de ${task.title}`, exact: true }).selectOption('doing');
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('doing');
    await page.getByRole('combobox', { name: `Prioridade no quadro de ${task.title}`, exact: true }).selectOption('urgent');
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).priority).toBe('urgent');
    await page.getByRole('button', { name: task.title, exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Editar Tarefa' })).toBeVisible();
    expect((await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('doing');
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test('calendário revela todas as tarefas do dia e cria com o prazo escolhido', async ({ page, request }) => {
  const tasks = await Promise.all(Array.from({ length: 5 }, (_, index) => create(request, `Prazo rico ${index}`, { dueDate: '2027-01-12' })));
  try {
    await page.goto('/tarefas');
    await page.getByRole('button', { name: 'Visualização: Calendário' }).click();
    await page.getByLabel('Mês do calendário').fill('2027-01');
    await page.getByRole('button', { name: 'Ver dia 12/01/2027', exact: true }).click();
    const day = page.getByRole('region', { name: 'Detalhes do dia' });
    for (const task of tasks) await expect(day.getByRole('button', { name: task.title, exact: true })).toBeVisible();
    await day.getByRole('button', { name: 'Nova tarefa neste dia' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Título da tarefa', { exact: true }).fill('Criada no calendário');
    await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect.poll(async () => (await (await request.get('/api/tasks')).json()).find((item: { title: string }) => item.title === 'Criada no calendário')?.dueDate).toBe('2027-01-12');
  } finally {
    const all = await (await request.get('/api/tasks')).json();
    for (const item of all.filter((item: { title: string }) => item.title.startsWith('Prazo rico') || item.title === 'Criada no calendário')) await request.delete(`/api/tasks/${item.id}`);
  }
});

test('linha do tempo apresenta prazos e permite editar sem inventar duração', async ({ page, request }) => {
  const task = await create(request, 'Marco em janeiro', { dueDate: '2027-01-12' });
  const undated = await create(request, 'Marco sem prazo');
  try {
    await page.goto('/tarefas');
    await page.getByRole('button', { name: 'Visualização: Linha do tempo' }).click();
    await page.getByLabel('Mês da linha do tempo').fill('2027-01');
    const timeline = page.getByRole('region', { name: 'Linha do tempo de prazos' });
    await expect(timeline.getByRole('button', { name: `Abrir marco ${task.title}`, exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Tarefas sem prazo' }).getByRole('button', { name: undated.title, exact: true })).toBeVisible();
    await timeline.getByRole('button', { name: `Prazo de ${task.title}`, exact: true }).click();
    await page.getByLabel('Novo prazo').fill('2027-02-01');
    await page.getByRole('button', { name: 'Salvar prazo', exact: true }).click();
    await expect(timeline.getByRole('button', { name: `Abrir marco ${task.title}`, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await expect(timeline.getByRole('button', { name: `Abrir marco ${task.title}`, exact: true })).toBeVisible();
    expect((await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('todo');
  } finally { for (const item of [task, undated]) await request.delete(`/api/tasks/${item.id}`); }
});

test('semana abre os detalhes sem reservar horário ou concluir', async ({ page, request }) => {
  const task = await create(request, 'Detalhes na semana');
  try {
    await page.goto('/tarefas');
    await page.getByRole('button', { name: 'Visualização: Semana' }).click();
    await page.getByRole('region', { name: 'Planejamento integrado' }).getByRole('button', { name: task.title, exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Editar Tarefa' })).toBeVisible();
    const saved = await (await request.get(`/api/tasks/${task.id}`)).json();
    expect(saved.status).toBe('todo'); expect(saved.planning).toBeUndefined();
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test('quadro recolhido e troca de visão não mantêm seleção oculta', async ({ page, request }) => {
  const task = await create(request, 'Seleção do quadro');
  try {
    await page.goto('/tarefas');
    await page.getByRole('checkbox', { name: `Selecionar ${task.title}`, exact: true }).check();
    await page.getByRole('button', { name: 'Visualização: Quadro Kanban' }).click();
    await expect(page.getByRole('region', { name: 'Ações das tarefas selecionadas' })).toHaveCount(0);
    await page.locator('details', { hasText: 'Mais opções de organização' }).locator('summary').click();
    await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
    await page.getByRole('button', { name: `Selecionar ${task.title}`, exact: true }).click();
    await page.getByRole('button', { name: 'Recolher coluna A fazer', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Ações das tarefas selecionadas' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: task.title, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Expandir coluna A fazer', exact: true }).click();
    await expect(page.getByRole('button', { name: task.title, exact: true })).toBeVisible();
    expect((await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('todo');
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test('calendário filtra vínculos e protege prazo com bloco reservado', async ({ page, request }) => {
  const task = await create(request, 'Calendário com bloco');
  const planned = await request.put(`/api/tasks/${task.id}/planning`, { data: { date: '2027-01-12', startAt: '2027-01-12T12:00:00.000Z', endAt: '2027-01-12T13:00:00.000Z', timeZone: 'America/Sao_Paulo', syncToGoogle: false } });
  expect(planned.ok(), `Planejamento sintético: HTTP ${planned.status()} ${await planned.text()}`).toBe(true);
  await page.route('**/api/content', route => route.fulfill({ json: [{ id: 'qa-c', title: 'Vínculo de conteúdo QA', scheduledDate: '2027-01-12' }] }));
  await page.route('**/api/financial', route => route.fulfill({ json: [{ id: 'qa-f', description: 'Vínculo previsto QA', category: 'Teste', amount: 10, type: 'expense', dueDate: '2027-01-12', status: 'pending' }, { id: 'qa-paid', description: 'Quitado QA', category: 'Teste', amount: 10, type: 'expense', dueDate: '2027-01-12', status: 'paid' }] }));
  try {
    await page.goto('/tarefas');
    await page.getByRole('button', { name: 'Visualização: Calendário' }).click();
    await page.getByLabel('Mês do calendário').fill('2027-01');
    await page.getByRole('button', { name: 'Ver dia 12/01/2027', exact: true }).click();
    const day = page.getByRole('region', { name: 'Detalhes do dia' });
    await expect(day.getByRole('link', { name: 'Conteúdo · Vínculo de conteúdo QA' })).toBeVisible();
    await expect(day.getByRole('link', { name: 'Em aberto · Vínculo previsto QA' })).toBeVisible();
    await expect(day.getByText('Quitado QA')).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Financeiro em aberto', exact: true }).uncheck();
    await expect(day.getByRole('link', { name: 'Em aberto · Vínculo previsto QA' })).toHaveCount(0);
    await day.getByRole('button', { name: `Prazo de ${task.title}`, exact: true }).click();
    await expect(page.getByRole('link', { name: 'Replanejar bloco' })).toHaveAttribute('href', '/planejar');
    await expect(page.getByLabel('Novo prazo')).toHaveCount(0);
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test('edição recusada no quadro mantém prioridade e conclusão continua recuperável', async ({ page, request }) => {
  const task = await create(request, 'Recusa e recuperação no quadro', { status: 'doing' });
  let refuse = true;
  await page.route(`**/api/tasks/${task.id}`, route => route.request().method() === 'PATCH' && refuse ? route.fulfill({ status: 409, json: { error: 'Prioridade recusada QA' } }) : route.continue());
  try {
    await page.goto('/tarefas');
    await page.getByRole('button', { name: 'Visualização: Quadro Kanban' }).click();
    const priority = page.getByRole('combobox', { name: `Prioridade no quadro de ${task.title}`, exact: true });
    await priority.selectOption('urgent');
    await expect(page.getByText('Prioridade recusada QA')).toBeVisible();
    await expect(priority).toHaveValue('normal');
    refuse = false;
    await page.getByRole('combobox', { name: `Etapa no quadro de ${task.title}`, exact: true }).selectOption('done');
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('done');
    await page.locator('[data-sonner-toast]').getByRole('button', { name: 'Desfazer', exact: true }).click();
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('doing');
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test('visões ricas são utilizáveis em desktop e celular, claro e escuro', async ({ page, request }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const tasks: Task[] = [];
  for (const [title, status, priority, dueDate] of [
    ['Rico QA · Revisar roteiro de lançamento', 'doing', 'important', '2027-01-12'],
    ['Rico QA · Preparar material de divulgação', 'todo', 'urgent', '2027-01-12'],
    ['Rico QA · Definir a próxima entrega', 'todo', 'normal', ''],
  ]) tasks.push(await create(request, title, { status, priority, dueDate: dueDate || undefined, description: 'Objetivo, contexto e próximos passos para uma execução clara.', tags: ['Produto', 'Design'], checklist: [{ id: 'qa-step', text: 'Revisar briefing', done: false }] }));
  await page.route('**/api/tasks', route => route.fulfill({ json: tasks }));
  try {
    for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await page.goto('/tarefas');
      await page.getByPlaceholder('Buscar tarefas...').fill('Rico QA');
      await page.evaluate(t => { document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(t); }, theme);
      for (const [label, slug] of [['Quadro Kanban', 'kanban'], ['Calendário', 'calendar'], ['Linha do tempo', 'timeline'], ['Semana', 'week']]) {
        await page.getByRole('button', { name: `Visualização: ${label}`, exact: true }).click();
        if (slug === 'calendar' || slug === 'timeline') { await page.getByLabel(slug === 'calendar' ? 'Mês do calendário' : 'Mês da linha do tempo').fill('2027-01'); }
        if (slug === 'calendar') await page.getByRole('button', { name: 'Ver dia 12/01/2027', exact: true }).click();
        if (slug === 'kanban') await expect(page.getByRole('combobox', { name: `Etapa no quadro de ${tasks[0].title}` })).toBeVisible();
        if (slug === 'week') {
          await expect(page.getByRole('region', { name: 'Distribuição semanal' })).toBeVisible();
          await expect(page.getByRole('region', { name: 'Planejamento integrado' }).getByRole('button', { name: tasks[2].title, exact: true })).toBeVisible();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
        await page.screenshot({ path: `../lifesystem-task-${slug}-${theme}-${width}.png`, fullPage: true });
      }
    }
    expect(errors).toEqual([]);
  } finally { for (const task of tasks) await request.delete(`/api/tasks/${task.id}`); }
});

test('trocar agrupamento elimina seleção que volta para coluna recolhida', async ({ page, request }) => {
  const task = await create(request, 'Urgente no agrupamento', { priority: 'urgent' });
  async function group(value: string) {
    await page.getByRole('button', { name: 'Filtros', exact: true }).click();
    await page.getByText('Agrupar por', { exact: true }).locator('..').getByRole('combobox').click();
    await page.getByRole('option', { name: value, exact: true }).click();
    await page.keyboard.press('Escape');
  }
  try {
    await page.goto('/tarefas');
    await page.getByRole('button', { name: 'Visualização: Quadro Kanban' }).click();
    await group('Prioridade');
    await page.getByRole('button', { name: 'Recolher coluna Urgente', exact: true }).click();
    await group('Estágio');
    await page.locator('details', { hasText: 'Mais opções de organização' }).locator('summary').click();
    await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
    await page.getByRole('button', { name: `Selecionar ${task.title}`, exact: true }).click();
    await expect(page.getByRole('region', { name: 'Ações das tarefas selecionadas' })).toBeVisible();
    await group('Prioridade');
    await expect(page.getByRole('region', { name: 'Ações das tarefas selecionadas' })).toHaveCount(0);
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test('patch pendente impede abrir snapshot antigo no painel', async ({ page, request }) => {
  const task = await create(request, 'Edição serializada no quadro');
  let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/tasks/${task.id}`, async route => { if (route.request().method() === 'PATCH') await held; await route.continue(); });
  try {
    await page.goto('/tarefas');
    await page.getByRole('button', { name: 'Visualização: Quadro Kanban' }).click();
    await page.getByRole('combobox', { name: `Prioridade no quadro de ${task.title}`, exact: true }).selectOption('urgent');
    await expect(page.getByRole('button', { name: task.title, exact: true })).toBeDisabled();
    release();
    await expect(page.getByRole('button', { name: task.title, exact: true })).toBeEnabled();
    await page.getByRole('button', { name: task.title, exact: true }).click();
    await page.getByRole('dialog').getByLabel('Descrição da tarefa').fill('Preservar edição rápida');
    await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).priority).toBe('urgent');
  } finally { release(); await request.delete(`/api/tasks/${task.id}`); }
});
