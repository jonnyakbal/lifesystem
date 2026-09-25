import { test, expect } from '@playwright/test';

test('novo conteúdo reabre com formulário limpo', async ({ page }) => {
  await page.goto('/conteudo');
  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  const title = page.getByPlaceholder('Título do conteúdo...');
  await expect(title).toBeVisible();
  await title.fill('Rascunho temporário');
  await page.getByRole('button', { name: 'Fechar editor' }).click();
  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  await expect(title).toHaveValue('');
});
