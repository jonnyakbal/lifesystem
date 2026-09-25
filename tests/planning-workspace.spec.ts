import { test, expect } from '@playwright/test';

test('tarefa sem data pode entrar na semana e voltar ao planejamento', async ({ page, request }) => {
  const title = `Plano de teste ${Date.now()}`;
  const createdResponse = await request.post('/api/tasks', { data: { title, priority: 'normal', status: 'todo' } });
  expect(createdResponse.status()).toBe(201);
  const task = await createdResponse.json() as { id: string };
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  try {
    await page.goto('/planejar');
    await expect(page.getByRole('heading', { name: 'Sua semana' })).toBeVisible();
    const card = page.getByTestId(`planning-task-${task.id}`);
    if (await card.count() === 0) await page.getByRole('button', { name: /Ver mais \d+ tarefas/ }).click();
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Planejar' }).click();
    await page.getByLabel('Dia escolhido').fill(today);
    await page.getByRole('button', { name: 'Salvar dia' }).click();
    await expect(card).toContainText('Devolver ao planejamento');
    await card.getByRole('button', { name: 'Devolver ao planejamento' }).click();
    await expect(card.getByRole('button', { name: 'Planejar' })).toBeVisible();
  } finally {
    await request.delete(`/api/tasks/${task.id}`);
  }
});
