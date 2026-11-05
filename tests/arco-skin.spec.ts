import { expect, test } from '@playwright/test';

test('visual Arco liga em Configurações, troca as fontes e sobrevive ao recarregar', async ({ page }) => {
  await page.goto('/hoje');
  await page.evaluate(() => localStorage.removeItem('lifesystem-skin'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Abrir configurações' })).toBeVisible();
  await expect(async () => {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'aparencia' } })));
    await expect(page.getByRole('dialog', { name: 'Configurações' })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await page.getByRole('dialog').getByRole('button', { name: 'Arco', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'arco');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'arco');
  const fonts = await page.evaluate(() => ({ title: getComputedStyle(document.querySelector('h1')!).fontFamily, body: getComputedStyle(document.body).fontFamily }));
  expect(fonts.title).toContain('Bricolage Grotesque');
  expect(fonts.body).toContain('Space Grotesk');
  await page.evaluate(() => localStorage.removeItem('lifesystem-skin'));
});
