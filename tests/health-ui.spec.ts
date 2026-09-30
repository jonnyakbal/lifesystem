import { test, expect } from '@playwright/test';

test('Corpo e saúde oferece histórico, registro datado e revisão em desktop e mobile', async ({ page }) => {
  const observation = { id: '11cae954-0787-47eb-9632-d37423da9dad', revision: 1, data: { type: 'water', ml: 350, observedAt: '2026-09-30T11:00:00-03:00', timezone: 'America/Sao_Paulo' }, observedAt: '2026-09-30T11:00:00-03:00', recordedAt: '2026-09-30T14:00:00.000Z', actor: 'owner', durationMinutes: null, versions: [] };
  await page.route('**/api/health?view=observations*', route => route.fulfill({ json: { items: [observation], nextCursor: null } }));
  await page.route('**/api/health?view=proposals*', route => route.fulfill({ json: { items: [{ id: 'a51f04e8-54b0-4fca-b043-1acf0bf80723', revision: 1, hash: 'a'.repeat(64), actor: 'orion', createdAt: '2026-09-30T14:00:00Z', expiresAt: '2099-01-01T00:00:00Z', input: { operation: 'context', context: { profile: null, objectives: ['Mover o corpo com regularidade'], preferences: [], routines: [], limitations: null, equipment: null, healthPillarIds: [] }, expectedRevision: 0, idempotencyKey: 'proposal-context-001' } }] } }));
  await page.route('**/api/health?view=summary*', route => route.fulfill({ json: { counts: { sleep: 0, weight: 0, water: 1, meal: 0, movement: 0, energy: 0, stress: 0 }, waterMl: 350, sleepMinutes: 0, averageEnergy: null, averageStress: null, averageWeightKg: null, coverage: { observedDays: 1, missingMeansUnknown: true } } }));
  await page.route('**/api/health?view=context*', route => route.fulfill({ json: { id: 'health-context', revision: 0, data: { profile: null, objectives: [], preferences: [], routines: [], limitations: null, equipment: null, healthPillarIds: [] }, reviewedAt: null, actor: null, unknown: ['profile'] } }));
  await page.route('**/api/pillars', route => route.fulfill({ json: [{ id: '11cae954-0787-47eb-9632-d37423da9dad', name: 'Corpo', icon: '💪' }] }));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/corpo');
    await expect(page.getByRole('heading', { name: 'Corpo & saúde' })).toBeVisible();
    await expect(page.getByLabel('Histórico de saúde').getByText('350 ml')).toBeVisible();
    await expect(page.getByText('Água', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Novo contexto')).toBeVisible();
    await expect(page.getByText('Objetivos: Mover o corpo com regularidade')).toBeVisible();
    await page.getByRole('button', { name: 'Registrar observação' }).click();
    await expect(page.getByRole('dialog')).toContainText('Quando você observou?');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Editar contexto' }).click();
    await expect(page.getByRole('dialog')).toContainText('Pilares cujas tarefas entram no resumo diário');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
