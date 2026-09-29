import { test, expect } from '@playwright/test';
import { financialEntrySchema } from '../src/lib/financial-validation';

for (const frequency of ['none', 'monthly']) {
  test(`lançamento ${frequency} envia recorrência aceita pela API`, async ({ page }) => {
    await page.route('**/api/financial', async route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: [] });
      const parsed = financialEntrySchema.safeParse(route.request().postDataJSON());
      await route.fulfill({ status: parsed.success ? 201 : 400, json: parsed.success ? { id: 'test', ...parsed.data } : { error: 'Dados financeiros inválidos.' } });
    });
    await page.goto('/financeiro');
    const form = page.locator('form').filter({ hasText: 'Novo Lançamento' });
    await form.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'Alimentação', exact: true }).click();
    await form.getByPlaceholder('0,00', { exact: true }).fill('1000');
    if (frequency === 'monthly') {
      const details = form.getByText('Mais detalhes', { exact: true });
      if (await details.count()) await details.click();
      await form.getByRole('combobox').last().click();
      await page.getByRole('option', { name: 'Mensal', exact: true }).click();
    }
    const response = page.waitForResponse(r => r.url().endsWith('/api/financial') && r.request().method() === 'POST');
    await form.getByRole('button', { name: /Adicionar|Salvar lançamento/ }).click();
    const result = await response;
    expect(result.status()).toBe(201);
    const body = result.request().postDataJSON();
    expect(body.recurring).toBe(frequency !== 'none');
    expect(body.recurringFrequency).toBe(frequency === 'none' ? undefined : frequency);
    await expect(page.getByText('Lançamento adicionado!', { exact: true })).toBeVisible();
  });
}

test('formulário móvel mantém detalhes opcionais recolhidos e campos acessíveis', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/financeiro');
  const form = page.getByRole('form', { name: 'Novo Lançamento' });
  await expect(form.getByLabel('Valor (R$)')).toBeVisible();
  await expect(form.getByLabel('Vencimento · opcional')).toBeVisible();
  await form.getByText('Mais detalhes', { exact: true }).click();
  await expect(form.getByLabel('Pessoa ou empresa · opcional')).toBeVisible();
  const box = await form.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await form.getByText('Mais detalhes', { exact: true }).click();
  await form.screenshot({ path: 'screenshots/financial-form-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await form.screenshot({ path: 'screenshots/financial-form-desktop.png' });
});

test('navega por meses vazios e pela virada do ano', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date('2026-12-15T12:00:00Z') });
  await page.route('**/api/financial', route => route.fulfill({ json: [] }));
  await page.goto('/financeiro');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByTestId('financial-period-label')).toContainText('dezembro de 2026');
  await page.getByRole('button', { name: 'Próximo mês' }).click();
  await expect(page.getByTestId('financial-period-label')).toContainText('janeiro de 2027');
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await expect(page.getByTestId('financial-period-label')).toContainText('novembro de 2026');
  await page.getByRole('button', { name: 'Mês atual' }).click();
  await expect(page.getByTestId('financial-period-label')).toContainText('dezembro de 2026');
  await page.getByRole('button', { name: 'Lançamentos' }).click();
  await expect(page.getByText('Nenhum lançamento')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'screenshots/financial-future-month-mobile.png', fullPage: true });
});

test('despesa prevista de outro mês não soma como pagamento', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-28T12:00:00Z') });
  const records: Record<string, unknown>[] = [];
  await page.route('**/api/financial', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: records });
    const data = route.request().postDataJSON();
    records.push({ id: 'future-entry', ...data });
    return route.fulfill({ status: 201, json: records[0] });
  });
  await page.goto('/financeiro');
  await expect(page.getByTestId('financial-period-label')).toContainText('setembro de 2026');
  const form = page.getByRole('form', { name: 'Novo Lançamento' });
  await form.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: 'Alimentação', exact: true }).click();
  await form.getByLabel('Valor (R$)').fill('200');
  await form.getByLabel('Vencimento · opcional').fill('2026-10-15');
  await form.getByRole('button', { name: 'Salvar lançamento' }).click();
  expect(records[0]).toMatchObject({ date: '2026-09-28', dueDate: '2026-10-15', status: 'pending', amount: 200 });
  expect(records[0].paidDate).toBeUndefined();
  await expect(page.getByTestId('financial-period-label')).toContainText('outubro de 2026');
  await expect(page.getByTestId('financial-paid-expenses')).toContainText('R$ 0');
  await expect(page.getByTestId('financial-planned-expenses')).toContainText('R$ 200');
});
