import { test, expect } from '@playwright/test';

test('mobile reserva e move um bloco sem mudar o prazo da tarefa', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const title = `Bloco UI ${Date.now()}`;
  const task = await (await request.post('/api/tasks', { data: { title, dueDate: '2030-12-20' } })).json();
  try {
    await request.delete(`/api/tasks/${task.id}/planning`, { data: {} });
    await page.goto('/planejar');
    const card = page.getByTestId(`planning-task-${task.id}`);
    const more = page.getByRole('button', { name: /Ver mais \d+ tarefas/ });
    await expect(card.or(more).first()).toBeVisible();
    if (!await card.count()) await more.click();
    await card.getByRole('button', { name: 'Planejar', exact: true }).click();
    await page.getByLabel('Reservar horário').check();
    await page.getByLabel('Horário de início').fill('14:00');
    await page.getByLabel('Duração em minutos').fill('45');
    await page.getByRole('button', { name: 'Salvar bloco', exact: true }).click();
    await expect(card).toContainText('14:00');
    await card.getByRole('button', { name: 'Replanejar', exact: true }).click();
    await page.getByLabel('Horário de início').fill('15:00');
    await page.getByRole('button', { name: 'Salvar bloco', exact: true }).click();
    await expect(card).toContainText('15:00');
    const saved = await (await request.get(`/api/tasks/${task.id}`)).json();
    expect(saved.dueDate).toBe('2030-12-20');
    expect(saved.planning.syncState).toBe('local');
    await page.screenshot({ path: 'screenshots/task-block-mobile.png' });
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});

test.describe('mudança de horário de verão', () => {
  test.use({ timezoneId: 'America/New_York' });
  test('salvar o segundo 01:30 mantém o instante e offset originais', async ({ page, request }) => {
    await page.clock.install({ time: new Date('2026-11-01T12:00:00Z') });
    const task = await (await request.post('/api/tasks', { data: { title: 'DST bloco' } })).json();
    try {
      const plan = { date: '2026-11-01', startAt: '2026-11-01T06:30:00.000Z', endAt: '2026-11-01T07:15:00.000Z', timeZone: 'America/New_York', syncToGoogle: false };
      expect((await request.put(`/api/tasks/${task.id}/planning`, { data: plan })).ok()).toBe(true);
      await page.goto('/planejar');
      await page.getByTestId(`planning-task-${task.id}`).getByRole('button', { name: 'Replanejar' }).click();
      await expect(page.getByLabel('Horário de início')).toHaveValue('01:30');
      await page.getByRole('dialog').screenshot({ path: 'screenshots/task-block-dialog-desktop.png' });
      await page.getByRole('button', { name: 'Salvar bloco', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      const saved = await (await request.get(`/api/tasks/${task.id}`)).json();
      expect(saved.planning.startAt).toBe(plan.startAt);
    } finally { await request.delete(`/api/tasks/${task.id}`); }
  });
});
