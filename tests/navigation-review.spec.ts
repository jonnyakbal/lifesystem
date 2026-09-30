import { expect, test } from '@playwright/test';

test('Pilares é apresentado como aba de Visão, sem uma segunda rota no menu', async ({ page }) => {
  await page.goto('/visao?tab=pilares');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav.getByRole('button', { name: 'Cultivar' })).toHaveAttribute('aria-expanded', 'true');
  await expect(nav.getByRole('link', { name: 'Visão', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Pilares', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Pilares' })).toBeVisible();
});

test('Fontes não repete o destino Notas no mesmo hero', async ({ page }) => {
  await page.goto('/content-hub');
  await expect(page.locator('.work-heading').locator('a[href="/notas"]')).toHaveCount(1);
});

test('revisão aberta dentro da Inbox não sugere abrir outra revisão', async ({ page }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: /Revisar a semana|Revisão em dia/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Revisão Semanal' });
  await expect(dialog.getByRole('heading', { name: 'Revisão Semanal', level: 1 })).toBeVisible();
  await expect(dialog.getByRole('navigation', { name: 'Continue pelo seu espaço' })).toHaveCount(0);
});

test('Financeiro mostra o próximo caminho definido para Planejar', async ({ page }) => {
  await page.goto('/financeiro');
  await expect(page.getByRole('navigation', { name: 'Continue pelo seu espaço' }).getByRole('link', { name: 'Planejar' })).toHaveAttribute('href', '/planejar');
  await page.addStyleTag({ content: 'nextjs-portal { display: none; }' });
  await page.screenshot({ path: '../lifesystem-navigation-finance-local.png', animations: 'disabled' });
});
