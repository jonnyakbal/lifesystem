import { test, expect, type Page } from '@playwright/test';

const now = new Date().toISOString();
const later = new Date(Date.now() + 86_400_000).toISOString();
const project = { id: 'p1', name: 'Arco Labs Serviços', status: 'active', openTasks: 2, openWorks: 1, hasNextAction: true, gaps: ['audience', 'milestone'], context: { id: 'c1', kind: 'context', revision: 1, data: { projectId: 'p1', brandId: 'arco-labs', objective: 'Vender pacotes para restaurantes' } } };
const overview = (legacy: Record<string, number>) => ({ brands: [], projects: { items: [project] }, diagnostics: {}, suggestions: [], counts: { projects: 1, works: 1, opportunities: 0, awaitingReview: 0, legacy } });

async function mock(page: Page, legacy: Record<string, number>) {
  const kinds: string[] = [];
  await page.route('**/api/projects', route => route.fulfill({ json: [{ id: 'p1', name: 'Arco Labs Serviços', status: 'active' }] }));
  await page.route('**/api/professional?*', route => {
    const q = new URL(route.request().url()).searchParams;
    if (q.get('view') === 'overview') return route.fulfill({ json: overview(legacy) });
    if (q.get('view') === 'records') {
      kinds.push(q.get('kind') || '');
      if (q.get('kind') === 'opportunity') return route.fulfill({ json: { items: [{ id: 'o1', kind: 'opportunity', revision: 2, data: { projectId: 'p1', brandId: 'arco-labs', title: 'Pacote mensal', stage: 'qualified', grossEstimate: 2500 } }], nextCursor: null } });
      return route.fulfill({ json: { items: [], nextCursor: null } });
    }
    if (q.get('view') === 'proposal') return route.fulfill({ json: { items: [{ id: 'pr1', revision: 1, hash: 'a'.repeat(64), kind: 'work', expectedRevision: 0, data: { title: 'Escopo de proposta', projectId: 'p1' }, approvalType: 'work_scope', author: 'sirius', createdAt: now, expiresAt: later }], nextCursor: null } });
    return route.fulfill({ json: { items: [], nextCursor: null } });
  });
  return kinds;
}

test('the professional area shows three plain-language areas and points the CRM to Arco Leads', async ({ page }) => {
  await mock(page, { contact: 0, opportunity: 0, campaign: 0, content: 0 });
  await page.goto('/profissional');
  const nav = page.getByRole('navigation', { name: 'Áreas profissionais' });
  await expect(nav.getByRole('button')).toHaveText(['Visão geral', 'Próximos passos', 'Aguardando você']);
  await expect(page.getByRole('link', { name: /Abrir Arco Leads/ })).toHaveAttribute('href', 'https://arco.oj0nny.com/');
  await expect(page.getByText('Falta informar: público, próximo marco.')).toBeVisible();
  await expect(page.getByText(/adapter|responsible|expectedOutcome/)).toHaveCount(0);

  await nav.getByRole('button', { name: 'Aguardando você' }).click();
  await expect(page.getByText('Escopo de trabalho · versão 1')).toBeVisible();
  await expect(page.getByText('work_scope')).toHaveCount(0);
  await nav.getByRole('button', { name: 'Próximos passos' }).click();
  await expect(page.getByRole('button', { name: 'Novo próximo passo' })).toBeVisible();
});

test('older CRM records stay readable, never editable, and nothing is lost', async ({ page }) => {
  const kinds = await mock(page, { contact: 3, opportunity: 1, campaign: 0, content: 2 });
  await page.goto('/profissional');
  await page.getByRole('button', { name: 'Registros antigos (6)' }).click();
  await expect(page.getByText(/Nada foi apagado/)).toBeVisible();
  await page.getByRole('button', { name: 'Oportunidades (1)' }).click();
  await expect(page.getByText('Etapa: Qualificado')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
  expect(kinds).toContain('contact');
  expect(kinds).toContain('opportunity');
});

test('semester goals are editable, persisted and protected against stale edits', async ({ page }) => {
  await page.request.post('/api/login', { data: { user: 'office-test', password: 'office-ui-test-only' } });
  const first = await (await page.request.get('/api/professional/goals')).json();
  expect(first).toEqual(expect.objectContaining({ months: expect.any(Number), revision: expect.any(Number) }));
  await page.goto('/profissional');
  await page.getByRole('button', { name: 'Editar metas' }).click();
  await page.getByLabel('Faturamento bruto (R$)').fill('60000');
  await page.getByLabel('Líquido para investir (R$)').fill('20000');
  await page.getByLabel('Meses').fill('6');
  await page.getByRole('button', { name: 'Salvar metas' }).click();
  await expect(page.getByText('R$ 60 mil')).toBeVisible();
  const saved = await (await page.request.get('/api/professional/goals')).json();
  expect(saved).toEqual(expect.objectContaining({ gross: 60000, invest: 20000, revision: first.revision + 1 }));
  const stale = await page.request.put('/api/professional/goals', { data: { gross: 1, invest: 1, months: 6, expectedRevision: first.revision } });
  expect(stale.status()).toBe(409);
  expect((await (await page.request.get('/api/professional/goals')).json()).gross).toBe(60000);
});

test('the simplified area fits a phone without horizontal scrolling', async ({ page }) => {
  await mock(page, { contact: 1, opportunity: 0, campaign: 0, content: 0 });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/profissional');
  await expect(page.getByRole('heading', { name: 'Seu próximo movimento' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
