import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/api/stage-configs') ? { stages: [] } : [] }));
  await page.goto('/planejar');
  await page.getByRole('navigation', { name: 'Navegação rápida' }).getByRole('button', { name: 'Captura rápida' }).click();
});

test('falha ao capturar preserva o texto e não anuncia sucesso', async ({ page }) => {
  await page.route('**/api/captures', route => route.fulfill({ status: 500, json: { error: 'Não foi possível salvar a captura.' } }));
  const input = page.getByPlaceholder('Captura rápida (Enter para salvar)...');
  await input.fill('Ideia sintética para revisão');
  await input.press('Enter');
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Não foi possível salvar a captura.');
  await expect(input).toHaveValue('Ideia sintética para revisão');
  await expect(page.getByText('Captura salva!', { exact: true })).toHaveCount(0);
});

test('captura por toque bloqueia repetição enquanto salva e atualiza a fila', async ({ page }) => {
  let writes = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/captures', async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: writes ? [{ id: 'synthetic-capture', status: 'inbox' }] : [] });
    writes++;
    await pending;
    await route.fulfill({ status: 201, json: { id: 'synthetic-capture', content: 'Ideia por toque' } });
  });
  const input = page.getByPlaceholder('Captura rápida (Enter para salvar)...');
  await input.fill('Ideia por toque');
  const save = page.getByRole('button', { name: 'Salvar captura', exact: true });
  await save.click();
  await expect(save).toBeDisabled();
  await expect(input).toBeDisabled();
  expect(writes).toBe(1);
  release();
  await expect(page.getByText('Captura salva!', { exact: true })).toBeVisible();
  await expect(input).toHaveValue('');
  await expect(input).toBeEnabled();
  await expect(page.getByLabel('1 capturas aguardando triagem')).toBeVisible();
  await input.fill('Próxima ideia');
  await expect(save).toBeEnabled();
  expect(writes).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
