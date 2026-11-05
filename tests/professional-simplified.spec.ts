import { test, expect, type Page } from '@playwright/test';

const now = new Date().toISOString();
const later = new Date(Date.now() + 86_400_000).toISOString();
const project = { id: 'p1', name: 'Arco Labs Serviços', status: 'active', openTasks: 2, openWorks: 1, hasNextAction: true, gaps: ['audience', 'milestone'], context: { id: 'c1', kind: 'context', revision: 1, data: { projectId: 'p1', brandId: 'arco-labs', objective: 'Vender pacotes para restaurantes' } } };
const overview = (legacy: Record<string, number>) => ({ brands: [], projects: { items: [project] }, diagnostics: {}, suggestions: [], counts: { projects: 1, works: 1, opportunities: 0, awaitingReview: 0, legacy } });

type MockOptions = { proposal?: Record<string, unknown>; current?: Record<string, unknown>; works?: { id: string; kind: string; revision: number; data: Record<string, unknown> }[]; onSave?: (body: Record<string, unknown>) => void; gate?: Promise<void> };
async function mock(page: Page, legacy: Record<string, number>, options: MockOptions = {}) {
  const kinds: string[] = [];
  const works = (options.works || []).map(item => structuredClone(item));
  await page.route('**/api/projects', route => route.fulfill({ json: [{ id: 'p1', name: 'Arco Labs Serviços', status: 'active' }] }));
  await page.route('**/api/professional', async route => {
    const body = route.request().postDataJSON() as { id: string; data: Record<string, unknown> };
    options.onSave?.(body as unknown as Record<string, unknown>);
    const work = works.find(item => item.id === body.id);
    if (work) { work.revision += 1; work.data = body.data; return route.fulfill({ json: work }); }
    return route.fulfill({ json: { id: body.id, revision: 1, data: body.data } });
  });
  await page.route('**/api/professional?*', async route => {
    const q = new URL(route.request().url()).searchParams;
    if (q.get('view') === 'overview') { if (options.gate) await options.gate; return route.fulfill({ json: overview(legacy) }); }
    if (q.get('view') === 'records') {
      kinds.push(q.get('kind') || '');
      if (q.get('id') && options.current && q.get('id') === options.current.id) return route.fulfill({ json: { items: [options.current], nextCursor: null } });
      if (q.get('kind') === 'work') return route.fulfill({ json: { items: works, nextCursor: null } });
      if (q.get('kind') === 'opportunity') return route.fulfill({ json: { items: [{ id: 'o1', kind: 'opportunity', revision: 2, data: { projectId: 'p1', brandId: 'arco-labs', title: 'Pacote mensal', stage: 'qualified', grossEstimate: 2500 } }], nextCursor: null } });
      return route.fulfill({ json: { items: [], nextCursor: null } });
    }
    if (q.get('view') === 'proposal') return route.fulfill({ json: { items: [{ id: 'pr1', revision: 1, hash: 'a'.repeat(64), kind: 'work', expectedRevision: 0, data: { title: 'Escopo de proposta', projectId: 'p1' }, approvalType: 'work_scope', author: 'sirius', createdAt: now, expiresAt: later }, ...(options.proposal ? [options.proposal] : [])], nextCursor: null } });
    return route.fulfill({ json: { items: [], nextCursor: null } });
  });
  return kinds;
}

test('the professional area shows three plain-language areas and points the CRM to Arco Leads', async ({ page }) => {
  await mock(page, { contact: 0, opportunity: 0, campaign: 0, content: 0 });
  await page.goto('/profissional');
  const nav = page.getByRole('navigation', { name: 'Áreas profissionais' });
  await expect(nav.getByRole('button', { name: 'Visão geral' })).toBeVisible();
  await expect(nav.getByRole('button')).toHaveCount(3);
  await expect(page.getByRole('link', { name: /Abrir Arco Leads/ })).toHaveAttribute('href', 'https://arco.oj0nny.com/');
  await expect(page.getByText('público, próximo marco')).toBeVisible();
  await expect(page.getByText(/adapter|responsible|expectedOutcome/)).toHaveCount(0);

  await nav.getByRole('button', { name: /Aguardando você/ }).click();
  await expect(page.getByText('Escopo de trabalho · Arco Labs Serviços')).toBeVisible();
  await expect(page.getByText('work_scope')).toHaveCount(0);
  await nav.getByRole('button', { name: /Próximos passos/ }).click();
  await expect(page.getByRole('button', { name: 'Novo próximo passo' })).toBeVisible();
});

