import { test, expect } from '@playwright/test';
import { financialEntrySchema } from '../src/lib/financial-validation';
import { todayStr } from '../src/lib/utils';

const today = todayStr();
const month = today.slice(0, 7);
const futureMonth = todayStr(
  new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 15)
).slice(0, 7);

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const records = [
    {
      id: 'salary',
      type: 'income',
      category: 'Salário',
      description: 'Projeto Aurora',
      amount: 6400,
      date: `${month}-01`,
      status: 'paid',
      paidDate: `${month}-05`,
    },
    {
      id: 'rent',
      type: 'expense_fixed',
      category: 'Aluguel',
      description: 'Espaço de trabalho',
      amount: 1800,
      date: `${month}-01`,
      dueDate: `${month}-10`,
      status: 'pending',
    },
    {
      id: 'food',
      type: 'expense_variable',
      category: 'Alimentação',
      description: 'Mercado da semana',
      amount: 420,
      date: `${month}-01`,
      paidDate: `${month}-08`,
      status: 'paid',
    },
    {
      id: 'internet',
      type: 'expense_fixed',
      category: 'Internet',
      description: 'Internet do estúdio',
      amount: 120,
      date: today,
      dueDate: `${futureMonth}-15`,
      status: 'pending',
    },
  ];
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === '/api/financial' && method === 'GET')
      return route.fulfill({ json: records });
    if (path === '/api/financial' && method === 'POST') {
      const parsed = financialEntrySchema.safeParse(
        route.request().postDataJSON()
      );
      if (!parsed.success)
        return route.fulfill({
          status: 400,
          json: { error: 'Dados financeiros inválidos.' },
        });
      const record = { id: `created-${records.length}`, ...parsed.data };
      records.push(record as (typeof records)[number]);
      return route.fulfill({ status: 201, json: record });
    }
    if (path.startsWith('/api/financial/')) {
      const index = records.findIndex((r) => path.endsWith(`/${r.id}`));
      if (method === 'DELETE') records.splice(index, 1);
      if (method === 'PATCH')
        records[index] = {
          ...records[index],
          ...route.request().postDataJSON(),
        };
      return route.fulfill({
        json: method === 'PATCH' ? records[index] : { success: true },
      });
    }
    if (path === '/api/accounts')
      return route.fulfill({
        json: [
          {
            id: 'account',
            name: 'Conta de demonstração',
            type: 'checking',
            balance: 2500,
            isActive: true,
            isDefault: true,
            color: '#5cc9b2',
          },
        ],
      });
    return route.fulfill({ json: [] });
  });
});

test('panorama interativo preserva realizado e leva categoria aos lançamentos', async ({
  page,
}) => {
  await page.goto('/financeiro');
  await expect(
    page.getByRole('heading', { name: 'Seu dinheiro, em perspectiva.' })
  ).toBeVisible();
  await expect(page.getByTestId('financial-paid-expenses')).toContainText(
    '420,00'
  );
  await expect(page.getByTestId('financial-planned-expenses')).toContainText(
    '1.800,00'
  );
  await page
    .getByRole('button', { name: 'Ver lançamentos de Alimentação' })
    .click();
  await expect(
    page.getByText('Mercado da semana', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText('Espaço de trabalho', { exact: true })
  ).not.toBeVisible();
});

test('edição escolhe mês do pagamento e desfazer exclusão usa payload válido', async ({
  page,
}) => {
  await page.goto('/financeiro');
  await page.getByRole('button', { name: 'Lançamentos', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Espaço de trabalho' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Pago', exact: true }).click();
  await dialog.getByLabel('Data do pagamento').fill(`${futureMonth}-03`);
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByTestId('financial-period-label')).toContainText(
    new Date(`${futureMonth}-03T12:00:00`).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    })
  );
  await expect(page.getByTestId('financial-paid-expenses')).toContainText(
    '1.800,00'
  );
  await page
    .getByRole('button', { name: 'Opções de Espaço de trabalho' })
    .click();
  await page.getByRole('menuitem', { name: 'Excluir' }).click();
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(page.getByText('Restaurado!', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Espaço de trabalho', { exact: true })
  ).toBeVisible();
});

