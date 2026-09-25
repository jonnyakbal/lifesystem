import { expect, test } from '@playwright/test';

test('controles secundários de tarefas ficam acessíveis sem ocupar a primeira tela', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tarefas');

  const advanced = page.locator('details', { hasText: 'Mais opções de organização' });
  await expect(advanced).not.toHaveAttribute('open');
  await advanced.locator('summary').click();
  await expect(advanced).toHaveAttribute('open');

  await page.getByRole('button', { name: 'Editar etapas' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('conteúdo usa título neutro e mantém visões salvas em opções avançadas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/conteudo');

  await expect(page.getByRole('heading', { name: 'Conteúdo', exact: true })).toBeVisible();
  const advanced = page.locator('details', { hasText: 'Mais opções de organização' });
  await expect(advanced).not.toHaveAttribute('open');
  await advanced.locator('summary').click();
  await expect(advanced.getByRole('button', { name: 'Salvar visão' })).toBeVisible();
});