test('a proposal is reviewed as readable fields with what changes highlighted', async ({ page }) => {
  await mock(page, { contact: 0, opportunity: 0, campaign: 0, content: 0 }, {
    proposal: { id: 'pr2', revision: 1, hash: 'b'.repeat(64), kind: 'work', targetId: 'w1', expectedRevision: 1, data: { projectId: 'p1', brandId: 'arco-labs', title: 'Pesquisar bares', workType: 'agent', brief: 'Bares do centro', artifactKinds: ['research'] }, approvalType: 'record_change', author: 'sirius', createdAt: now, expiresAt: later },
    current: { id: 'w1', kind: 'work', revision: 1, data: { projectId: 'p1', brandId: 'arco-labs', title: 'Pesquisar bares', workType: 'agent', brief: 'Bares da cidade', artifactKinds: ['research'] } },
  });
  await page.goto('/profissional');
  await page.getByRole('navigation', { name: 'Áreas profissionais' }).getByRole('button', { name: /Aguardando você/ }).click();
  await page.getByRole('button', { name: 'Revisar e decidir' }).last().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Quem executa')).toBeVisible();
  await expect(dialog.getByText('Agente', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Pesquisa', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/1 campo muda/)).toBeVisible();
  await expect(dialog.getByText('Bares da cidade')).toBeVisible();
  await expect(dialog.getByText(/"projectId"|record_change/)).toHaveCount(0);
});

test('next steps are grouped by project, show deadline and blocked state, and conclude with undo', async ({ page }) => {
  const saves: Record<string, unknown>[] = [];
  await mock(page, { contact: 0, opportunity: 0, campaign: 0, content: 0 }, {
    works: [
      { id: 'w1', kind: 'work', revision: 3, data: { projectId: 'p1', brandId: 'arco-labs', title: 'Texto da oferta', workType: 'human', dueDate: '2020-01-10', status: 'open' } },
      { id: 'w2', kind: 'work', revision: 1, data: { projectId: 'p1', brandId: 'arco-labs', title: 'Decidir taxa', workType: 'decision', status: 'blocked' } },
    ],
    onSave: body => saves.push(body),
  });
  await page.goto('/profissional');
  await page.getByRole('navigation', { name: 'Áreas profissionais' }).getByRole('button', { name: /Próximos passos/ }).click();
  const group = page.getByRole('region', { name: 'Arco Labs Serviços' });
  await expect(group.getByText('Texto da oferta')).toBeVisible();
  await expect(group.getByText('10/01/2020')).toBeVisible();
  await expect(group.getByText('Bloqueado')).toBeVisible();
  await expect(page.getByText(/versão \d/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Concluir Texto da oferta' }).click();
  await expect(page.getByRole('button', { name: 'Concluir Texto da oferta' })).toHaveCount(0);
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0]).toEqual(expect.objectContaining({ action: 'save', kind: 'work', id: 'w1', expectedRevision: 3, data: expect.objectContaining({ status: 'done' }) }));
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect.poll(() => saves.length).toBe(2);
  expect(saves[1]).toEqual(expect.objectContaining({ id: 'w1', expectedRevision: 4, data: expect.objectContaining({ status: 'open' }) }));
});

test('while loading the page never claims there is nothing to show', async ({ page }) => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await mock(page, { contact: 0, opportunity: 0, campaign: 0, content: 0 }, { gate });
  await page.goto('/profissional');
  await expect(page.getByLabel('Carregando')).toBeVisible();
  await expect(page.getByText('Comece por um projeto')).toHaveCount(0);
  release();
  await expect(page.getByRole('button', { name: 'Editar projeto Arco Labs Serviços' })).toBeVisible();
});

test('older CRM records stay readable, never editable, and nothing is lost', async ({ page }) => {
  const kinds = await mock(page, { contact: 3, opportunity: 1, campaign: 0, content: 2 });
  await page.goto('/profissional');
  await page.getByRole('button', { name: 'Registros antigos 6' }).click();
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
  await expect(page.getByRole('heading', { name: 'Profissional', exact: true, level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
