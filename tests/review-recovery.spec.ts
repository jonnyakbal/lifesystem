import { expect, test } from '@playwright/test';
import { DEFAULT_STAGES } from '../src/lib/default-stages';

test('revisão não confunde erro de leitura com fila vazia e permite tentar novamente', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await page.route('**/api/stage-configs/tasks', route => route.fulfill({ json: { stages: DEFAULT_STAGES.tasks } }));
  await page.route('**/api/tasks', route => route.fulfill({ status: 503, json: { error: 'Tarefas indisponíveis para revisão.' } }));
  await page.goto('/revisao');
  await expect(page.getByRole('alert').filter({ hasText: 'Tarefas indisponíveis para revisão.' })).toBeVisible();
  await expect(page.getByText('INBOX vazia. Nada pra processar 🎉')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Próximo', exact: true })).toHaveCount(0);
  await page.route('**/api/tasks', route => route.fulfill({ json: [] }));
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByText('INBOX vazia. Nada pra processar 🎉')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Próximo', exact: true })).toBeVisible();
});
