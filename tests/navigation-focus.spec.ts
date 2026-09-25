import { test, expect } from '@playwright/test';

test('o ciclo principal fica visível e os módulos complementares continuam acessíveis', async ({ page }) => {
  await page.goto('/planejar');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav.getByRole('link', { name: 'Planejar' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Financeiro' })).toHaveCount(0);
  await nav.getByRole('button', { name: 'Mais áreas' }).click();
  await expect(nav.getByRole('link', { name: 'Financeiro' })).toBeVisible();
  await nav.getByRole('link', { name: 'Financeiro' }).click();
  await expect(page).toHaveURL(/\/financeiro$/);
  await expect(nav.getByRole('link', { name: 'Financeiro' })).toBeVisible();
});

test('mobile oferece captura, entrada e planejamento na primeira camada', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/planejar');
  const dock = page.getByRole('navigation', { name: 'Navegação rápida' });
  await expect(dock.getByRole('link', { name: 'Caixa de entrada' })).toBeVisible();
  await expect(dock.getByRole('link', { name: 'Planejar' })).toBeVisible();
  await expect(dock.getByRole('button', { name: 'Captura rápida' })).toBeVisible();
});