test('ajusta saldo exato sem criar uma movimentação fictícia', async ({
  page,
}) => {
  await page.goto('/financeiro');
  await page.getByRole('button', { name: 'Contas', exact: true }).click();
  await page
    .getByRole('button', { name: 'Atualizar saldo de Conta de demonstração' })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel('Saldo informado (R$)')
    .fill('2750.45');
  const saved = page.waitForRequest(
    (r) => r.url().endsWith('/api/accounts/account') && r.method() === 'PATCH'
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Salvar saldo' })
    .click();
  expect((await saved).postDataJSON()).toEqual({ balance: 2750.45 });
});

test('panorama e formulário funcionam no celular e teclado', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/financeiro');
  await expect(
    page.getByRole('heading', { name: 'Seu dinheiro, em perspectiva.' })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Novo lançamento', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Valor (R$)')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Novo lançamento', exact: true })
  ).toBeFocused();
  await expect(
    page.getByTestId('financial-flow-chart').locator('.recharts-area-curve')
  ).toBeVisible();
  await expect(page.locator('.recharts-pie-sector').first()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: 'screenshots/financial-redesign-mobile.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1512, height: 1100 });
  await expect
    .poll(
      async () =>
        (await page
          .getByRole('heading', { name: 'Seu dinheiro, em perspectiva.' })
          .boundingBox())!.x
    )
    .toBeGreaterThanOrEqual(250);
  await page.screenshot({
    path: 'screenshots/financial-redesign-desktop.png',
    fullPage: true,
  });
});

test('erro de carregamento não vira um falso saldo zero e permite tentar novamente', async ({
  page,
}) => {
  let broken = true;
  await page.route('**/api/financial', (route) =>
    route.fulfill(
      broken
        ? { status: 500, json: { error: 'Indisponível no teste' } }
        : { json: [] }
    )
  );
  await page.goto('/financeiro');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Não foi possível atualizar' })
  ).toBeVisible();
  await expect(page.getByTestId('financial-paid-expenses')).not.toBeVisible();
  broken = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByTestId('financial-paid-expenses')).toContainText(
    '0,00'
  );
});

test('histórico, previsões e tabela de dados respondem aos controles', async ({
  page,
}) => {
  await page.goto('/financeiro');
  await page.getByText('Ver dados do gráfico', { exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Resultado acumulado em reais' })
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'Incluir previsões' }).uncheck();
  await expect(
    page.getByTestId('financial-flow-chart').locator('.recharts-line-curve')
  ).toHaveCount(0);
  await page.getByRole('button', { name: '6 meses', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Movimentação mensal em reais' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Em aberto', exact: true }).click();
  await page
    .getByRole('button', { name: 'Ver lançamentos de Aluguel' })
    .click();
  await expect(
    page.getByText('Espaço de trabalho', { exact: true })
  ).toBeVisible();
});

