import { expect, test } from '@playwright/test';

test('dia da revisão: API valida e guarda no servidor', async ({ request }) => {
  const original = await (await request.get('/api/weekly-review/settings')).json();
  try {
    expect((await request.put('/api/weekly-review/settings', { data: { reviewDay: 8 } })).status()).toBe(400);
    expect((await request.put('/api/weekly-review/settings', { data: { reviewDay: 5, extra: true } })).status()).toBe(400);
    expect((await request.put('/api/weekly-review/settings', { data: { reviewDay: 5 } })).status()).toBe(200);
    expect(await (await request.get('/api/weekly-review/settings')).json()).toEqual({ reviewDay: 5 });
  } finally { await request.put('/api/weekly-review/settings', { data: original }); }
});

test('Configurações: atalhos em português com Ctrl no PC e a mesma tecla que navega', async ({ page }) => {
  await page.goto('/hoje');
  // Espera a barra lateral montar (ela ouve o evento) antes de pedir a aba.
  await expect(page.getByRole('button', { name: 'Abrir configurações' })).toBeVisible();
  await expect(async () => {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'atalhos' } })));
    await expect(page.getByRole('dialog', { name: 'Configurações' })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
  const dialog = page.getByRole('dialog', { name: 'Configurações' });
  await expect(dialog.getByRole('tab', { name: 'Atalhos' })).toHaveAttribute('aria-selected', 'true');
  const anywhere = dialog.getByRole('region', { name: 'Em qualquer tela' });
  await expect(anywhere.getByText('Caixa de entrada', { exact: true })).toBeVisible();
  await expect(anywhere.getByText('Ctrl').first()).toBeVisible();
  await expect(dialog.getByText('⌘')).toHaveCount(0);
  await expect(dialog.getByText('INBOX')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+i');
  await expect(page).toHaveURL(/\/inbox$/);
});

test('jornada: Planejar mostra o resumo e Configurações edita sem recarregar', async ({ page, request }) => {
  const original = await (await request.get('/api/planning-preferences')).json();
  try {
    await request.put('/api/planning-preferences', { data: { ...original, workingDays: [1, 2, 3, 4, 5, 6, 7] } });
    await page.goto('/planejar');
    const summary = page.getByRole('region', { name: 'Capacidade diária' });
    await expect(summary).toContainText('todos os dias');
    await summary.getByRole('button', { name: 'Ajustar jornada' }).click();
    const dialog = page.getByRole('dialog', { name: 'Configurações' });
    await expect(dialog.getByRole('tab', { name: 'Jornada' })).toHaveAttribute('aria-selected', 'true');
    const form = dialog.getByRole('form', { name: 'Jornada de trabalho' });
    await form.getByRole('checkbox', { name: 'Sábado' }).uncheck();
    await form.getByRole('checkbox', { name: 'Domingo' }).uncheck();
    await expect(form.getByLabel('Fuso horário')).toHaveValue(original.timeZone);
    await form.getByRole('button', { name: 'Salvar jornada' }).click();
    await expect(form.getByRole('status')).toHaveText('Jornada e fuso atualizados.');
    await page.keyboard.press('Escape');
    await expect(summary).toContainText('seg a sex');
    expect((await (await request.get('/api/planning-preferences')).json()).workingDays).toEqual([1, 2, 3, 4, 5]);
  } finally { await request.put('/api/planning-preferences', { data: original }); }
});

test('Hoje lembra a revisão a partir do dia combinado', async ({ page }) => {
  const now = new Date();
  const isoToday = now.getDay() || 7;
  // Última revisão ontem; com a revisão combinada para hoje, o lembrete aparece.
  await page.route('**/api/weekly-review', route => route.fulfill({ json: { id: 'r', priorities: [], completedAt: new Date(now.getTime() - 86_400_000).toISOString() } }));
  await page.route('**/api/weekly-review/settings', route => route.fulfill({ json: { reviewDay: isoToday } }));
  await page.goto('/hoje');
  await expect(page.getByRole('link', { name: 'Revisão semanal pendente' })).toBeVisible();
  // Combinada para amanhã: a de ontem ainda vale para esta semana.
  await page.unroute('**/api/weekly-review/settings');
  await page.route('**/api/weekly-review/settings', route => route.fulfill({ json: { reviewDay: (isoToday % 7) + 1 } }));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hoje', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Revisão semanal pendente' })).toHaveCount(0);
});
