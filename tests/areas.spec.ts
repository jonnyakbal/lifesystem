import { expect, test } from '@playwright/test';

test('Áreas mostra cada pilar com próxima ação e abre a página da área', async ({ page, request }) => {
  const pillar = await (await request.post('/api/pillars', { data: { name: 'Área QA sintética', icon: '🧪', description: 'Responsabilidade contínua de teste.', color: '', target: '', currentStatus: '' } })).json();
  const next = await (await request.post('/api/tasks', { data: { title: 'Ação QA da área', status: 'todo', priority: 'urgent', pillarId: pillar.id } })).json();
  const waiting = await (await request.post('/api/tasks', { data: { title: 'Espera QA da área', status: 'todo', priority: 'normal', pillarId: pillar.id, waitingFor: 'Fornecedor QA' } })).json();
  try {
    await page.goto('/areas');
    const card = page.getByRole('link', { name: `Abrir área ${pillar.name}` });
    await expect(card).toContainText('Ação QA da área');
    await card.click();
    await expect(page.getByRole('heading', { name: /Área QA sintética/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Próximas ações da área' }).getByText('Ação QA da área')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Próximas ações da área' }).getByText('Fornecedor QA')).toBeVisible();
    await page.getByRole('link', { name: 'Áreas', exact: true }).first().click();
    await expect(page).toHaveURL(/\/areas$/);
  } finally {
    for (const id of [next.id, waiting.id]) await request.delete(`/api/tasks/${id}`);
    await request.delete(`/api/pillars/${pillar.id}`);
  }
});