test('orçamento fixo é salvo com o tipo correto e no mês selecionado', async ({
  page,
}) => {
  await page.goto('/financeiro');
  await page.getByRole('button', { name: 'Próximo mês' }).click();
  await page
    .getByRole('button', { name: 'Novo orçamento', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Tipo do orçamento' }).click();
  await page.getByRole('option', { name: 'Fixa', exact: true }).click();
  await dialog
    .getByRole('combobox', { name: 'Categoria do orçamento' })
    .click();
  await page.getByRole('option', { name: 'Aluguel', exact: true }).click();
  await dialog.getByLabel('Limite Mensal (R$)').fill('1900');
  const request = page.waitForRequest(
    (r) => r.url().endsWith('/api/budgets') && r.method() === 'POST'
  );
  await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({
    month: futureMonth,
    type: 'expense_fixed',
    category: 'Aluguel',
    monthlyLimit: 1900,
  });
});

test('nova fatura respeita o cartão escolhido e o mês futuro', async ({
  page,
}) => {
  await page.route('**/api/cards', (route) =>
    route.fulfill({
      json: [
        {
          id: 'card-a',
          name: 'Cartão A',
          type: 'credit',
          brand: 'Visa',
          lastDigits: '1234',
          isActive: true,
          closingDay: 31,
          dueDay: 31,
        },
        {
          id: 'card-b',
          name: 'Cartão B',
          type: 'multiple',
          brand: 'Visa',
          lastDigits: '4321',
          isActive: true,
          closingDay: 10,
          dueDay: 20,
        },
      ],
    })
  );
  await page.goto('/financeiro');
  await page.getByRole('button', { name: 'Próximo mês' }).click();
  await page.getByRole('button', { name: 'Faturas', exact: true }).click();
  await page.getByRole('button', { name: 'Nova Fatura', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Cartão de crédito' }).click();
  await page.getByRole('option', { name: 'Cartão B', exact: true }).click();
  const request = page.waitForRequest(
    (r) => r.url().endsWith('/api/bills') && r.method() === 'POST'
  );
  await dialog.getByRole('button', { name: 'Criar fatura' }).click();
  expect((await request).postDataJSON()).toMatchObject({
    cardId: 'card-b',
    month: futureMonth,
    closeDate: `${futureMonth}-10`,
    status: 'open',
  });
});

test('prévia visual com dados sintéticos nos temas claro e escuro', async ({ page }) => {
  await page.route('**/api/financial', route => route.fulfill({ json: [
    { id: 'a', type: 'income', category: 'Serviços', description: 'Projeto Aurora', amount: 6800, status: 'paid', date: `${month}-01`, paidDate: `${month}-03` },
    { id: 'b', type: 'expense_fixed', category: 'Aluguel', amount: 1650, status: 'paid', date: `${month}-05` },
    { id: 'c', type: 'expense_variable', category: 'Alimentação', amount: 850, status: 'paid', date: `${month}-10` },
    { id: 'd', type: 'expense_variable', category: 'Transporte', amount: 260, status: 'paid', date: `${month}-12` },
    { id: 'e', type: 'income', category: 'Serviços', amount: 1400, status: 'paid', date: `${month}-18` },
    { id: 'f', type: 'expense_fixed', category: 'Software', amount: 320, status: 'paid', date: `${month}-21` },
    { id: 'g', type: 'expense_fixed', category: 'Internet', description: 'Internet do estúdio', amount: 180, status: 'pending', date: `${month}-01`, dueDate: `${month}-28` },
    { id: 'h', type: 'income', category: 'Projetos', description: 'Entrega editorial', amount: 2200, status: 'pending', date: `${month}-01`, dueDate: `${month}-29` },
    { id: 'i', type: 'expense_variable', category: 'Saúde', description: 'Consulta de rotina', amount: 450, status: 'pending', date: `${month}-01`, dueDate: `${month}-30` },
  ] }));
  await page.route('**/api/financial-goals', route => route.fulfill({ json: [
    { id: 'goal', name: 'Reserva de tranquilidade', targetAmount: 12000, currentAmount: 7200, status: 'active', icon: '✦' },
  ] }));
  await page.route('**/api/budgets', route => route.fulfill({ json: [
    { id: 'budget', category: 'Alimentação', type: 'expense_variable', month, monthlyLimit: 1200, spent: 0 },
  ] }));
  await page.setViewportSize({ width: 1512, height: 1160 });
  await page.goto('/financeiro');
  await expect(page.getByTestId('financial-flow-chart').locator('.recharts-area-curve')).toBeVisible();
  await expect(page.locator('.recharts-pie-sector')).toHaveCount(4);
  await page.screenshot({ path: 'screenshots/financial-redesign-preview.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await page.getByRole('heading', { name: 'Seu dinheiro, em perspectiva.' }).boundingBox())!.x).toBeLessThan(40);
  await page.screenshot({ path: 'screenshots/financial-redesign-mobile.png', fullPage: true });
  await page.evaluate(() => { document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light'); });
  await page.setViewportSize({ width: 1512, height: 1160 });
  await expect.poll(async () => (await page.getByRole('heading', { name: 'Seu dinheiro, em perspectiva.' }).boundingBox())!.x).toBeGreaterThanOrEqual(250);
  await page.screenshot({ path: 'screenshots/financial-redesign-light.png', fullPage: true });
});
