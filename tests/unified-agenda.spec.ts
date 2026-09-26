import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'America/Sao_Paulo' });

test('semana de Tarefas usa agenda integrada, intervalos reais e seletor móvel', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-28T15:00:00Z') });
  await page.route('**/api/google-calendar/status', route => route.fulfill({ json: { configured: true, connected: true } }));
  await page.route('**/api/tasks', route => route.fulfill({ json: [] }));
  await page.route('**/api/google-calendar/events?*', route => route.fulfill({ json: [
    { id: 'a', title: 'Reunião de teste', start: '2026-09-28T09:00:00-03:00', end: '2026-09-28T10:00:00-03:00', allDay: false },
    { id: 'b', title: 'Sobreposição', start: '2026-09-28T09:30:00-03:00', end: '2026-09-28T11:00:00-03:00', allDay: false },
    { id: 'c', title: 'Lembrete livre', start: '2026-09-28T14:00:00-03:00', end: '2026-09-28T15:00:00-03:00', allDay: false, busy: false },
    { id: 'd', title: 'Aniversário', start: '2026-09-28', end: '2026-09-29', allDay: true },
  ] }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/tarefas');
  await page.getByRole('button', { name: 'Visualização: Semana', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sua semana' })).toBeVisible();
  await expect(page.getByText('10h sem blocos · 08–20h')).toBeVisible();
  await page.screenshot({ path: 'screenshots/agenda-unified-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  const days = page.getByRole('navigation', { name: 'Escolher dia' });
  await expect(days).toBeVisible();
  await expect(page.getByText('Reunião de teste', { exact: true })).toBeVisible();
  await days.getByRole('button').nth(1).click();
  await expect(page.getByText('Reunião de teste', { exact: true })).not.toBeVisible();
  await days.getByRole('button').nth(0).click();
  await page.getByText('2 intervalos livres', { exact: true }).click();
  await expect(page.getByText('11:00 – 20:00', { exact: true })).toBeVisible();
  await days.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'screenshots/agenda-unified-mobile.png' });
});

test('falha Google não apresenta horários como livres', async ({ page }) => {
  await page.route('**/api/google-calendar/status', route => route.fulfill({ json: { configured: true, connected: true } }));
  await page.route('**/api/google-calendar/events?*', route => route.fulfill({ status: 503, json: { error: 'Indisponível' } }));
  await page.goto('/planejar');
  await expect(page.getByRole('status')).toContainText('Indisponível');
  await expect(page.getByText(/sem blocos · 08–20h/)).toHaveCount(0);
});

test('falha nas tarefas locais também impede afirmar disponibilidade', async ({ page }) => {
  await page.route('**/api/tasks', route => route.fulfill({ status: 503, json: { error: 'Tarefas indisponíveis' } }));
  await page.route('**/api/google-calendar/status', route => route.fulfill({ json: { configured: true, connected: true } }));
  await page.route('**/api/google-calendar/events?*', route => route.fulfill({ json: [] }));
  await page.goto('/planejar');
  await expect(page.getByRole('alert').filter({ hasText: 'Tarefas indisponíveis' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Atualizar agenda', exact: true })).toBeEnabled();
  await expect(page.getByText(/sem blocos · 08–20h/)).toHaveCount(0);
});
