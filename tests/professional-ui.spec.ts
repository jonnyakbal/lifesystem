import { test, expect } from '@playwright/test';

test('área profissional apresenta contexto, metas e revisão em desktop e mobile', async ({ page }) => {
  await page.route('**/api/projects', route => route.fulfill({ json: [{ id: 'synthetic-project', name: 'Observatório comercial', status: 'active' }] }));
  await page.route('**/api/professional?*', route => route.fulfill({ json: { brands: [], projects: { items: [] }, diagnostics: {}, suggestions: [], counts: { projects: 0, works: 0, opportunities: 0, awaitingReview: 0 }, items: [] } }));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/profissional');
    await expect(page.getByRole('heading', { name: 'Seu próximo movimento', exact: true })).toBeVisible();
    await expect(page.getByText(/^Metas · \d+ meses$/)).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar projeto', exact: true }).first().click();
    await expect(page.getByRole('dialog')).toContainText('Projeto profissional');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `../lifesystem-professional-${width}.png` });
  }
});
