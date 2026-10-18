import { expect, test, type APIRequestContext } from '@playwright/test';

async function create(request: APIRequestContext, title: string, extra: Record<string, unknown> = {}) {
  const response = await request.post('/api/tasks', { data: { title, status: 'todo', priority: 'normal', ...extra } });
  expect(response.ok()).toBe(true); return response.json();
}

test('lista permite editar prioridade e prazo sem abrir ou concluir a tarefa', async ({ page, request }) => {
  const task = await create(request, 'Editar campos na lista');
  try {
    await page.goto('/tarefas');
    const table = page.getByRole('table', { name: 'Lista de tarefas' });
    await expect(table).toBeVisible();
    const row = table.getByRole('row').filter({ has: page.getByRole('button', { name: task.title, exact: true }) });
    await row.getByRole('combobox', { name: `Prioridade de ${task.title}`, exact: true }).selectOption('urgent');
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).priority).toBe('urgent');
    await row.getByRole('button', { name: `Prazo de ${task.title}`, exact: true }).click();
    await page.getByLabel('Novo prazo').fill('2027-01-12');
    await page.getByRole('button', { name: 'Salvar prazo', exact: true }).click();
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).dueDate).toBe('2027-01-12');
    await row.getByRole('button', { name: `Prazo de ${task.title}`, exact: true }).click();
    await page.getByRole('button', { name: 'Remover prazo', exact: true }).click();
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).dueDate).toBeUndefined();
    expect((await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('todo');
    await expect(page.getByRole('dialog', { name: 'Editar Tarefa' })).toHaveCount(0);
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test('edição recusada preserva valor e permite tentar novamente', async ({ page, request }) => {
  const task = await create(request, 'Prioridade recusada');
  let refused = true;
  await page.route(`**/api/tasks/${task.id}`, route => route.request().method() === 'PATCH' && refused ? route.fulfill({ status: 409, json: { error: 'Alteração recusada para verificação' } }) : route.continue());
  try {
    await page.goto('/tarefas');
    const field = page.getByRole('combobox', { name: `Prioridade de ${task.title}` });
    await field.selectOption('urgent');
    await expect(page.getByText('Alteração recusada para verificação')).toBeVisible();
    await expect(field).toHaveValue('normal');
    refused = false;
    await field.selectOption('important');
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).priority).toBe('important');
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test('prazo planejado orienta Planejar e não permite alterar o bloco pela lista', async ({ page, request }) => {
  const task = await create(request, 'Bloco protegido na lista');
  const response = await request.put(`/api/tasks/${task.id}/planning`, { data: { date: '2026-11-10', startAt: '2026-11-10T12:00:00.000Z', endAt: '2026-11-10T13:00:00.000Z', timeZone: 'America/Sao_Paulo', syncToGoogle: false } });
  expect(response.ok()).toBe(true);
  try {
    await page.goto('/tarefas');
    await page.getByRole('button', { name: `Prazo de ${task.title}`, exact: true }).click();
    await expect(page.getByRole('link', { name: 'Replanejar bloco' })).toHaveAttribute('href', '/planejar');
    await expect(page.getByLabel('Novo prazo')).toHaveCount(0);
    expect((await (await request.get(`/api/tasks/${task.id}`)).json()).planning.date).toBe('2026-11-10');
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test('status terminal pela célula usa conclusão, desfazer e recorrência', async ({ page, request }) => {
  const task = await create(request, 'Recorrência pela lista', { status: 'doing', dueDate: '2026-11-01', recurring: true, recurringFrequency: 'daily' });
  try {
    await page.goto('/tarefas');
    await page.getByRole('combobox', { name: `Status de ${task.title}`, exact: true }).selectOption('done');
    await expect.poll(async () => (await (await request.get('/api/tasks')).json()).filter((item: { title: string }) => item.title === task.title).length).toBe(2);
    await page.locator('[data-sonner-toast]').getByRole('button', { name: 'Reabrir', exact: true }).click();
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('doing');
  } finally {
    const tasks = await (await request.get('/api/tasks')).json();
    for (const item of tasks.filter((item: { title: string }) => item.title === task.title)) await request.delete(`/api/tasks/${item.id}`);
  }
});

test('seleção em lote acompanha o filtro e não altera tarefas ocultas', async ({ page, request }) => {
  const first = await create(request, 'Selecionada no filtro'); const other = await create(request, 'Fora da seleção');
  try {
    await page.goto('/tarefas');
    await page.getByRole('checkbox', { name: `Selecionar ${other.title}`, exact: true }).check();
    await page.getByPlaceholder('Buscar tarefas...').fill(first.title);
    await expect(page.getByRole('region', { name: 'Ações das tarefas selecionadas' })).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Selecionar tarefas visíveis', exact: true }).check();
    const bulk = page.getByRole('region', { name: 'Ações das tarefas selecionadas' });
    await bulk.getByRole('button', { name: 'Concluir selecionadas', exact: true }).click();
    await expect.poll(async () => (await (await request.get(`/api/tasks/${first.id}`)).json()).status).toBe('done');
    expect((await (await request.get(`/api/tasks/${other.id}`)).json()).status).toBe('todo');
  } finally { await request.delete(`/api/tasks/${first.id}`); await request.delete(`/api/tasks/${other.id}`); }
});

test('salvar conclusão no painel lateral respeita recorrência e reabertura', async ({ page, request }) => {
  const task = await create(request, 'Conclusão no painel', { status: 'doing', dueDate: '2026-11-01', recurring: true, recurringFrequency: 'daily' });
  try {
    await page.goto('/tarefas');
    await page.getByRole('button', { name: task.title, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar Tarefa' });
    await dialog.getByRole('combobox').nth(0).click();
    await page.getByRole('option', { name: 'Concluída', exact: true }).click();
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await (await request.get('/api/tasks')).json()).filter((item: { title: string }) => item.title === task.title).length).toBe(2);
    await page.locator('[data-sonner-toast]').getByRole('button', { name: 'Reabrir', exact: true }).click();
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('doing');
  } finally {
    const tasks = await (await request.get('/api/tasks')).json();
    for (const item of tasks.filter((item: { title: string }) => item.title === task.title)) await request.delete(`/api/tasks/${item.id}`);
  }
});

test('mudar para concluídas remove a seleção das tarefas em aberto', async ({ page, request }) => {
  const task = await create(request, 'Seleção protegida por situação');
  try {
    await page.goto('/tarefas');
    await page.getByRole('checkbox', { name: `Selecionar ${task.title}`, exact: true }).check();
    await page.getByRole('button', { name: /^Mostrar concluídas/ }).click();
    await expect(page.getByRole('region', { name: 'Ações das tarefas selecionadas' })).toHaveCount(0);
    expect((await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('todo');
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test('mover uma selecionada para grupo recolhido retira a tarefa do lote', async ({ page, request }) => {
  const task = await create(request, 'Mover selecionada para grupo oculto');
  const other = await create(request, 'Grupo destino recolhido', { status: 'doing' });
  try {
    await page.goto('/tarefas');
    await page.getByRole('checkbox', { name: `Selecionar ${task.title}`, exact: true }).check();
    await page.getByRole('button', { name: /^Recolher grupo Fazendo/ }).click();
    await page.getByRole('combobox', { name: `Status de ${task.title}`, exact: true }).selectOption('doing');
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('doing');
    await expect(page.getByRole('button', { name: task.title, exact: true })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Ações das tarefas selecionadas' })).toHaveCount(0);
  } finally { await request.delete(`/api/tasks/${task.id}`); await request.delete(`/api/tasks/${other.id}`); }
});

test('grupos podem recolher sem perder dados ou impedir reabertura', async ({ page, request }) => {
  const task = await create(request, 'Grupo recolhível');
  try {
    await page.goto('/tarefas');
    const group = page.getByRole('button', { name: /^Recolher grupo A fazer/ });
    await group.click();
    await expect(page.getByRole('button', { name: task.title, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /^Expandir grupo A fazer/ }).click();
    await expect(page.getByRole('button', { name: task.title, exact: true })).toBeVisible();
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test('calendário navega meses vazios e cruza o ano mantendo tarefas futuras', async ({ page, request }) => {
  const task = await create(request, 'Prazo futuro visível', { dueDate: '2027-01-12' });
  try {
    await page.goto('/tarefas');
    await page.getByRole('button', { name: 'Visualização: Calendário', exact: true }).click();
    await page.getByLabel('Mês do calendário').fill('2026-12');
    await expect(page.getByRole('heading', { name: /dezembro de 2026/i })).toBeVisible();
    await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
    await expect(page.getByRole('heading', { name: /janeiro de 2027/i })).toBeVisible();
    await expect(page.getByRole('button', { name: task.title, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Mês anterior', exact: true }).click();
    await expect(page.getByRole('heading', { name: /dezembro de 2026/i })).toBeVisible();
    await page.getByLabel('Mês do calendário').fill('2025-02');
    await expect(page.getByRole('heading', { name: /fevereiro de 2025/i })).toBeVisible();
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

for (const theme of ['light', 'dark']) test(`mobile ${theme}: editar pelo título mantém a tarefa aberta e painel cabe na tela`, async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  const task = await create(request, `Detalhes seguros mobile ${theme}`, { description: 'Contexto preservado', status: 'doing' });
  try {
    await page.goto('/tarefas');
    await page.evaluate(t => { document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(t); }, theme);
    await page.getByRole('button', { name: task.title, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar Tarefa' });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox(); expect(box!.width).toBeLessThanOrEqual(390); expect(box!.height).toBeLessThanOrEqual(844);
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390); expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    expect((await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('doing');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`tasks-${theme}-390.png`), fullPage: true });
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test('painel preserva edição recusada e bloqueia novo envio durante salvamento', async ({ page, request }) => {
  const task = await create(request, 'Edição recuperável no painel');
  let refused = true; let writes = 0;
  await page.route(`**/api/tasks/${task.id}`, async route => {
    if (route.request().method() !== 'PATCH') return route.continue();
    writes++;
    if (refused) return route.fulfill({ status: 409, json: { error: 'Salvar recusado para verificação' } });
    await new Promise(resolve => setTimeout(resolve, 500));
    return route.continue();
  });
  try {
    await page.goto('/tarefas');
    await page.getByRole('button', { name: task.title, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar Tarefa' });
    await dialog.getByRole('textbox', { name: 'Título da tarefa', exact: true }).fill('Título mantido após recusa');
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Salvar recusado para verificação')).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Título da tarefa', exact: true })).toHaveValue('Título mantido após recusa');
    refused = false;
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Salvando…', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('textbox', { name: 'Título da tarefa', exact: true })).toBeDisabled();
    await expect(dialog).toHaveCount(0);
    expect(writes).toBe(2);
    expect((await (await request.get(`/api/tasks/${task.id}`)).json()).title).toBe('Título mantido após recusa');
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test('observatório mantém lista e painel utilizáveis nos dois temas e tamanhos', async ({ page, request }) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const project = await (await request.post('/api/projects', { data: { name: 'Estúdio Observatório QA', status: 'active', tags: [], links: [] } })).json();
  const tasks = [];
  for (const [title, status, priority, dueDate] of [
    ['Design QA · Revisar a proposta visual', 'doing', 'important', '2026-10-02'],
    ['Design QA · Organizar as referências', 'todo', 'normal', '2026-10-04'],
    ['Design QA · Preparar a próxima entrega', 'todo', 'urgent', '2026-10-01'],
  ]) tasks.push(await create(request, title, { status, priority, dueDate, projectId: project.id, description: 'Contexto, próximos passos e uma execução mais clara.', tags: ['Design', 'Produto'], checklist: [{ id: 'qa-check', text: 'Revisar briefing', done: false }] }));
  try {
    for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await page.goto('/tarefas');
      await page.getByPlaceholder('Buscar tarefas...').fill('Design QA');
      await page.evaluate(t => { document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(t); }, theme);
      await expect(page.getByRole('table', { name: 'Lista de tarefas' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `../lifesystem-task-workspace-${theme}-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: tasks[0].title, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Editar Tarefa' });
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(width === 1440 ? 1000 : 844);
      await page.screenshot({ path: `../lifesystem-task-panel-${theme}-${width}.png` });
      await page.keyboard.press('Escape');
    }
    expect(errors).toEqual([]);
  } finally { for (const task of tasks) await request.delete(`/api/tasks/${task.id}`); await request.delete(`/api/projects/${project.id}`); }
});

test('modo de seleção preserva abertura pelo título sem concluir', async ({ page, request }) => {
  const task = await create(request, 'Abrir detalhes com seleção ativa');
  try {
    await page.goto('/tarefas');
    await page.locator('details', { hasText: 'Mais opções de organização' }).locator('summary').click();
    await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
    await page.getByRole('checkbox', { name: `Selecionar ${task.title}`, exact: true }).check();
    await page.getByRole('button', { name: task.title, exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Editar Tarefa' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('checkbox', { name: `Selecionar ${task.title}`, exact: true })).toBeChecked();
    expect((await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('todo');
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});
