import { test, expect } from '@playwright/test';

test('replanejar bloco de outro fuso conserva data civil e instante sem edição', async ({ page, request }) => {
  await page.clock.setFixedTime(new Date('2026-10-01T15:00:00Z'));
  const originalPreferences = await (await request.get('/api/planning-preferences')).json();
  const task = await (await request.post('/api/tasks', { data: { title: 'Fuso QA Los Angeles' } })).json();
  try {
    await request.put('/api/planning-preferences', { data: { workStart: '08:00', workEnd: '20:00', workingDays: [1, 2, 3, 4, 5, 6, 7], timeZone: 'America/Sao_Paulo' } });
    expect((await request.put(`/api/tasks/${task.id}/planning`, { data: { date: '2026-10-01', startAt: '2026-10-02T06:00:00Z', endAt: '2026-10-02T07:00:00Z', timeZone: 'America/Los_Angeles', syncToGoogle: false } })).ok()).toBe(true);
    await page.goto('/planejar');
    await page.getByTestId(`planning-task-${task.id}`).getByRole('button', { name: 'Replanejar', exact: true }).click();
    await expect(page.getByLabel('Dia escolhido')).toHaveValue('2026-10-01');
    await expect(page.getByLabel('Horário de início')).toHaveValue('23:00');
    await page.getByRole('button', { name: 'Salvar bloco', exact: true }).click();
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).planning.startAt).toBe('2026-10-02T06:00:00.000Z');
  } finally { await request.delete(`/api/tasks/${task.id}`); await request.put('/api/planning-preferences', { data: originalPreferences }); }
});

test('mobile reserva e move um bloco mantendo o prazo na mesma data planejada', async ({ page, request }) => {
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
    expect(saved.dueDate).toBe(saved.planning.date);
    expect(saved.planning.syncState).toBe('local');
    await page.goto('/tarefas');
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    const dueLabel = new Date(`${saved.dueDate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    await expect(page.getByText(dueLabel, { exact: false })).toBeVisible();
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
