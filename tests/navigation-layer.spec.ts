import { expect, test } from '@playwright/test';

test('desktop organiza destinos por percurso e mantém o grupo da rota aberto', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/tarefas');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });

  await expect(nav.getByRole('button', { name: 'Construir' })).toHaveAttribute('aria-expanded', 'true');
  await expect(nav.getByRole('link', { name: 'Tarefas', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Financeiro', exact: true })).toHaveCount(0);

  await nav.getByRole('button', { name: 'Cultivar' }).click();
  await nav.getByRole('link', { name: 'Financeiro', exact: true }).click();
  await expect(page).toHaveURL(/\/financeiro$/);
  await expect(nav.getByRole('button', { name: 'Cultivar' })).toHaveAttribute('aria-expanded', 'true');
  await expect(nav.getByRole('link', { name: 'Financeiro', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Meu espaço', exact: true })).toHaveAttribute('href', '/');
  await expect(page.getByText('Clareza também é uma forma de cuidado.', { exact: true })).toBeVisible();
  await page.screenshot({ path: '../lifesystem-navigation-desktop-local.png', animations: 'disabled' });
});

test('mobile oferece destinos cotidianos, captura e menu agrupado sem transbordar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/inbox');
  const dock = page.getByRole('navigation', { name: 'Navegação rápida' });
  for (const label of ['Início', 'Hoje', 'Caixa de entrada', 'Planejar']) {
    await expect(dock.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await expect(dock.getByRole('button', { name: 'Captura rápida' })).toBeVisible();
  await page.screenshot({ path: '../lifesystem-navigation-mobile-local.png', animations: 'disabled' });
  await dock.getByRole('button', { name: 'Abrir todas as telas' }).click();
  const allDestinations = page.getByRole('navigation', { name: 'Todos os destinos' });
  await allDestinations.getByRole('button', { name: 'Cultivar' }).click();
  await allDestinations.getByRole('link', { name: 'Diário', exact: true }).click();
  await expect(page).toHaveURL(/\/diario$/);
  await expect(page.getByRole('dialog', { name: 'Explore seu espaço' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('hero oferece caminhos pertinentes entre áreas com links nativos', async ({ page }) => {
  await page.goto('/notas');
  const hero = page.locator('.work-heading').first();
  await expect(hero.getByRole('navigation', { name: 'Continue pelo seu espaço' }).getByRole('link', { name: 'Fontes' })).toHaveAttribute('href', '/content-hub');
  await expect(hero.getByRole('navigation', { name: 'Continue pelo seu espaço' }).getByRole('link', { name: 'Visão' })).toHaveAttribute('href', '/visao');
  await page.screenshot({ path: '../lifesystem-navigation-hero-local.png', animations: 'disabled' });
  await hero.getByRole('link', { name: 'Fontes' }).click();
  await expect(page).toHaveURL(/\/content-hub$/);
  await expect(page.getByRole('heading', { name: 'Fontes & Refs' })).toBeVisible();
});
