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
  await expect(form.getByLabel('Vencimento · opcional')).not.toBeVisible();
  await form.getByText('Mais detalhes', { exact: true }).click();
  await expect(form.getByLabel('Vencimento · opcional')).toBeVisible();
  await expect(form.getByLabel('Pessoa ou empresa · opcional')).toBeVisible();
  const box = await form.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await form.getByText('Mais detalhes', { exact: true }).click();
  await form.screenshot({ path: 'screenshots/financial-form-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await form.screenshot({ path: 'screenshots/financial-form-desktop.png' });
});
