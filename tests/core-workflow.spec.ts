import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'America/Sao_Paulo' });

test('mobile percorre captura, conversão, planejamento, conclusão e revisão', async ({ page, request }) => {
  test.setTimeout(60000); // Multiple routes compile on the first run of a dev server.
  await page.setViewportSize({ width: 360, height: 800 });
  const title = `Percurso sintético ${Date.now()}`;
  let captureId: string | undefined;
  let taskId: string | undefined;
  try {
    await page.goto('/inbox');
    const today = await page.evaluate(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });
    await page.getByRole('navigation', { name: 'Navegação rápida' }).getByRole('button', { name: 'Captura rápida' }).click();
    await page.getByLabel('Texto da captura rápida').fill(title);
    const created = page.waitForResponse(response => response.url().endsWith('/api/captures') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Salvar captura', exact: true }).click();
    captureId = (await (await created).json()).id;
    await page.keyboard.press('Escape');
    await page.reload();
    await page.getByRole('button', { name: `Converter ${title}`, exact: true }).click();
    await page.getByRole('dialog').getByLabel('Destino').selectOption('task');
    const converted = page.waitForResponse(response => response.url().endsWith(`/api/captures/${captureId}/convert`));
    await page.getByRole('button', { name: 'Converter captura', exact: true }).click();
    taskId = (await (await converted).json()).id;
    expect(taskId).toBeTruthy();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Navegação rápida' }).getByRole('link', { name: 'Planejar', exact: true }).click();
    const card = page.getByTestId(`planning-task-${taskId}`);
    const more = page.getByRole('button', { name: /Ver mais \d+ tarefas/ });
    await expect(card.or(more).first()).toBeVisible();
    if (!await card.count()) await more.click();
    await card.getByRole('button', { name: 'Planejar', exact: true }).click();
    await page.getByLabel('Dia escolhido').fill(today);
    const planned = page.waitForResponse(response => response.url().endsWith(`/api/tasks/${taskId}/planning`) && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Salvar dia', exact: true }).click();
    expect((await planned).ok()).toBeTruthy();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const scheduled = await (await request.get(`/api/tasks/${taskId}`)).json();
    expect(scheduled.dueDate).toBe(today);
    await page.goto('/hoje');
    await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();
    await page.getByRole('button', { name: title, exact: true }).click();
    await expect(page.getByText('Tarefa concluída! 🎉', { exact: true })).toBeVisible();
    const saved = await (await request.get(`/api/tasks/${taskId}`)).json();
    expect(saved.status).toBe('done');
    expect(saved.dueDate).toBe(today);
    await page.goto('/revisao');
    for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Próximo', exact: true }).click();
    await page.getByRole('button', { name: 'Concluir revisão', exact: true }).click();
    await expect(page.getByText('Revisão concluída!', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await page.screenshot({ path: 'test-results/core-workflow-mobile.png' });
  } finally {
    if (test.info().status !== 'timedOut') {
      if (taskId) await request.delete(`/api/tasks/${taskId}`);
      if (captureId) await request.delete(`/api/captures/${captureId}`);
    }
  }
});
