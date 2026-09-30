import { expect, test } from '@playwright/test';

test('galeria de projetos busca e filtra sem perder acesso à edição', async ({ page, request }) => {
  test.setTimeout(60000);
  const created = await request.post('/api/projects', { data: { name: 'Nebulosa sintética', description: 'Projeto de verificação', status: 'idea', tags: [], links: [] } });
  const project = await created.json();
  try {
    await page.goto('/projetos');
    await page.getByRole('textbox', { name: 'Buscar projetos' }).fill('Nebulosa');
    await expect(page.getByRole('button', { name: 'Abrir projeto Nebulosa sintética' })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir projeto Nebulosa sintética' }).click();
    await expect(page.getByRole('dialog')).toContainText('Editar Projeto');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Ativo', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Abrir projeto Nebulosa sintética' })).toHaveCount(0);
  } finally { if (test.info().status !== 'timedOut') await request.delete(`/api/projects/${project.id}`); }
});

test('exclusão no Planejar permite cancelar e mantém a tarefa até confirmar', async ({ page, request }) => {
  test.setTimeout(60000);
  const response = await request.post('/api/tasks', { data: { title: 'Excluir sintética pelo planejamento', status: 'todo', priority: 'normal' } });
  const task = await response.json();
  try {
    await page.goto('/planejar');
    const card = page.getByTestId(`planning-task-${task.id}`);
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Excluir tarefa' }).click();
    await expect(page.getByRole('dialog')).toContainText(task.title);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Excluir tarefa' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir tarefa', exact: true }).click();
    await expect(card).toHaveCount(0);
    expect((await request.get(`/api/tasks/${task.id}`)).status()).toBe(404);
  } finally { if (test.info().status !== 'timedOut') await request.delete(`/api/tasks/${task.id}`); }
});

test('cinco telas com dados sintéticos permanecem utilizáveis em desktop e mobile', async ({ page, request }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const created: { collection: string; id: string }[] = [];
  await page.goto('/hoje');
  const today = await page.evaluate(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  async function create(collection: string, data: Record<string, unknown>) {
    const response = await request.post(`/api/${collection}`, { data });
    expect(response.status()).toBe(201);
    const item = await response.json(); created.push({ collection, id: item.id }); return item;
  }
  try {
    const project = await create('projects', { name: 'Observatório', description: 'Pesquisa, criação e próximos passos em um só lugar.', status: 'active', tags: ['Design', 'Pesquisa'], links: [] });
    await create('projects', { name: 'Estúdio Horizonte', description: 'Uma nova experiência editorial para compartilhar ideias.', status: 'development', tags: ['Conteúdo'], links: [] });
    await create('projects', { name: 'Experimento Lunar', description: 'Validar uma pequena ideia com pessoas reais.', status: 'idea', tags: ['Produto'], links: [] });
    for (let index = 0; index < 8; index++) await create('tasks', { title: ['Preparar o briefing de uma nova experiência', 'Revisar a proposta visual', 'Organizar as referências do projeto', 'Conversar com os primeiros participantes'][index % 4] + (index > 3 ? ' · próxima etapa' : ''), status: index === 1 ? 'doing' : 'todo', priority: index === 0 ? 'important' : 'normal', dueDate: today, projectId: project.id });
    await create('tasks', { title: 'Uma ideia que ainda precisa de espaço', status: 'todo', priority: 'normal' });
    for (const [title, stage, channel] of [['Como uma ideia se torna uma experiência', 'idea', 'blog'], ['Bastidores de um novo projeto', 'draft', 'instagram'], ['Pequenos passos, grandes mudanças', 'published', 'youtube']]) await create('content', { title, stage, channel, body: 'Referências, decisões e histórias que vale a pena compartilhar.', tags: ['Processo'], format: 'Artigo' });
    await create('content', { title: 'Registro com etapa histórica', stage: 'legacy-stage', channel: 'blog', body: 'Uma etapa antiga não deve quebrar a biblioteca.' });
    const screens = [['tarefas', 'Tarefas'], ['hoje', 'Hoje'], ['projetos', 'Projetos'], ['conteudo', 'Conteúdo'], ['planejar', 'Sua semana']];
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      for (const [route, heading] of screens) {
        await page.goto(`/${route}`, { waitUntil: 'networkidle' });
        await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await page.screenshot({ path: `../lifesystem-refinement-${route}-${width}.png`, fullPage: false });
      }
    }
    await page.evaluate(() => { localStorage.setItem('lifesystem-theme', 'light'); window.dispatchEvent(new Event('lifesystem-theme-change')); });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/projetos', { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'Abrir projeto Observatório' })).toBeVisible();
    await page.screenshot({ path: '../lifesystem-refinement-projetos-light.png' });
    expect(errors).toEqual([]);
  } finally {
    if (test.info().status !== 'timedOut') for (const item of created.reverse()) await request.delete(`/api/${item.collection}/${item.id}`);
  }
});

 test('semana integrada preserva criação por pilar', async ({ page }) => {
  await page.goto('/tarefas');
  await page.getByRole('button', { name: 'Visualização: Semana', exact: true }).click();
  await page.getByRole('button', { name: 'Criar por pilar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fechar ritual', exact: true })).toBeVisible();
 });
