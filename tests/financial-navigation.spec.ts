import { expect, test } from '@playwright/test';
import { todayStr } from '../src/lib/utils';

const today = todayStr();
const accounts = [
  { id: 'checking', name: 'Conta de teste', balance: 4100, isActive: true, type: 'checking' },
  { id: 'overdrawn', name: 'Conta digital', balance: -150, isActive: true, type: 'digital' },
  { id: 'inactive', name: 'Conta inativa', balance: 7100, isActive: false, type: 'checking' },
];
const sampleCard = {
  id: 'credit', name: 'Cartão de teste', type: 'multiple', brand: 'Visa', lastDigits: '0215',
  limit: 2000, closingDay: 12, dueDay: 26, isActive: true, accountId: 'checking', color: '#52677a',
};
const entries = [
  { id: 'one', type: 'expense_variable', category: 'Alimentação', description: 'Compra de teste',
    amount: 20, date: today, status: 'pending', cardId: 'credit', accountId: 'checking', billMonth: today.slice(0, 7) },
  { id: 'two', type: 'income', category: 'Salário', description: 'Receita de teste',
    amount: 90, date: today, status: 'paid', accountId: 'overdrawn' },
];

test.beforeEach(async ({ page }) => {
  let card = { ...sampleCard };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/api/accounts') return route.fulfill({ json: accounts });
    if (pathname === '/api/cards') return route.fulfill({ json: [card] });
    if (pathname === '/api/financial') return route.fulfill({ json: entries });
    if (pathname === '/api/cards/credit' && route.request().method() === 'PATCH') {
      card = { ...card, ...route.request().postDataJSON() };
      return route.fulfill({ json: card });
    }
    return route.fulfill({ json: [] });
  });
});

test('saldo agregado das contas ativas é independente do período', async ({ page }) => {
  await page.goto('/financeiro');
  const balance = page.getByTestId('financial-account-balance');
  await expect(balance).toContainText('3.950,00');
  await expect(page.getByTestId('financial-realized-result')).toContainText('90,00');
  await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
  await expect(balance).toContainText('3.950,00');
  await expect(page.getByTestId('financial-realized-result')).toContainText('0,00');
  await page.getByRole('button', { name: 'Ver contas e saldos' }).click();
  await expect(page.getByRole('heading', { name: 'Conta de teste' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Conta inativa' })).toBeVisible();
});

test('edita um cartão múltiplo na mesma área das faturas', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/financeiro');
  await page.getByRole('button', { name: 'Cartões e faturas', exact: true }).click();
  await expect(page.getByText('Compras nesta fatura (1)')).toBeVisible();
  await page.getByRole('button', { name: 'Editar cartão Cartão de teste' }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar cartão' });
  await expect(dialog.getByLabel('Nome')).toHaveValue('Cartão de teste');
  await expect(dialog.getByLabel('Limite (R$)')).toHaveValue('2000');
  await page.screenshot({ path: testInfo.outputPath('editar-cartao-mobile.png') });
  await dialog.getByLabel('Nome').fill('Cartão editado');
  await dialog.getByLabel('Dia de fechamento').fill('15');
  const saved = page.waitForRequest((request) => request.url().endsWith('/api/cards/credit') && request.method() === 'PATCH');
  await dialog.getByRole('button', { name: 'Salvar cartão' }).click();
  expect((await saved).postDataJSON()).toMatchObject({ name: 'Cartão editado', closingDay: 15, type: 'multiple' });
  await expect(page.getByRole('heading', { name: 'Cartão editado' })).toBeVisible();
  await expect(page.getByText('Compras nesta fatura (1)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar cartão Cartão editado' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('combina filtros de conta e cartão e permite limpar a busca', async ({ page }) => {
  await page.goto('/financeiro');
  await page.getByRole('button', { name: 'Lançamentos', exact: true }).click();
  await page.getByRole('combobox', { name: 'Conta dos lançamentos' }).click();
  await page.getByRole('option', { name: 'Conta de teste', exact: true }).click();
  await page.getByRole('combobox', { name: 'Cartão dos lançamentos' }).click();
  await page.getByRole('option', { name: 'Cartão de teste', exact: true }).click();
  await expect(page.getByText('Compra de teste', { exact: true })).toBeVisible();
  await expect(page.getByText('Receita de teste', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).first().click();
  await expect(page.getByText('Receita de teste', { exact: true })).toBeVisible();
});

test('API permite remover campos opcionais sem sobrescrever os demais', async ({ request }) => {
  const create = await request.post('/api/cards', {
    data: { name: 'Cartão API de teste', type: 'credit', brand: 'Visa', lastDigits: '0701',
      limit: 950, closingDay: 5, dueDay: 26, accountId: 'account-api-test' },
  });
  expect(create.ok()).toBe(true);
  const { id } = await create.json();
  const save = await request.patch('/api/cards/' + id, {
    data: { limit: null, closingDay: 18, accountId: null },
  });
  expect(save.ok()).toBe(true);
  const list = await request.get('/api/cards');
  expect(list.ok()).toBe(true);
  const cards = await list.json();
  const saved = cards.find((card: { id: string }) => card.id === id);
  expect(saved).toMatchObject({ name: 'Cartão API de teste', closingDay: 18, dueDay: 26, lastDigits: '0701' });
  expect(saved).not.toHaveProperty('limit');
  expect(saved).not.toHaveProperty('accountId');
});
