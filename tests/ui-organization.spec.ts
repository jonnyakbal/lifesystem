import { expect, test } from '@playwright/test';

test('controles secundários de tarefas ficam acessíveis sem ocupar a primeira tela', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tarefas');

  await expect(page.getByRole('button', { name: 'Editar etapas' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await page.getByRole('button', { name: 'Editar etapas' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
test('conteúdo usa título neutro e guarda visões salvas dentro de Filtros', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/conteudo');

  await expect(page.getByRole('heading', { name: 'Conteúdo', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar visão' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salvar visão' })).toBeVisible();
});
