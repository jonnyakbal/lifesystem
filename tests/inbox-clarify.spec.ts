import { expect, test, type APIRequestContext } from '@playwright/test';

async function capture(request: APIRequestContext, content: string) {
  const response = await request.post('/api/captures', { data: { content, type: 'text', status: 'inbox' } });
  expect(response.ok()).toBe(true);
  return response.json();
}
async function tasksTitled(request: APIRequestContext, title: string) {
  return ((await (await request.get('/api/tasks')).json()) as { title: string }[]).filter(item => item.title === title);
}
async function cleanup(request: APIRequestContext, titles: string[]) {
  const tasks = await (await request.get('/api/tasks')).json();
  for (const item of tasks.filter((task: { title: string }) => titles.includes(task.title))) await request.delete(`/api/tasks/${item.id}`);
  const captures = await (await request.get('/api/captures')).json();
  for (const item of captures.filter((entry: { content: string }) => titles.some(title => entry.content.startsWith(title)))) await request.delete(`/api/captures/${item.id}`);
}

test('Esclarecer: um item por vez vira tarefa com atalhos, delegada ou feita na hora', async ({ page, request }) => {
  const titles = ['QA esclarecer tarefa', 'QA esclarecer delegar', 'QA esclarecer agora'];
  await cleanup(request, titles);
  for (const title of [...titles].reverse()) await capture(request, title);
  try {
    await page.goto('/inbox');
    const card = page.getByRole('region', { name: 'Esclarecer captura' });
    await expect(card.getByRole('heading', { name: titles[0] })).toBeVisible();

    await card.getByRole('button', { name: /Virar tarefa/ }).click();
    await page.getByLabel('Qual é a próxima ação concreta?').fill(`${titles[0]} !alta @amanhã`);
    await expect(card.getByText('Urgente')).toBeVisible();
    await card.getByRole('button', { name: 'Criar tarefa', exact: true }).click();
    await expect.poll(async () => (await tasksTitled(request, titles[0]))[0]).toMatchObject({ priority: 'urgent' });

    await expect(card.getByRole('heading', { name: titles[1] })).toBeVisible();
    await page.keyboard.press('5');
    await page.getByLabel('Quem vai fazer?').fill('Equipe Dona Maria');
    await card.getByRole('button', { name: 'Delegar', exact: true }).click();
    await expect.poll(async () => (await tasksTitled(request, titles[1]))[0]).toMatchObject({ waitingFor: 'Equipe Dona Maria' });

    await expect(card.getByRole('heading', { name: titles[2] })).toBeVisible();
    await card.getByRole('button', { name: /Fazer agora/ }).click();
    await expect.poll(async () => (await tasksTitled(request, titles[2]))[0]).toMatchObject({ status: 'done' });
  } finally { await cleanup(request, titles); }
});

test('Esclarecer: descartar tem desfazer e pular preserva o item', async ({ page, request }) => {
  const titles = ['QA esclarecer descartar', 'QA esclarecer pular'];
  await cleanup(request, titles);
  await capture(request, titles[1]); await capture(request, titles[0]);
  try {
    await page.goto('/inbox');
    const card = page.getByRole('region', { name: 'Esclarecer captura' });
    await expect(card.getByRole('heading', { name: titles[0] })).toBeVisible();
    await page.keyboard.press('s');
    await expect(card.getByRole('heading', { name: titles[1] })).toBeVisible();
    await page.keyboard.press('1');
    await expect(card.getByRole('heading', { name: titles[0] })).toBeVisible();
    await page.locator('[data-sonner-toast]').getByRole('button', { name: 'Desfazer', exact: true }).click();
    await expect.poll(async () => ((await (await request.get('/api/captures')).json()) as { content: string; status: string }[]).filter(item => item.content === titles[1] && item.status === 'inbox').length).toBe(1);
  } finally { await cleanup(request, titles); }
});

test('Aguardando aparece na lista de tarefas e pode ser editado no painel', async ({ page, request }) => {
  const task = await (await request.post('/api/tasks', { data: { title: 'QA aguardando na lista', status: 'todo', priority: 'normal', waitingFor: 'Fornecedor' } })).json();
  try {
    await page.goto('/tarefas');
    const row = page.getByTestId(`task-row-${task.id}`);
    await expect(row.getByText('Fornecedor', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: task.title, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar Tarefa' });
    await dialog.getByLabel('Aguardando quem').fill('');
    await expect.poll(async () => (await (await request.get(`/api/tasks/${task.id}`)).json()).waitingFor ?? null, { timeout: 8000 }).toBeNull();
  } finally { await request.delete(`/api/tasks/${task.id}`); }
});
