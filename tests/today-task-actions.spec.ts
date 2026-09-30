import { expect, test } from '@playwright/test';

test.describe('Hoje: abrir, concluir e recuperar tarefas', () => {
  for (const overdue of [false, true]) {
    test(`clicar no título ${overdue ? 'atrasado' : 'de hoje'} abre detalhes sem concluir`, async ({ page, request }) => {
      test.setTimeout(60000);
      await page.goto('/hoje');
      const date = await page.evaluate(delta => {
        const date = new Date(); date.setDate(date.getDate() + delta);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }, overdue ? -1 : 0);
      const task = await (await request.post('/api/tasks', { data: { title: `Abrir detalhes sintéticos ${overdue}`, status: 'doing', priority: 'normal', dueDate: date } })).json();
      try {
        await page.reload();
        await page.getByText(task.title, { exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Editar Tarefa' })).toBeVisible();
        expect((await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('doing');
      } finally { await request.delete(`/api/tasks/${task.id}`); }
    });
  }

  test('conclusão explícita fica visível e Desfazer restaura a etapa anterior', async ({ page, request }) => {
    test.setTimeout(60000);
    await page.goto('/hoje');
    const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
    const task = await (await request.post('/api/tasks', { data: { title: 'Desfazer conclusão sintética', status: 'doing', priority: 'important', dueDate: today } })).json();
    try {
      await page.reload();
      await page.getByRole('button', { name: `Concluir tarefa ${task.title}`, exact: true }).click();
      const completed = page.getByRole('region', { name: 'Concluídas hoje' });
      await expect(completed.getByText(task.title, { exact: true })).toBeVisible();
      expect((await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('done');
      await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
      await expect(page.getByRole('button', { name: `Concluir tarefa ${task.title}`, exact: true })).toBeVisible();
      expect((await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('doing');
    } finally { await request.delete(`/api/tasks/${task.id}`); }
  });

  test('tarefas mostra contagem real de concluídas e permite encontrá-las', async ({ page, request }) => {
    const task = await (await request.post('/api/tasks', { data: { title: 'Concluída recuperável sintética', status: 'todo', priority: 'normal' } })).json();
    await request.patch(`/api/tasks/${task.id}`, { data: { status: 'done' } });
    try {
      await page.goto('/tarefas');
      await expect(page.getByRole('button', { name: 'Mostrar concluídas (1)', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Mostrar concluídas (1)', exact: true }).click();
      await expect(page.getByText(task.title, { exact: true })).toBeVisible();
      await page.goto('/tarefas?completed=1');
      await expect(page.getByText(task.title, { exact: true })).toBeVisible();
    } finally { await request.delete(`/api/tasks/${task.id}`); }
  });

  test('uma etapa removida não faz tarefas desaparecerem do quadro', async ({ page, request }) => {
    const task = await (await request.post('/api/tasks', { data: { title: 'Tarefa de etapa histórica', status: 'historical-paused', priority: 'normal' } })).json();
    try {
      await page.goto('/tarefas');
      await expect(page.getByText(task.title, { exact: true })).toBeVisible();
    } finally { await request.delete(`/api/tasks/${task.id}`); }
  });

  test('busca encontra uma concluída e o menu permite reabrir sem abrir o editor', async ({ page, request }) => {
    const task = await (await request.post('/api/tasks', { data: { title: 'Busca conclusão sintética', status: 'todo', priority: 'normal' } })).json();
    await request.patch(`/api/tasks/${task.id}`, { data: { status: 'done' } });
    try {
      await page.goto('/tarefas');
      await page.getByPlaceholder('Buscar tarefas...').fill(task.title);
      await expect(page.getByText(task.title, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: `Mais ações para ${task.title}`, exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Editar Tarefa' })).toHaveCount(0);
      await page.getByRole('menuitem', { name: 'Reabrir', exact: true }).click();
      await expect(page.getByRole('button', { name: `Concluir ${task.title}`, exact: true })).toBeVisible();
      expect((await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('todo');
      await expect(page.getByRole('dialog', { name: 'Editar Tarefa' })).toHaveCount(0);
    } finally { await request.delete(`/api/tasks/${task.id}`); }
  });

  test('mobile separa abertura e conclusão com alvos de toque e mantém a recuperação', async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/hoje');
    const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
    const task = await (await request.post('/api/tasks', { data: { title: 'Tarefa mobile com título comprido para verificar abertura segura', status: 'doing', priority: 'important', dueDate: today } })).json();
    try {
      await page.reload();
      const button = page.getByRole('button', { name: `Concluir tarefa ${task.title}`, exact: true });
      const box = await button.boundingBox();
      const titleBox = await page.getByRole('link', { name: task.title, exact: true }).boundingBox();
      expect(titleBox?.width).toBeGreaterThan(240);
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await button.click();
      const region = page.getByRole('region', { name: 'Concluídas hoje' });
      await expect(region.getByText(task.title, { exact: true })).toBeVisible();
      await region.getByRole('button', { name: `Reabrir tarefa ${task.title}`, exact: true }).click();
      await expect(button).toBeVisible();
      expect((await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('doing');
      await page.screenshot({ path: test.info().outputPath('hoje-mobile.png'), fullPage: true });
    } finally { await request.delete(`/api/tasks/${task.id}`); }
  });

  test('Hoje reconhece conclusão em etapa personalizada', async ({ page }) => {
    const today = new Date().toLocaleDateString('en-CA');
    await page.route('**/api/stage-configs/tasks', route => route.fulfill({ json: { stages: [{ id: 'todo', label: 'A fazer' }, { id: 'finished', label: 'Feito', isTerminal: true }] } }));
    await page.route('**/api/tasks', route => route.fulfill({ json: [{ id: 'synthetic-finished', title: 'Conclusão em etapa própria', status: 'finished', priority: 'normal', dueDate: today, completedAt: new Date().toISOString() }] }));
    await page.goto('/hoje');
    await expect(page.getByRole('region', { name: 'Concluídas hoje' }).getByText('Conclusão em etapa própria')).toBeVisible();
    await expect(page.getByRole('button', { name: /Concluir tarefa Conclusão/ })).toHaveCount(0);
  });

  for (const screen of ['hoje', 'tarefas']) {
    test(`${screen}: recorrência lenta permite reabrir e não duplica no mesmo ciclo`, async ({ page, request }) => {
      const title = `Recorrência sintética lenta ${screen}`;
      await page.goto('/hoje');
      const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
      const task = await (await request.post('/api/tasks', { data: { title, status: 'doing', priority: 'normal', dueDate: today, recurring: true, recurringFrequency: 'daily' } })).json();
      let recurringWrites = 0;
      await page.route('**/api/tasks', async route => {
        if (route.request().method() !== 'POST') return route.continue();
        recurringWrites++;
        await new Promise(resolveWait => setTimeout(resolveWait, 1200));
        await route.continue();
      });
      try {
        await page.goto(`/${screen}`);
        const scope = screen === 'hoje' ? page : page.locator('.work-board-column').filter({ has: page.getByText('Fazendo', { exact: true }) });
        const complete = scope.getByRole('button', { name: `${screen === 'hoje' ? 'Concluir tarefa' : 'Concluir'} ${title}`, exact: true });
        await complete.click();
        await page.locator('[data-sonner-toast]').getByRole('button', { name: 'Reabrir', exact: true }).click();
        await expect(complete).toBeVisible();
        expect((await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('doing');
        await expect.poll(async () => (await (await request.get('/api/tasks')).json()).filter((item: { title: string }) => item.title === title).length).toBe(2);
        if (screen === 'tarefas') await expect(page.getByText(title, { exact: true })).toHaveCount(2);
        await complete.click();
        await expect(page.getByText('Tarefa concluída! 🎉', { exact: true }).first()).toBeVisible();
        expect(recurringWrites).toBe(1);
      } finally {
        const tasks = await (await request.get('/api/tasks')).json();
        for (const item of tasks.filter((item: { title: string }) => item.title === title)) await request.delete(`/api/tasks/${item.id}`);
      }
    });
  }

  test('erro ao concluir preserva tarefa e cliques repetidos enviam uma única alteração', async ({ page, request }) => {
    await page.goto('/hoje');
    const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
    const task = await (await request.post('/api/tasks', { data: { title: 'Conclusão recusada sintética', status: 'todo', priority: 'normal', dueDate: today } })).json();
    let writes = 0;
    await page.route(`**/api/tasks/${task.id}`, async route => {
      if (route.request().method() !== 'PATCH') return route.continue();
      writes++; await new Promise(resolveWait => setTimeout(resolveWait, 350));
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Falha sintética ao concluir' }) });
    });
    try {
      await page.reload();
      const complete = page.getByRole('button', { name: `Concluir tarefa ${task.title}`, exact: true });
      await complete.dblclick();
      await expect(page.getByText('Falha sintética ao concluir', { exact: true })).toBeVisible();
      await expect(complete).toBeEnabled();
      expect(writes).toBe(1);
      expect((await (await request.get(`/api/tasks/${task.id}`)).json()).status).toBe('todo');
    } finally { await request.delete(`/api/tasks/${task.id}`); }
  });
});
