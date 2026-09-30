import { test, expect } from '@playwright/test';

test('área profissional apresenta contexto, metas e revisão em desktop e mobile', async ({ page }) => {
  await page.route('**/api/projects', route => route.fulfill({ json: [{ id: 'synthetic-project', name: 'Observatório comercial', status: 'active' }] }));
  await page.route('**/api/professional?*', route => route.fulfill({ json: { brands: [], projects: { items: [] }, diagnostics: {}, suggestions: [], counts: { projects: 0, works: 0, opportunities: 0, awaitingReview: 0 }, items: [] } }));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/profissional');
    await expect(page.getByRole('heading', { name: 'Seu próximo movimento', exact: true })).toBeVisible();
    await expect(page.getByText('Metas declaradas · 6 meses')).toBeVisible();
    await page.getByRole('button', { name: 'Associar projeto', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Contexto profissional');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `../lifesystem-professional-${width}.png` });
  }
});
