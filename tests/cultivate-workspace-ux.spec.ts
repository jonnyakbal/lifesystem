import { expect, test } from '@playwright/test';
import { indicatorPayloadSchema, journalPayloadSchema } from '../src/lib/validation';

const pillars = [
  { id: 'body', name: 'Corpo', icon: '💪', color: 'critical', sortOrder: 1, description: 'Cuidar do corpo', currentStatus: '', target: '' },
  { id: 'mind', name: 'Mente', icon: '🧠', color: 'qty', sortOrder: 2, description: 'Aprender com intenção', currentStatus: '', target: '' },
];

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.clock.setFixedTime(new Date('2026-09-30T15:00:00-03:00'));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path === '/api/pillars' ? pillars : path === '/api/stage-configs' ? { stages: [] } : [] });
  });
});

test('diário carrega a entrada inicial e muda exatamente um dia por toque', async ({ page }) => {
  await page.route('**/api/journal', route => route.fulfill({ json: [
    { id: 'entry-today', entryDate: '2026-09-30', content: '<p>Reflexão sintética existente</p>', gratitude: '', mood: 'good', pillarChecks: { body: 4 } },
    { id: 'entry-yesterday', entryDate: '2026-09-29', content: '<p>Reflexão sintética de ontem</p>', gratitude: '', mood: 'neutral', pillarChecks: {} },
  ] }));
  await page.goto('/diario');
  await expect(page.locator('.tiptap').first()).toContainText('Reflexão sintética existente');
  await expect(page.getByRole('button', { name: 'Corpo: 4 de 5' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Dia anterior' }).click();
  await expect(page.locator('.tiptap').first()).toContainText('Reflexão sintética de ontem');
  await page.getByRole('button', { name: 'Próximo dia' }).click();
  await expect(page.locator('.tiptap').first()).toContainText('Reflexão sintética existente');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('pilar expande com teclado e liga às metas da área selecionada', async ({ page }) => {
  await page.goto('/visao?tab=pilares');
  const expand = page.getByRole('button', { name: 'Detalhes de Corpo' });
  await expand.focus();
  await page.keyboard.press('Enter');
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('link', { name: 'Ver metas de Corpo' })).toHaveAttribute('href', '/indicadores?pillar=body');
});

test('diário abre uma data válida e rejeita uma data impossível no link', async ({ page }) => {
  await page.route('**/api/journal', route => route.fulfill({ json: [
    { id: 'entry-deeplink', entryDate: '2026-08-12', content: '<p>Reflexão sintética de agosto</p>', gratitude: '', mood: 'good', pillarChecks: {} },
  ] }));
  await page.goto('/diario?date=2026-08-12');
  await expect(page.locator('.tiptap').first()).toContainText('Reflexão sintética de agosto');
  await expect(page.getByRole('button', { name: '12 de agosto de 2026, com registro' })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/diario?date=2026-02-31');
  await expect(page.getByRole('button', { name: '30 de setembro de 2026', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('meta criada a partir do pilar conserva o vínculo e falha preserva o formulário', async ({ page }) => {
  await page.goto('/indicadores?pillar=mind');
  await page.getByRole('button', { name: 'Criar meta para Mente' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox').first()).toContainText('Mente');
  await dialog.getByLabel('Nome').fill('Leitura sintética');
  let body: Record<string, unknown> = {};
  await page.route('**/api/indicators', async route => {
    if (route.request().method() === 'POST') {
      body = route.request().postDataJSON();
      return route.fulfill({ status: 500, json: { error: 'Não foi possível salvar a meta.' } });
    }
    return route.fulfill({ json: [] });
  });
  await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Nome')).toHaveValue('Leitura sintética');
  await expect(page.getByText('Não foi possível salvar a meta.', { exact: true })).toBeVisible();
  expect(body.pillarId).toBe('mind');
});

for (const [label, expectedFrequency] of [['Diário', 'daily'], ['Semanal', 'weekly'], ['Mensal', 'monthly']]) {
  test(`meta criada com frequência ${label} envia o valor aceito pela API`, async ({ page }) => {
    let created: Record<string, unknown> | undefined;
    await page.route('**/api/indicators', route => {
      if (route.request().method() === 'POST') {
        const parsed = indicatorPayloadSchema.safeParse(route.request().postDataJSON());
        if (!parsed.success) return route.fulfill({ status: 400, json: { error: 'Dados do indicador inválidos' } });
        created = { ...parsed.data, id: 'created-goal' };
        return route.fulfill({ status: 201, json: created });
      }
      return route.fulfill({ json: created ? [created] : [] });
    });
    await page.goto('/indicadores?pillar=mind');
    await page.getByRole('button', { name: 'Criar meta para Mente' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome').fill(`Leitura sintética ${label}`);
    await dialog.getByLabel('Frequência').click();
    await page.getByRole('option', { name: label, exact: true }).click();
    await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Editar meta Leitura sintética ${label}` })).toBeVisible();
    await expect(page.getByText('Indicador criado!', { exact: true })).toBeVisible();
    expect(created?.frequency).toBe(expectedFrequency);
    expect(created?.pillarId).toBe('mind');
  });
}

test('meta legada mantém a frequência em português e normaliza somente ao salvar', async ({ page }) => {
  let indicator: Record<string, unknown> = { id: 'legacy-goal', pillarId: 'mind', name: 'Estudo sintético', type: 'count', currentValue: 1, frequency: 'Semanal', history: [] };
  let writes = 0;
  await page.route('**/api/indicators**', route => {
    if (route.request().method() === 'PATCH') {
      writes++;
      const parsed = indicatorPayloadSchema.safeParse(route.request().postDataJSON());
      if (!parsed.success) return route.fulfill({ status: 400, json: { error: 'Dados do indicador inválidos' } });
      indicator = { ...indicator, ...parsed.data };
      return route.fulfill({ json: indicator });
    }
    return route.fulfill({ json: [indicator] });
  });
  await page.goto('/indicadores?pillar=mind');
  await page.getByRole('button', { name: 'Editar meta Estudo sintético' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Frequência')).toContainText('Semanal');
  expect(writes).toBe(0);
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toBe(1);
  expect(indicator.frequency).toBe('weekly');
  await expect(page.getByText('Semanal', { exact: true })).toBeVisible();
});

for (const clearExisting of [false, true]) {
  test(`diário salva sem humor ${clearExisting ? 'após desmarcar o humor salvo' : 'em uma nova entrada'}`, async ({ page }) => {
    let entry: Record<string, unknown> | undefined = clearExisting ? { id: 'journal-existing', entryDate: '2026-09-30', content: '<p>Reflexão sintética</p>', gratitude: '', mood: 'good', pillarChecks: {} } : undefined;
    let body: Record<string, unknown> | undefined;
    await page.route('**/api/journal', route => {
      if (route.request().method() === 'POST') {
        body = route.request().postDataJSON();
        const parsed = journalPayloadSchema.safeParse(body);
        if (!parsed.success) return route.fulfill({ status: 400, json: { error: 'Dados do diário inválidos' } });
        entry = { ...parsed.data, id: 'journal-saved' };
        return route.fulfill({ status: 201, json: entry });
      }
      return route.fulfill({ json: entry ? [entry] : [] });
    });
    await page.goto('/diario');
    const save = page.getByRole('button', { name: 'Salvar', exact: true });
    await expect(save).toBeEnabled();
    if (clearExisting) {
      const mood = page.getByRole('button', { name: /Bom/ });
      await expect(mood).toHaveAttribute('aria-pressed', 'true');
      await mood.click();
      await expect(mood).toHaveAttribute('aria-pressed', 'false');
    }
    await save.click();
    await expect(page.getByText('Diário salvo!', { exact: true })).toBeVisible();
    expect(body).not.toHaveProperty('mood');
    await expect(page.getByRole('button', { name: /Bom/ })).toHaveAttribute('aria-pressed', 'false');
  });
}
