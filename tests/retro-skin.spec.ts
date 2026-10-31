import { expect, test } from '@playwright/test';

test('visual Retrô liga pelo menu, troca os ícones e sobrevive ao recarregar', async ({ page }) => {
  await page.goto('/hoje');
  await page.evaluate(() => localStorage.removeItem('lifesystem-skin'));
  await page.reload();
  const html = page.locator('html');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  const toggle = page.getByRole('complementary').getByRole('button', { name: 'Alternar visual retrô' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(nav.locator('.skin-retro-only').first()).toBeHidden();

  await expect(async () => { await toggle.click(); await expect(html).toHaveAttribute('data-skin', 'retro', { timeout: 1000 }); }).toPass({ timeout: 15000 });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(nav.locator('.skin-retro-only').first()).toBeVisible();
  await expect(nav.locator('.skin-astral-only').first()).toBeHidden();

  // O script do layout aplica o visual salvo antes da hidratação.
  await page.reload();
  await expect(html).toHaveAttribute('data-skin', 'retro');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('h1')!).fontFamily)).toContain('Pixelify');

  await toggle.click();
  await expect(html).toHaveAttribute('data-skin', 'astral');
  await expect(nav.locator('.skin-astral-only').first()).toBeVisible();
});
