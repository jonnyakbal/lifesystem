import { expect, test } from '@playwright/test';

// Envios sintéticos no formato do atalho do iPhone (docs/integrations/apple-saude.md).
const tz = 'America/Sao_Paulo';
const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();

test('Apple Saúde: chave própria, sono agrupado por noite, reenvio sem duplicar e revogação', async ({ request, playwright, baseURL }) => {
  const created = await request.post('/api/health/apple/consent');
  expect(created.status()).toBe(201);
  const { token, status } = await created.json();
  expect(token).toMatch(/^ls_apple_/);
  expect(status.active).toBe(true);

  // O envio vem do iPhone, sem a sessão do navegador.
  const device = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const marker = `Treino sintético ${Date.now()}`;
    const payload = { timezone: tz, samples: [
      { type: 'sleep', start: at(30), end: at(28) },
      { type: 'sleep', start: at(27.8), end: at(23) },
      { type: 'water', start: at(5), value: 0.5, unit: 'L' },
      { type: 'workout', name: marker, start: at(10), end: at(9.5) },
    ] };
    expect((await device.post('/api/health/apple', { data: payload })).status()).toBe(401);
    const send = () => device.post('/api/health/apple', { data: payload, headers: { Authorization: `Bearer ${token}` } });
    const first = await send();
    expect(first.status()).toBe(200);
    expect(await first.json()).toEqual({ created: 3, duplicates: 0, conflicts: 0, invalid: 0 });
    expect(await (await send()).json()).toEqual({ created: 0, duplicates: 3, conflicts: 0, invalid: 0 });

    const items = (await (await request.get('/api/health?view=observations&limit=100')).json()).items as { origin: string; durationMinutes: number | null; data: { type: string; ml?: number; activity?: string; durationMinutes?: number; sourceRef?: string } }[];
    const workout = items.find(item => item.data.activity === marker);
    expect(workout).toMatchObject({ origin: 'device', data: { type: 'movement', durationMinutes: 30, sourceRef: 'Apple Saúde' } });
    // Dois trechos de sono com 12 min de intervalo viram uma noite de 7 h.
    expect(items.some(item => item.origin === 'device' && item.data.type === 'sleep' && item.durationMinutes === 420)).toBe(true);
    expect(items.some(item => item.origin === 'device' && item.data.type === 'water' && item.data.ml === 500)).toBe(true);

    const consent = await (await request.get('/api/health/apple/consent')).json();
    expect(consent.lastImport).toEqual({ created: 0, duplicates: 3, conflicts: 0, invalid: 0 });

    expect((await request.delete('/api/health/apple/consent')).status()).toBe(200);
    expect((await send()).status()).toBe(401);
  } finally {
    await device.dispose();
    await request.delete('/api/health/apple/consent');
  }
});

test('Apple Saúde: formato inválido é recusado e a chave não abre outras rotas', async ({ request, playwright, baseURL }) => {
  const { token } = await (await request.post('/api/health/apple/consent')).json();
  const device = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const headers = { Authorization: `Bearer ${token}` };
    expect((await device.post('/api/health/apple', { data: { samples: [{ type: 'heartRate', start: at(1) }] }, headers })).status()).toBe(400);
    // Passos de hoje ainda vão mudar: não entram; futuro também não.
    expect(await (await device.post('/api/health/apple', { data: { timezone: tz, samples: [{ type: 'steps', start: at(0.1), value: 900 }] }, headers })).json()).toMatchObject({ created: 0 });
    expect(await (await device.post('/api/health/apple', { data: { timezone: tz, samples: [{ type: 'weight', start: new Date(Date.now() + 86_400_000).toISOString(), value: 70 }] }, headers })).json()).toMatchObject({ created: 0, invalid: 1 });
    // A chave do aparelho não substitui a sessão nem cria outra chave: em produção a
    // barreira de login recusa antes (401); sem ela, a própria rota recusa (403).
    expect([401, 403]).toContain((await device.post('/api/health/apple/consent', { headers })).status());
  } finally {
    await device.dispose();
    await request.delete('/api/health/apple/consent');
  }
});

test('Configurações → Integrações liga o Apple Saúde e mostra a chave uma vez', async ({ page, request }) => {
  try {
    await page.goto('/hoje');
    await expect(page.getByRole('button', { name: 'Abrir configurações' })).toBeVisible();
    await expect(async () => {
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'integracoes' } })));
      await expect(page.getByRole('dialog', { name: 'Configurações' })).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    const panel = page.getByRole('region', { name: 'Apple Saúde' });
    await panel.getByRole('button', { name: 'Ligar e gerar chave' }).click();
    await expect(panel.getByText(/^ls_apple_/)).toBeVisible();
    await expect(panel.getByText('ativa', { exact: true })).toBeVisible();
    await expect(panel.getByText(/\/api\/health\/apple$/)).toBeVisible();
  } finally { await request.delete('/api/health/apple/consent'); }
});
