import { expect, test } from '@playwright/test';
import { debitBillPayment } from '../src/lib/financial-cash';

test('confere saldos, transfere uma vez e quita fatura pela conta escolhida', async ({ request, page }) => {
  async function account(name: string, balance: number) {
    const response = await request.post('/api/accounts', { data: { name, type: 'checking', balance } });
    expect(response.status()).toBe(201);
    return response.json();
  }

  const from = await account('Origem sintética', 100);
  const to = await account('Destino sintético', 23.45);
  expect(from.balanceCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  const data = { id: 'test-transfer-once-23', fromAccountId: from.id, toAccountId: to.id, amount: 12.34 };
  const transfers = await Promise.all([
    request.post('/api/transfers', { data }),
    request.post('/api/transfers', { data }),
  ]);
  expect(transfers.map(response => response.status())).toEqual([200, 200]);
  expect((await request.post('/api/transfers', { data: { ...data, amount: 99 } })).status()).toBe(409);
  expect((await request.post('/api/transfers', { data: { ...data, toAccountId: from.id } })).status()).toBe(400);

  const card = await (await request.post('/api/cards', { data: {
    name: 'Crédito sintético', type: 'credit', brand: 'Visa', lastDigits: '0231',
  } })).json();
  const bill = await (await request.post('/api/bills', { data: {
    cardId: card.id, month: '2026-11', amount: 16.65, paidAmount: 1.64,
    status: 'partial', dueDate: '2026-12-10', closeDate: '2026-11-30',
  } })).json();
  const endpoint = '/api/bills/' + bill.id;
  const payments = await Promise.all([
    request.post(endpoint, { data: { accountId: from.id } }),
    request.post(endpoint, { data: { accountId: from.id } }),
  ]);
  expect(payments.map(response => response.status())).toEqual([200, 200]);
  expect(await payments[0].json()).toMatchObject({ status: 'paid', paidAmount: 16.65, paymentAccountId: from.id });
  expect((await request.post(endpoint, { data: { accountId: to.id } })).status()).toBe(409);
  const accounts = await (await request.get('/api/accounts')).json();
  expect(accounts.find((item: { id: string }) => item.id === from.id)).toMatchObject({
    balance: 72.65, balanceCheckedAt: from.balanceCheckedAt,
  });
  expect(accounts.find((item: { id: string }) => item.id === to.id)).toMatchObject({ balance: 35.79 });
  expect((await request.delete('/api/accounts/' + from.id)).status()).toBe(409);
  expect((await request.delete(endpoint)).status()).toBe(409);
  const history = await (await request.get('/api/transfers')).json();
  expect(history).toEqual(expect.arrayContaining([expect.objectContaining({ ...data })]));

  await page.goto('/financeiro');
  await page.getByRole('button', { name: 'Contas', exact: true }).click();
  await expect(page.getByText('Última conferência', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Transferir entre contas' }).click();
  await expect(page.getByRole('dialog', { name: 'Transferir entre contas' })).toBeVisible();
});

test('retoma uma quitação após o débito ter sido salvo', async ({ request }) => {
  const account = await (await request.post('/api/accounts', { data: {
    name: 'Pagadora de recuperação', type: 'checking', balance: 88.88,
  } })).json();
  const bill = await (await request.post('/api/bills', { data: {
    cardId: 'card-retry-cash', month: '2026-11', amount: 30.29, status: 'closed',
    dueDate: '2026-12-10', closeDate: '2026-11-30',
  } })).json();
  await debitBillPayment(bill.id, account.id, 3029);
  const endpoint = '/api/bills/' + bill.id;
  expect((await request.patch(endpoint, { data: { amount: 40 } })).status()).toBe(409);
  const response = await request.post(endpoint, { data: { accountId: account.id } });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'paid', paidAmount: 30.29 });
  const accounts = await (await request.get('/api/accounts')).json();
  expect(accounts.find((item: { id: string }) => item.id === account.id)).toMatchObject({ balance: 58.59 });
});
